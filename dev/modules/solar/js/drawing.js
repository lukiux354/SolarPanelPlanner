import { map, polylines } from './map.js';
import { saveShape } from './api.js';
import { createVertexMarkers } from './markers.js';
import { state } from './state.js';
import { update3DView } from './three/buildings.js';
import { updateWallHeightControls} from './three/ui.js';
import { updateCurrentProjectAddress} from './project.js';
import { showProjectRequiredModal, showErrorModal } from './modals.js';
import { getCurrentProjectId } from './project_panel.js';

// variables
let polyline = null;
let startCircle = null;

export function setupDrawing() {
    map.addListener("click", handleMapClick);
    
    const cancelBtn = document.getElementById("cancel-drawing-btn");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", cancelDrawing);
    }
    
    //keyboard shortcut for cancelling (ESC)
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && state.drawing) {
            cancelDrawing();
        }
    });
}

export function handleMapClick(event) {
    const selectedProjectId = getCurrentProjectId();
    
    // If no project is selected
    if (!selectedProjectId) {
        showProjectRequiredModal();
        return;
    }
    
    //prevent drawing when in delete mode
    if (state.deleteMode) {
        return;
    }
    
    const latLng = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
    };
    
    if (!state.drawing) {
        const nearestVertex = findNearestVertex(latLng);
        startDrawing(nearestVertex || latLng);
    } else {
        // check if we should close the shape
        if (startCircle) {
            const startCenter = {
                lat: startCircle.getCenter().lat(),
                lng: startCircle.getCenter().lng()
            };
            
            const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
                event.latLng, 
                new window.google.maps.LatLng(startCenter.lat, startCenter.lng)
            );
            
            if (distance < state.snapDistance && state.currentPath.length >= 2) {
                closeShape();
            } else {
                addPoint(latLng);
            }
        } else {
            addPoint(latLng);
        }
    }
}

export function startDrawing(latLng) {
    state.drawing = true;
    state.currentPath = [latLng];

    polyline = new window.google.maps.Polyline({
        path: state.currentPath,
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map,
        zIndex: 100005,
    });

    startCircle = new window.google.maps.Circle({
        center: latLng,
        radius: 0.5,
        strokeColor: "#008000",
        strokeOpacity: 1.0,
        strokeWeight: 2,
        fillColor: "#77f164",
        fillOpacity: 1.0,
        map: map,
        zIndex: 1000006
    });

    startCircle.addListener("click", () => {
        if (state.currentPath.length >= 3) {
            closeShape();
        } else {
            showErrorModal('Invalid Polygon', 'Polygon needs at least 3 points.');
        }
    });

    document.body.classList.add("drawing-cursor");
    
    //show cancel drawing button
    const cancelBtn = document.getElementById("cancel-drawing-btn");
    if (cancelBtn) {
        cancelBtn.style.display = "block";
    }
}

export function addPoint(latLng) {
    state.currentPath.push(latLng);
    polyline.setPath(state.currentPath);
}

export function closeShape() {
    if (state.currentPath.length < 3) {
        showErrorModal('Invalid Polygon', 'Polygon needs at least 3 points.');
        return;
    }

    state.drawing = false;
    document.body.classList.remove("drawing-cursor");

    // Convert to basic coordinate
    const validPath = state.currentPath.map(coord => ({
        lat: typeof coord.lat === 'function' ? coord.lat() : coord.lat,
        lng: typeof coord.lng === 'function' ? coord.lng() : coord.lng
    })).filter(coord => 
        !isNaN(coord.lat) && !isNaN(coord.lng)
    );

    if (validPath.length < 3) {
        showErrorModal('Invalid Polygon', 'Invalid polygon coordinates');
        return;
    }

    let polygon = new window.google.maps.Polygon({
        paths: validPath,
        strokeColor: "#0000FF",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#0000FF",
        fillOpacity: 0.35,
        map: map,
        clickable: true
    });

    polygon.type = 'roof';

    polygon.addListener("click", (event) => {
        if (state.deleteMode) {
            import('./map.js').then(module => {
                module.handlePolygonDelete(event.latLng);
            });
        } else {
            //allow clicking on existing polygons
            import('./drawing.js').then(module => {
                if (state.drawing) {
                    if (module.startCircle) {
                        const startCenter = {
                            lat: module.startCircle.getCenter().lat(),
                            lng: module.startCircle.getCenter().lng()
                        };
                        
                        const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
                            event.latLng, 
                            new window.google.maps.LatLng(startCenter.lat, startCenter.lng)
                        );
                        
                        // If clicking near start point and we have enough points, close the shape
                        if (distance < state.snapDistance && state.currentPath.length >= 2) {
                            module.closeShape();
                        } else {
                            // Otherwise just add the point
                            module.addPoint(event.latLng);
                        }
                    } else {
                        module.addPoint(event.latLng);
                    }
                } else {
                    // Start drawing from this point if we're not already drawing
                    module.startDrawing(event.latLng);
                }
            });
        }
    });

    const cancelBtn = document.getElementById("cancel-drawing-btn");
    if (cancelBtn) {
        cancelBtn.style.display = "none";
    }

    polylines.push(polygon);
    polyline.setMap(null);
    startCircle.setMap(null);
    
    let defaultHeight = 10;
    const heightSlider = document.getElementById('wall-height');
    if (heightSlider && heightSlider.value) {
        defaultHeight = parseFloat(heightSlider.value);
    } else {
        if (state.baseHeights && Object.values(state.baseHeights).length > 0) {
            const heightValues = Object.values(state.baseHeights);
            const nonZeroHeights = heightValues.filter(h => h > 0);
            if (nonZeroHeights.length > 0) {
                defaultHeight = nonZeroHeights[nonZeroHeights.length - 1];
            }
        }
    }
    
    const tempId = `p-temp-${Date.now()}`;
    polygon.id = tempId;

    if (!state.baseHeights) {
        state.baseHeights = {};
    }

    state.baseHeights[tempId] = defaultHeight;

    saveShape(validPath).then(response => {
        if (response && response.id) {
            // Get id   from server response
            const realId = response.id.startsWith('p-') ? response.id : `p-${response.id}`;
            
            // Update the polygon ID
            polygon.id = realId;
            
            // Transfer the height from temp ID to real ID
            state.baseHeights[realId] = defaultHeight;
            delete state.baseHeights[tempId];
                        
            // Now create polygon data for 3D view update with the real ID
            const polygonsData = polylines.map(p => ({
                coordinates: p.getPath().getArray().map(latLng => [latLng.lat(), latLng.lng()]),
                id: p.id
            }));
            
            // Ensure baseHeight is included for all polygons WITH CONSISTENT ID FORMAT
            for (const poly of polygonsData) {
                if (!state.baseHeights[poly.id]) {
                    state.baseHeights[poly.id] = defaultHeight;
                }
            }
            
            // Update the 3D view AFTER the server response
            update3DView(polygonsData);
            
            // Update height controls to match
            updateWallHeightControls(defaultHeight);

            updateCurrentProjectAddress();
            
            // Save the height data after everything is updated
            import('./three/persistence.js').then(module => {
                module.saveAllRoofData();
            });
        }
    }).catch(err => {
        console.error("Error saving shape:", err);
        
        // Even if there's an error, still try to update the 3D view
        const polygonsData = polylines.map(p => ({
            coordinates: p.getPath().getArray().map(latLng => [latLng.lat(), latLng.lng()]),
            // Ensure ID format is consistent
            id: p.id
        }));
        
        update3DView(polygonsData);
        updateWallHeightControls(defaultHeight);
    });
    
    createVertexMarkers(polygon, false);

    import('./map.js').then(module => {
        if (typeof module.updateDeleteButtonState === 'function') {
            module.updateDeleteButtonState();
        }
    });
}

function findNearestVertex(latLng, excludePolygon = null) {
    let nearestVertex = null;
    let nearestDistance = Infinity;

    polylines.forEach(polygon => {
        if (polygon.type === 'roof' && polygon !== excludePolygon) {
            const path = polygon.getPath();
            path.getArray().forEach(vertex => {
                const distance = window.google.maps.geometry.spherical.computeDistanceBetween(latLng, vertex);
                if (distance < state.snapDistance && distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestVertex = vertex;
                }
            });
        }
    });

    return nearestVertex;
}

export function cancelDrawing() {
    if (!state.drawing) return;
    
    state.drawing = false;
    document.body.classList.remove("drawing-cursor");
    
    // Remove the polyline
    if (polyline) {
        polyline.setMap(null);
        polyline = null;
    }
    
    // Remove the start circle
    if (startCircle) {
        startCircle.setMap(null);
        startCircle = null;
    }
    
    // Reset the current path
    state.currentPath = [];
    
    // Hide the cancel button
    const cancelBtn = document.getElementById("cancel-drawing-btn");
    if (cancelBtn) {
        cancelBtn.style.display = "none";
    }
}

export function handleVertexClick(vertex) {
    if (state.drawing) {
        // Convert vertex to literal coordinates
        const clickedPoint = { 
            lat: vertex.lat(), 
            lng: vertex.lng() 
        };
        
        // Check if the clicked point is near the starting point
        if (startCircle) {
            const startCenter = {
                lat: startCircle.getCenter().lat(),
                lng: startCircle.getCenter().lng()
            };
            
            const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
                new window.google.maps.LatLng(clickedPoint),
                new window.google.maps.LatLng(startCenter)
            );
            
            // If we're clicking near the starting point and have enough points, close the shape
            if (distance < state.snapDistance && state.currentPath.length >= 2) {
                closeShape();
                return;
            }
        }
        
        // Otherwise, just add the point normally
        addPoint(clickedPoint);
    } else {
        // Start a new drawing
        startDrawing({ lat: vertex.lat(), lng: vertex.lng() });
    }
}