import * as THREE from 'three';
import { state } from './state.js';
import { createHeightLabel, updateLabelScale } from './visualization.js';
import { saveAllRoofData } from './persistence.js';
import { updatePolygonGeometry, setVertexHeight } from './buildings.js';
import { updateSolarCalculations } from './ui.js';
import { visualizeAllRoofEfficiencies, updatePanelsForAllSelectedRoofs } from './solar_panel/panel_placement.js';
import { MARKER_COLOR } from './vertices.js';
import { clearExistingPanels } from './solar_panel/panel_model.js';
import { isVerticalMesh } from './solar_panel/roof_analysis.js';


const VERTEX_COLORS = {
    BASE: MARKER_COLOR,
    SELECTED: 0x33cccc,
    HOVER: 0x00ffff
};


// Setup mouse events for the renderer
export function setupMouseEvents() {
    const threeContainer = document.getElementById('three-container');
    if (!threeContainer) return;
    
    // Add event listeners
    threeContainer.addEventListener('mousedown', onMouseDown, false);
    threeContainer.addEventListener('mousemove', onMouseMove, false);
    threeContainer.addEventListener('mouseup', onMouseUp, false);
    threeContainer.addEventListener('mouseleave', onMouseUp, false);
}

// Handle mouse down events
function onMouseDown(event) {
    if (event.button !== 0) return;

    const threeContainer = document.getElementById('three-container');
    const rect = threeContainer.getBoundingClientRect();
    state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    state.raycaster.setFromCamera(state.mouse, state.camera);
    const intersects = state.raycaster.intersectObjects(state.vertexMarkers, false);

    if (intersects.length > 0 && intersects[0].object.userData.isVertex) {
        const vertex = intersects[0].object;
        const polygonIndex = vertex.userData.polygonIndex;
        
        // Find the parent roof mesh
        const roofMesh = state.currentMeshes.find(mesh => 
            mesh.userData.polygonIndex === polygonIndex
        );
        
        // If the roof is highlighted, store that info and temporarily remove highlight
        if (roofMesh && roofMesh.userData.hasHighlight) {
            roofMesh.userData.wasHighlighted = true;
            removeRoofOutline(roofMesh);
        }
    }

    if (intersects.length > 0) {
        // Disable orbit controls while dragging
        state.controls.enabled = false;
        
        state.selectedVertex = intersects[0].object;
        
        // Create a drag plane that always faces the camera
        const normal = state.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1);
        state.dragPlane = new THREE.Plane(normal, 0);
        state.dragPlane.setFromNormalAndCoplanarPoint(
            normal,
            state.selectedVertex.position.clone()
        );
        
        // In the onMouseDown function:
        state.isDragging = true;
        state.selectedVertex.material.color.set(VERTEX_COLORS.SELECTED); // Selected state

        // Show height label
        const vertexHeight = state.vertexHeights[state.selectedVertex.userData.key] || 0;
        const baseHeight = state.baseHeights[state.selectedVertex.userData.polygonIndex] || 0;

        // Pass both the total height and base height
        state.heightLabel = createHeightLabel(
            state.selectedVertex.position, 
            baseHeight + vertexHeight, 
            baseHeight
        );
    } else {
        // No vertex hit, check for roof/building hits for solar panel placement
        const buildingIntersects = state.raycaster.intersectObjects(
            state.currentMeshes.flatMap(mesh => mesh.children), true
        );
        
        if (buildingIntersects.length > 0) {
            const hit = buildingIntersects[0];
            
            // Find which building/roof was hit
            let parentMesh = hit.object;
            while (parentMesh.parent && !parentMesh.userData.polygonIndex) {
                parentMesh = parentMesh.parent;
            }
            
            if (parentMesh && parentMesh.userData.polygonIndex !== undefined) {
                const polygonIndex = parentMesh.userData.polygonIndex;
                
                // Toggle selection
                const selectedIndex = state.solarPanel.selectedRoofIndices.indexOf(polygonIndex);
                
                if (selectedIndex >= 0) {
                    // Deselect
                    state.solarPanel.selectedRoofIndices.splice(selectedIndex, 1);
                    
                    // Remove visual highlight
                    removeRoofOutline(parentMesh);
                } else {
                    // Select new roof
                    state.solarPanel.selectedRoofIndices.push(polygonIndex);
                    
                    // Add visual highlight
                    addRoofOutline(parentMesh);
                }
                    
                // Update panels on all selected roofs
                import('./solar_panel/panel_placement.js').then(module => {
                    module.updatePanelsForAllSelectedRoofs();
                    updateSolarCalculations();
                });
            }
        }
    }
}

// Handle mouse move events
function onMouseMove(event) { 
    // Get container dimensions
    const rect = document.getElementById('three-container').getBoundingClientRect();
    state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    state.raycaster.setFromCamera(state.mouse, state.camera);
    
    // Check if we're dragging a vertex
    if (!state.isDragging || !state.selectedVertex) {
        return;
    }

    clearExistingPanels();
    
    state.currentMeshes.forEach(mesh => {
        if (mesh.userData && mesh.userData.hasHighlight) {
            removeRoofOutline(mesh);
        }
    });
    
    // First check if we're hovering over any other vertex
    if (state.isSnapToVertexEnabled) {
        // Reset previously hovered vertex
        if (state.hoveredVertex && state.hoveredVertex !== state.selectedVertex) {
            state.hoveredVertex.material.color.set(VERTEX_COLORS.BASE);
        }
        state.hoveredVertex = null;
        
        // Get the edge group of the selected vertex
        const selectedKey = state.selectedVertex?.userData?.key;
        const selectedEdgeGroupId = state.uniqueVertices[selectedKey]?.edgeGroup;
        
        // Find if we're hovering over a vertex 
        const vertexIntersects = state.raycaster.intersectObjects(
            state.vertexMarkers.filter(marker => {
                // Don't snap to self - add more robust checks
                if (marker === state.selectedVertex || marker.userData.key === selectedKey) {
                    return false;
                }
                
                // Only check edge group when edge group mode is enabled
                if (state.isEdgeGroupModeEnabled) {
                    // Don't snap to vertices in same edge group when in group mode
                    const markerKey = marker.userData.key;
                    const markerEdgeGroupId = state.uniqueVertices[markerKey]?.edgeGroup;
                    return markerEdgeGroupId !== selectedEdgeGroupId;
                }
                
                // When in single vertex mode, allow snapping to any vertex
                return true;
            })
        );
        
        if (vertexIntersects.length > 0) {
            state.hoveredVertex = vertexIntersects[0].object;
            state.hoveredVertex.material.color.set(VERTEX_COLORS.HOVER); 
        }
    }

    const intersection = new THREE.Vector3();
    
    if (state.raycaster.ray.intersectPlane(state.dragPlane, intersection)) {
        const key = state.selectedVertex.userData.key;
        const selectedPolygonIndex = state.selectedVertex.userData.polygonIndex;
        const baseHeight = state.baseHeights[selectedPolygonIndex] || 0;
        
        let snappedHeight;
        
        // If hovering over another vertex, snap to its height
        if (state.hoveredVertex) {
            const hoverKey = state.hoveredVertex.userData.key;
            const hoverBaseHeight = state.baseHeights[state.hoveredVertex.userData.polygonIndex] || 0;
            const hoverRoofHeight = state.vertexHeights[hoverKey] || 0;
            
            // Calculate the absolute height of the hovered vertex
            snappedHeight = hoverBaseHeight + hoverRoofHeight;
        } else {
            // Normal 5cm snapping behavior
            snappedHeight = Math.round(intersection.y / state.snapIncrement) * state.snapIncrement;
        }
        
        // Calculate roof height (subtract base height)
        const roofHeight = snappedHeight - baseHeight;

        setVertexHeight(
            state.selectedVertex.userData.polygonIndex,
            state.selectedVertex.userData.vertexIndex,
            roofHeight
        );
        
        // Update height label
        if (state.heightLabel) {
            state.heightLabel.position.copy(state.selectedVertex.position);
            state.heightLabel.position.y = snappedHeight + 2;
            
            // Update the text on the label
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 180;
            canvas.height = 40;
            
            context.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.font = '20px Arial';
            context.fillStyle = state.hoveredVertex ? '#00ff00' : 'white';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(`${roofHeight.toFixed(2)}m (${snappedHeight.toFixed(2)}m)`, canvas.width/2, canvas.height/2);
            
            const texture = new THREE.CanvasTexture(canvas);
            if (state.heightLabel.material.map) state.heightLabel.material.map.dispose();
            state.heightLabel.material.map = texture;
            state.heightLabel.material.needsUpdate = true;

            // Update label scale
            updateLabelScale(state.heightLabel);
        }

        // Update the selected vertex position
        state.selectedVertex.position.y = snappedHeight;
        
        // Get all affected polygons for this specific vertex
        const affectedPolygonIndices = new Set();
        
        if (state.areVerticesSeparated) {
            // Only add the current polygon to affected indices
            affectedPolygonIndices.add(selectedPolygonIndex);
            
            // Only update height for this specific vertex in this specific polygon
            state.vertexHeights[key] = roofHeight;
            
            if (state.uniqueVertices[key]) {
                // Find the specific reference for this polygon
                const thisPolygonReference = state.uniqueVertices[key].references.find(
                    ref => ref.polygonIndex === selectedPolygonIndex
                );
                
                if (thisPolygonReference) {
                    // Only update height for this specific polygon's reference
                    state.uniqueVertices[key].height = roofHeight;
                    state.uniqueVertices[key].position.y = snappedHeight;
                }
            }
        }
        // If vertices are NOT separated, update all connected vertices AND their markers
        else {
            // Update the stored height in uniqueVertices
            if (state.uniqueVertices[key]) {
                state.uniqueVertices[key].height = roofHeight;
                state.uniqueVertices[key].position.y = snappedHeight;
            }
            
            // Add references from the current vertex
            if (state.uniqueVertices[key] && state.uniqueVertices[key].references) {
                state.uniqueVertices[key].references.forEach(ref => {
                    affectedPolygonIndices.add(ref.polygonIndex);
                });
            }
            
            // Find the edge group this vertex belongs to
            const edgeGroupId = state.uniqueVertices[key]?.edgeGroup;
            let keysToUpdate = [key];
            
            // If edge group mode is enabled and vertex belongs to an edge group, update all vertices in that group
            if (state.isEdgeGroupModeEnabled && edgeGroupId !== undefined && state.edgeGroups[edgeGroupId]) {
                keysToUpdate = state.edgeGroups[edgeGroupId];
            }
            
            // Update all vertices in the edge group
            keysToUpdate.forEach(vertexKey => {
                // Skip the current vertex (it's already updated)
                if (vertexKey === key) return;
                
                // Get vertex index from uniqueVertices references
                const vertexEntry = state.uniqueVertices[vertexKey];
                if (vertexEntry && vertexEntry.references && vertexEntry.references.length > 0) {
                    vertexEntry.references.forEach(ref => {
                        setVertexHeight(ref.polygonIndex, ref.vertexIndex, roofHeight);
                    });
                }
                
                // Update vertex markers (only update position, don't create new ones)
                state.vertexMarkers.forEach(marker => {
                    if (marker.userData.key === vertexKey) {
                        const markerBaseHeight = state.baseHeights[marker.userData.polygonIndex] || 0;
                        marker.position.y = markerBaseHeight + roofHeight;
                    }
                });
                
                // Collect affected polygon indices
                if (state.uniqueVertices[vertexKey] && state.uniqueVertices[vertexKey].references) {
                    state.uniqueVertices[vertexKey].references.forEach(ref => {
                        affectedPolygonIndices.add(ref.polygonIndex);
                    });
                }
                
                // Update the stored height in uniqueVertices
                if (state.uniqueVertices[vertexKey]) {
                    state.uniqueVertices[vertexKey].height = roofHeight;
                    
                    // Also update the position.y value (some code might use it)
                    const vertexBaseHeight = state.baseHeights[state.uniqueVertices[vertexKey].references[0]?.polygonIndex] || 0;
                    state.uniqueVertices[vertexKey].position.y = vertexBaseHeight + roofHeight;
                }
            });
            
            const originalXZ = key.split(',').map(val => parseFloat(val));
            if (originalXZ.length === 2) {
                // Find all markers that share the same original XZ position
                state.vertexMarkers.forEach(marker => {
                    // Don't update the selected one again
                    if (marker === state.selectedVertex) return;
                    
                    const markerKey = marker.userData.key;
                    const markerXZ = markerKey.split(',').map(val => parseFloat(val));
                    
                    // Check if this marker is from the same original position
                    const xDiff = Math.abs(originalXZ[0] - markerXZ[0]);
                    const zDiff = Math.abs(originalXZ[1] - markerXZ[1]);
                    
                    if (xDiff < 0.1 && zDiff < 0.1) {
                        // This is a shared vertex, update its Y position
                        const markerBaseHeight = state.baseHeights[marker.userData.polygonIndex] || 0;
                        marker.position.y = markerBaseHeight + roofHeight;
                    }
                });
            }
        }
        
        // Update only the affected polygon geometries
        affectedPolygonIndices.forEach(polygonIndex => {
            updatePolygonGeometry(polygonIndex, false);
        });
    }
}

function onMouseUp() {
    if (state.selectedVertex && state.isDragging) {
        // First restore the normal color for the selected vertex
        state.selectedVertex.material.color.set(VERTEX_COLORS.BASE);
        
        // Update panels and efficiencies
        updatePanelsForAllSelectedRoofs();
        
        if (state.showingEfficiencyColors) {
            visualizeAllRoofEfficiencies();
        }
        
        // Get all affected polygons
        const affectedPolygons = new Set();
        const key = state.selectedVertex.userData.key;
        
        // Find all polygon indices that use this vertex or any vertex in its edge group
        const edgeGroupId = state.uniqueVertices[key]?.edgeGroup;
        let keysToUpdate = [key]; // By default, only the selected vertex
        
        // If edge group mode is enabled, consider all vertices in that group
        if (state.isEdgeGroupModeEnabled && edgeGroupId !== undefined && state.edgeGroups[edgeGroupId]) {
            keysToUpdate = state.edgeGroups[edgeGroupId];
        }
        
        // Collect all affected polygons
        keysToUpdate.forEach(vertexKey => {
            if (state.uniqueVertices[vertexKey] && state.uniqueVertices[vertexKey].references) {
                state.uniqueVertices[vertexKey].references.forEach(ref => {
                    affectedPolygons.add(ref.polygonIndex);
                });
            }
        });
        
        // Restore highlights for ALL selected roofs, not just the one being dragged
        // First remove all highlights to ensure clean state
        state.currentMeshes.forEach(mesh => {
            if (mesh.userData && mesh.userData.hasHighlight) {
                removeRoofOutline(mesh);
            }
        });
        
        // Then restore highlights for all selected roofs
        state.solarPanel.selectedRoofIndices.forEach(selectedIndex => {
            const selectedRoofMesh = state.currentMeshes.find(mesh => 
                mesh.userData.polygonIndex === selectedIndex
            );
            
            if (selectedRoofMesh) {
                addRoofOutline(selectedRoofMesh);
            }
        });
    }
    
    // Reset hovered vertex color if any
    if (state.hoveredVertex && state.hoveredVertex !== state.selectedVertex) {
        state.hoveredVertex.material.color.set(VERTEX_COLORS.BASE);
        state.hoveredVertex = null;
    }
    
    // Remove height label
    if (state.heightLabel) {
        state.scene.remove(state.heightLabel);
        state.heightLabel = null;
    }
    
    // Re-enable controls
    state.controls.enabled = true;
    
    state.isDragging = false;
    state.selectedVertex = null;

    saveAllRoofData();
}


function addRoofOutline(roofMesh) {
    // Don't add an outline if the mesh already has one
    if (roofMesh.userData.hasHighlight) return;
    
    // Skip the material color change entirely
    roofMesh.userData.hasHighlight = true;
    
    // Add a wireframe outline to make the selection visible
    if (!roofMesh.userData.wireframeOverlay) {
        try {
            const wireframeMaterial = new THREE.LineBasicMaterial({
                color: 0xffff00,
                linewidth: 3,
                transparent: false,
                depthTest: true
            });
            
            // Create a wireframe based on the mesh or its children
            let edgesGeometry;
            let wireframeObject;
            let fillMesh; // New fill mesh
            
            if (roofMesh.geometry) {
                // If the mesh has its own geometry, use that
                edgesGeometry = new THREE.EdgesGeometry(roofMesh.geometry, 15); // 15 degree threshold for edge detection
                wireframeObject = new THREE.LineSegments(edgesGeometry, wireframeMaterial);
                
                // Copy the transform
                wireframeObject.position.copy(roofMesh.position);
                wireframeObject.rotation.copy(roofMesh.rotation);
                wireframeObject.scale.copy(roofMesh.scale);
                
                // Create a transparent fill mesh
                const fillMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffff00, // Same yellow color
                    transparent: true,
                    opacity: 0.15,    // Very transparent
                    side: THREE.DoubleSide,
                    depthWrite: false // Prevents z-fighting
                });
                
                fillMesh = new THREE.Mesh(roofMesh.geometry.clone(), fillMaterial);
                fillMesh.position.copy(roofMesh.position);
                fillMesh.rotation.copy(roofMesh.rotation);
                fillMesh.scale.copy(roofMesh.scale);
                fillMesh.position.y += 0.02; // Place slightly above roof
            } 
            else if (roofMesh.children && roofMesh.children.length > 0) {
                // If it's a group, find the first non-vertical child with geometry
                const roofPart = roofMesh.children.find(child => 
                    child.geometry && !isVerticalMesh(child)
                );
                
                if (roofPart) {
                    edgesGeometry = new THREE.EdgesGeometry(roofPart.geometry, 15);
                    wireframeObject = new THREE.LineSegments(edgesGeometry, wireframeMaterial);
                    
                    // Apply the child's world transform
                    wireframeObject.position.copy(roofPart.position);
                    wireframeObject.rotation.copy(roofPart.rotation);
                    wireframeObject.scale.copy(roofPart.scale);
                    
                    // Apply parent transforms if needed
                    if (roofPart.parent) {
                        wireframeObject.position.applyMatrix4(roofPart.parent.matrixWorld);
                    }
                    
                    // Create a transparent fill mesh for the roof part
                    const fillMaterial = new THREE.MeshBasicMaterial({
                        color: 0xffff00,
                        transparent: true,
                        opacity: 0.15,
                        side: THREE.DoubleSide,
                        depthWrite: false 
                    });
                    
                    fillMesh = new THREE.Mesh(roofPart.geometry.clone(), fillMaterial);
                    fillMesh.position.copy(roofPart.position);
                    fillMesh.rotation.copy(roofPart.rotation);
                    fillMesh.scale.copy(roofPart.scale);
                    
                    // Apply parent transforms if needed
                    if (roofPart.parent) {
                        fillMesh.position.applyMatrix4(roofPart.parent.matrixWorld);
                    }
                    
                    fillMesh.position.y += 0.02; // Place slightly above roof
                } else {
                    // No suitable geometry found
                    throw new Error("No suitable geometry found in children");
                }
            } else {
                throw new Error("No geometry available for wireframe");
            }
            
            if (wireframeObject) {
                // Raise the wireframe slightly above the roof to prevent z-fighting
                wireframeObject.position.y += 0.01;
                
                // Add to scene
                state.scene.add(wireframeObject);
                roofMesh.userData.wireframeOverlay = wireframeObject;
                
                // Add fill mesh if created
                if (fillMesh) {
                    state.scene.add(fillMesh);
                    roofMesh.userData.fillOverlay = fillMesh;
                }
            }
        } catch (e) {
            // Failed to create wireframe
            console.log("Couldn't create wireframe outline", e);
        }
    }
}

export function removeRoofOutline(roofMesh) {
    // Mark as not highlighted
    roofMesh.userData.hasHighlight = false;
    
    // Remove wireframe overlay if it exists
    if (roofMesh.userData.wireframeOverlay) {
        state.scene.remove(roofMesh.userData.wireframeOverlay);
        if (roofMesh.userData.wireframeOverlay.geometry) {
            roofMesh.userData.wireframeOverlay.geometry.dispose();
        }
        if (roofMesh.userData.wireframeOverlay.material) {
            roofMesh.userData.wireframeOverlay.material.dispose();
        }
        roofMesh.userData.wireframeOverlay = null;
    }
    
    // Remove fill overlay if it exists
    if (roofMesh.userData.fillOverlay) {
        state.scene.remove(roofMesh.userData.fillOverlay);
        if (roofMesh.userData.fillOverlay.geometry) {
            roofMesh.userData.fillOverlay.geometry.dispose();
        }
        if (roofMesh.userData.fillOverlay.material) {
            roofMesh.userData.fillOverlay.material.dispose();
        }
        roofMesh.userData.fillOverlay = null;
    }
}