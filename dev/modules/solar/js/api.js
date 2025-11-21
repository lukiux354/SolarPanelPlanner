import { focusOnPolygons,map, polylines, setPolylines } from './map.js';
import { createVertexMarkers } from './markers.js';
import { showPolygonDeleteConfirmationModal } from './modals.js';
import { updateCurrentProjectAddress } from './project.js';
import { getCurrentProjectId } from './project_panel.js';
import { state } from './state.js';
import { checkOSMBuildingHeightAvailability, disableOSMHeightButton } from './three/osm_data.js';
import { updatePanelsForAllSelectedRoofs } from './three/solar_panel/panel_placement.js';
import { state as threeState } from './three/state.js';
import { update3DView } from './threejs.js';

export function loadExistingShapes(projectId) {
    if (!projectId) return; 

    disableOSMHeightButton();

    polylines.forEach(polygon => {
        if (polygon.vertexMarkers) {
            polygon.vertexMarkers.forEach(marker => {
                marker.setMap(null);
                window.google.maps.event.clearInstanceListeners(marker);
            });
        }
    });

    polylines.forEach(polyline => {
        if (polyline.type === 'edge' && polyline.markers) {
            polyline.markers.forEach(marker => {
                marker.setMap(null);
                window.google.maps.event.clearInstanceListeners(marker);
            });
        }
    });

    polylines.forEach(p => p.setMap(null));

    fetch(`/solar/api/roof-polygons/?project_id=${projectId}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            // Clear existing polylines
            polylines.forEach(p => p.setMap(null));
            polylines.splice(0, polylines.length);

            data.forEach(polygonData => {
                const paths = polygonData.coordinates.map(coord => new window.google.maps.LatLng(coord[0], coord[1]));

                if (paths.length < 3) return;

                const polygon = new window.google.maps.Polygon({
                    paths: paths,
                    strokeColor: '#0000FF',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: '#0000FF',
                    fillOpacity: 0.35,
                    map: map,
                    clickable: true, 
                });

                if (polygon.setClickable)
                    polygon.setClickable(true);

                polygon.vertexMarkers = createVertexMarkers(polygon, false);
                polygon.vertexMarkers.forEach(m => {
                    m.setMap(map);
                    m.setClickable(!state.deleteMode);
                });

                polylines.push(polygon);
                polygon.id = polygonData.id;
                polygon.tiltAngle = polygonData.tilt_angle;
                polygon.type = 'roof';

                polygon.addListener('click', (event) => {
                    if (state.deleteMode) {
                        // Create a LatLng object
                        const clickedLatLng = new window.google.maps.LatLng(
                            event.latLng.lat(),
                            event.latLng.lng()
                        );

                        if (window.handlePolygonDelete)
                            window.handlePolygonDelete(clickedLatLng);
                        else {
                            import('./map.js').then(module => {
                                module.handlePolygonDelete(clickedLatLng);
                            }).catch(() => {
                                removePolygon(polygon);
                            });
                        }

                        // Stop event propagation
                        if (event.stop) event.stop();
                        return;
                    } else {
                        //handle in drawing.js
                        import('./drawing.js').then(module => {
                            if (state.drawing) {
                                // already drawing, so add the point to the current path
                                // Check if we should close the shape
                                if (module.startCircle) {
                                    const startCenter = {
                                        lat: module.startCircle.getCenter().lat(),
                                        lng: module.startCircle.getCenter().lng(),
                                    };

                                    const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
                                        event.latLng,
                                        new window.google.maps.LatLng(startCenter.lat, startCenter.lng)
                                    );

                                    if (distance < state.snapDistance)
                                        module.closeShape();
                                    else
                                        module.addPoint(event.latLng);

                                } else
                                    module.addPoint(event.latLng);

                            } else {
                                //Start new drawing
                                module.startDrawing(event.latLng);
                            }

                            //Stop event propagation
                            event.stop();
                        });
                    }
                });
            });

            focusOnPolygons();
            update3DView(data);

            setTimeout(() => {
                checkOSMBuildingHeightAvailability();
            }, 1000);
        })
        .catch(error => console.error('Error loading shapes:', error));
}

export function saveEdge(coordinates, parentId) {
    const validCoords = coordinates.map(coord => [coord.lat(), coord.lng()]);

    if (validCoords.length < 2) {
        alert('Cannot save edge - needs at least 2 valid points');
        return;
    }

    fetch('/solar/api/roof-edges/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({ coordinates: validCoords, parent: parentId }),
    })
        .then(response => response.json())
        .catch(error => console.error('Error saving edge:', error));
}

export function saveShape(polygonData, tiltAngle, bottomEdgeIndex) {
    const projectId = getCurrentProjectId();

    if (!projectId) {
        alert('Please select a valid project before saving.');
        return Promise.reject('No valid project selected');
    }

    if (!Array.isArray(polygonData)) {
        console.error('Invalid polygonData: Expected an array of coordinates', polygonData);
        return;
    }

    // Convert the array of { lat, lng } objects to an array of [lat, lng] arrays
    const validCoords = polygonData.map(coord => {
        if (coord.lat && coord.lng)
            return [coord.lat, coord.lng];
        else {
            console.error('Invalid coordinate:', coord);
            return null;
        }
    }).filter(coord => coord !== null);

    if (validCoords.length < 3) {
        alert('Cannot save shape - needs at least 3 valid points');
        return;
    }

    const payload = {
        coordinates: validCoords,
        project_id: projectId,
        tilt_angle: tiltAngle || 0,
        bottom_edge_index: bottomEdgeIndex || 0,
    };

    // Return the promise to allow chaining
    return fetch('/solar/api/roof-polygons/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify(payload),
    })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
        // Remove all existing highlights from the 3D view
            import('./three/interaction.js').then(module => {
            // Remove all highlights from meshes
                threeState.currentMeshes.forEach(mesh => {
                    if (mesh.userData && mesh.userData.hasHighlight)
                        module.removeRoofOutline(mesh);

                });

                // Clear the selected roofs array
                threeState.solarPanel.selectedRoofIndices = [];
            });

            // Clear any panels since selection is gone
            import('./three/solar_panel/panel_model.js').then(module => {
                module.clearExistingPanels();
            });

            return data; 
        })
        .catch(error => {
            console.error('Error saving polygon:', error);
            throw error;
        });
}

export function removePolygon(polygon) {
    showPolygonDeleteConfirmationModal(polygon, (polygon) => {

        if (polygon.id && threeState.currentMeshes) {
            const roofMesh = threeState.currentMeshes.find(mesh =>
                mesh.userData && mesh.userData.polygonIndex === polygon.id
            );

            if (roofMesh && roofMesh.userData.hasHighlight) {
                import('./three/interaction.js').then(module => {
                    module.removeRoofOutline(roofMesh);
                });
            }
        }
        // Remove the polygon from the 3D view
        if (polygon.id) {
            threeState.solarPanel.selectedRoofIndices = threeState.solarPanel.selectedRoofIndices.filter(
                index => index !== polygon.id
            );
        }

        polygon.setMap(null);
        setPolylines(polylines.filter(p => p !== polygon));

        if (polygon.vertexMarkers)
            polygon.vertexMarkers.forEach(marker => marker.setMap(null));

        if (polygon.id) {

            const projectId = getCurrentProjectId();

            threeState.solarPanel.selectedRoofIndices = threeState.solarPanel.selectedRoofIndices.filter(
                index => index !== polygon.id
            );
            updatePanelsForAllSelectedRoofs();

            fetch(`/solar/api/roof-polygons/${polygon.id}/?project_id=${projectId}`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCSRFToken() },
            })
                .then(() => {
                    if (state.baseHeights && state.baseHeights[polygon.id])
                        delete state.baseHeights[polygon.id];

                    const remainingPolygons = polylines.map(p => ({
                        coordinates: p.getPath().getArray().map(latLng => [latLng.lat(), latLng.lng()]),
                        id: p.id,
                    }));
                    update3DView(remainingPolygons);

                    updateCurrentProjectAddress();
                })
                .catch(error => {
                    console.error('Error deleting polygon:', error);
                });
        } else {
            const remainingPolygons = polylines.map(p => ({
                coordinates: p.getPath().getArray().map(latLng => [latLng.lat(), latLng.lng()]),
                id: p.id,
            }));
            update3DView(remainingPolygons);
        }
    });

    import('./map.js').then(module => {
        if (typeof module.updateDeleteButtonState === 'function')
            module.updateDeleteButtonState();

    });
}

export function getCSRFToken() {
    return document.cookie.split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
}
