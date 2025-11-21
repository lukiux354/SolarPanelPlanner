import * as THREE from 'three';
import { state } from './state.js';
import { convertLatLngToLocal, calculateBoundingBox, findCompleteEdge } from './geometry.js';
import { createVertexMarker } from './vertices.js';
import { createBaseOutline, createRoofOutline, createWallOutlines } from './visualization.js';
import { saveRoofData } from './persistence.js';
import { setLocation } from './sun_simulation.js';
import { updateWallHeightControls} from './ui.js';
import { checkOSMBuildingHeightAvailability } from './osm_data.js';
import { clearExistingPanels } from './solar_panel/panel_model.js';

export function createStableVertexKey(polygonId, vertexIndex) {
    return `p${polygonId}_v${vertexIndex}`;
}


export function applyStableHeightData(updateMarkers = true) { 
    // For each mesh, update its vertices based on height data
    state.currentMeshes.forEach(mesh => {
        const vertices3D = mesh.userData.vertices3D;
        const polygonIndex = mesh.userData.polygonIndex;
        
        // For each vertex in the mesh, apply its height from stable keys
        vertices3D.forEach((vertex, idx) => {
            const stableKey = createStableVertexKey(polygonIndex, idx);
            
            if (state.stableVertexHeights[stableKey] !== undefined) {
                // Apply the height from stable storage
                const height = state.stableVertexHeights[stableKey];
                vertex.height = height;
                
                // Also update the coordinate-based height for compatibility
                state.vertexHeights[vertex.key] = height;
            }
        });
        
        // Always update polygon geometry during initial load
        updatePolygonGeometry(polygonIndex, false);
    });
    
    // Update marker positions if requested
    if (updateMarkers) {
        updateAllMarkerPositions();
    }
}


export function updateAllMarkerPositions() {
    state.vertexMarkers.forEach(marker => {
        if (marker.userData && marker.userData.polygonIndex !== undefined && 
            marker.userData.vertexIndex !== undefined) {
            
            const polygonIndex = marker.userData.polygonIndex;
            const vertexIndex = marker.userData.vertexIndex;
            const stableKey = createStableVertexKey(polygonIndex, vertexIndex);
            
            const baseHeight = state.baseHeights[polygonIndex] || 0;
            const vertexHeight = state.stableVertexHeights[stableKey] || 0;
            
            // Update Y position to match height
            marker.position.y = baseHeight + vertexHeight;
        }
    });
}

export function setVertexHeight(polygonIndex, vertexIndex, height) {
    // Create stable key
    const stableKey = createStableVertexKey(polygonIndex, vertexIndex);
    
    // Save height with stable key
    state.stableVertexHeights[stableKey] = height;
    
    // Get the location key for this vertex
    const locationKey = state.stableKeyToLocation[stableKey];
    if (locationKey && state.locationToStableKeys[locationKey]) {
        // Set the same height for all vertices at this location
        state.locationToStableKeys[locationKey].forEach(relatedStableKey => {
            if (relatedStableKey !== stableKey) {
                state.stableVertexHeights[relatedStableKey] = height;
            }
        });
    }
    
    // Find the vertex and update its coordinate key too
    const mesh = state.currentMeshes.find(m => m.userData.polygonIndex === polygonIndex);
    if (mesh && mesh.userData.vertices3D && mesh.userData.vertices3D[vertexIndex]) {
        const coordKey = mesh.userData.vertices3D[vertexIndex].key;
        state.vertexHeights[coordKey] = height;
    }
}

function createAllVertexMarkers() {
    // Make sure to clear any existing markers first
    clearVertexMarkers();
    
    // Create markers for each mesh
    state.currentMeshes.forEach(mesh => {
        const vertices3D = mesh.userData.vertices3D;
        const polygonIndex = mesh.userData.polygonIndex;
        const baseHeight = state.baseHeights[polygonIndex] || 0;
        
        for (let i = 0; i < vertices3D.length; i++) {
            const v = vertices3D[i];
            // The height is already applied to the mesh vertices
            const finalHeight = baseHeight + v.height;
            
            const marker = createVertexMarker(
                v.x, 
                finalHeight,
                v.z, 
                v.key, 
                i, 
                polygonIndex
            );
            state.scene.add(marker);
            state.vertexMarkers.push(marker);
        }
    });
}

// Helper function to clear everything from the scene
export function clearScene() {
    // Clear selected roofs array and highlights
    if (state.solarPanel && state.solarPanel.selectedRoofIndices) {
        // Clear all highlights immediately instead of importing module
        state.currentMeshes.forEach(mesh => {
            if (mesh.userData && mesh.userData.hasHighlight) {
                // Remove wireframe overlay
                if (mesh.userData.wireframeOverlay) {
                    state.scene.remove(mesh.userData.wireframeOverlay);
                    if (mesh.userData.wireframeOverlay.geometry) {
                        mesh.userData.wireframeOverlay.geometry.dispose();
                    }
                    if (mesh.userData.wireframeOverlay.material) {
                        mesh.userData.wireframeOverlay.material.dispose();
                    }
                    mesh.userData.wireframeOverlay = null;
                }
                
                if (mesh.userData.fillOverlay) {
                    state.scene.remove(mesh.userData.fillOverlay);
                    if (mesh.userData.fillOverlay.geometry) {
                        mesh.userData.fillOverlay.geometry.dispose();
                    }
                    if (mesh.userData.fillOverlay.material) {
                        mesh.userData.fillOverlay.material.dispose();
                    }
                    mesh.userData.fillOverlay = null;
                }
                
                mesh.userData.hasHighlight = false;
            }
        });
        
        // Reset the selection array
        state.solarPanel.selectedRoofIndices = [];
    }

    // Clear all panels
    import('./solar_panel/panel_model.js').then(module => {
        module.clearExistingPanels();
    });
    
    // Clear all meshes and outlines
    state.currentMeshes.forEach(mesh => state.scene.remove(mesh));
    state.currentOutlines.forEach(line => state.scene.remove(line));
    clearVertexMarkers();
    state.currentMeshes = [];
    state.currentOutlines = [];
    
    state.uniqueVertices = {};
    state.edgeGroups = {};
    state.interiorVertices = new Set();
    state.vertexHeights = {};
}


export function createLocationKey(x, z) {
    return `loc_${parseFloat(x).toFixed(2)},${parseFloat(z).toFixed(2)}`;
}


export function update3DView(polygonsData) {
    // Store current camera position and target BEFORE any changes
    const cameraPos = state.camera ? state.camera.position.clone() : null;
    const targetPos = state.controls ? state.controls.target.clone() : null;
    
    // Store ALL existing data before clearing
    const existingStableVertexHeights = {...state.stableVertexHeights};
    const existingBaseHeights = {...state.baseHeights};
    
    // Clear everything using our helper function
    clearScene();
    
    // Restore previously stored heights with stable ids
    state.stableVertexHeights = existingStableVertexHeights;
    state.baseHeights = existingBaseHeights;
    
    // Initialize a location mapping for coincident vertices
    state.locationToStableKeys = {};
    state.stableKeyToLocation = {};
    
    // Calculate bounding box
    state.boundingBox = calculateBoundingBox(polygonsData);
    state.referencePoint = state.boundingBox.center;

    // Extract coordinates from the first polygon to set sun location
    if (polygonsData && polygonsData.length > 0) {
        const firstPolygon = polygonsData[0];
        if (firstPolygon && firstPolygon.coordinates && firstPolygon.coordinates.length > 0) {
            // Extract latitude and longitude from the first point
            const [latitude, longitude] = firstPolygon.coordinates[0];
            
            // Update sun simulation with project coordinates
            setLocation(latitude, longitude);
        }
    }
    
    // Load height data from backend if available
    let commonBaseHeight = 0;
    let baseHeightCount = 0;
    
    polygonsData.forEach((polygonData) => {
        if (polygonData.height_data) {
            try {
                const heightData = polygonData.height_data;
                
                // Set base height for this polygon
                if (heightData.baseHeight !== undefined) {
                    state.baseHeights[polygonData.id] = heightData.baseHeight;
                    commonBaseHeight += heightData.baseHeight;
                    baseHeightCount++;
                }
                
                // Load vertex heights - prefer stable format if available
                if (heightData.stableVertexHeights) {
                    Object.keys(heightData.stableVertexHeights).forEach(key => {
                        state.stableVertexHeights[key] = heightData.stableVertexHeights[key];
                    });
                } 
                //old format
                else if (heightData.vertexHeights) {
                    Object.keys(heightData.vertexHeights).forEach(key => {
                        state.vertexHeights[key] = heightData.vertexHeights[key];
                    });
                }
            } catch (e) {
                console.error("Error parsing height data:", e);
            }
        }
    });
    
    // Update the wall height slider with the common base height
    if (baseHeightCount > 0) {
        // Calculate average base height (usually all polygons have the same base height)
        const avgBaseHeight = commonBaseHeight / baseHeightCount;
        updateWallHeightControls(avgBaseHeight);
    }

    // First pass - collect all unique vertices
    polygonsData.forEach((polygonData) => {
        const points = polygonData.coordinates;
        if (points.length < 3) return;

        // Use actual database ID
        const polygonIndex = polygonData.id;
        
        // Process each vertex
        for (let i = 0; i < points.length; i++) {
            const { x, z } = convertLatLngToLocal(points[i][0], points[i][1]);
            const key = `${x.toFixed(3)},${z.toFixed(3)}`;
            const locationKey = createLocationKey(x, z);
            
            // Create stable key for this vertex
            const stableKey = createStableVertexKey(polygonIndex, i);
            
            // Map this stable key to its location
            state.stableKeyToLocation[stableKey] = locationKey;
            
            // Initialize the location map if needed
            if (!state.locationToStableKeys[locationKey]) {
                state.locationToStableKeys[locationKey] = [];
            }
            
            // Map this location to all stable keys at this location
            if (!state.locationToStableKeys[locationKey].includes(stableKey)) {
                state.locationToStableKeys[locationKey].push(stableKey);
            }
            
            // Create the unique vertex entry
            if (!state.uniqueVertices[key]) {
                state.uniqueVertices[key] = {
                    position: { x, z },
                    references: [],
                    height: 0,
                    connectedVertices: new Set(),
                    polygonIndices: new Set(),
                    isInterior: false,
                    locationKey: locationKey
                };
            }
            
            // Add reference to this polygon and vertex
            state.uniqueVertices[key].references.push({ polygonIndex, vertexIndex: i });
            state.uniqueVertices[key].polygonIndices.add(polygonIndex);
            
            // Track connections for boundary edges
            const prevIndex = (i - 1 + points.length) % points.length;
            const nextIndex = (i + 1) % points.length;
            
            const prevPoint = convertLatLngToLocal(points[prevIndex][0], points[prevIndex][1]);
            const nextPoint = convertLatLngToLocal(points[nextIndex][0], points[nextIndex][1]);
            
            const prevKey = `${prevPoint.x.toFixed(3)},${prevPoint.z.toFixed(3)}`;
            const nextKey = `${nextPoint.x.toFixed(3)},${nextPoint.z.toFixed(3)}`;
            
            state.uniqueVertices[key].connectedVertices.add(prevKey);
            state.uniqueVertices[key].connectedVertices.add(nextKey);
        }
    });

    // Normalize heights for all coincident vertices
    for (const locationKey in state.locationToStableKeys) {
        const stableKeys = state.locationToStableKeys[locationKey];
        if (stableKeys.length > 1) {
            // Find the maximum height among all vertices at this location
            let maxHeight = 0;
            stableKeys.forEach(stableKey => {
                const height = state.stableVertexHeights[stableKey] || 0;
                maxHeight = Math.max(maxHeight, height);
            });
            
            // Set the same height for all vertices at this location
            stableKeys.forEach(stableKey => {
                state.stableVertexHeights[stableKey] = maxHeight;
            });    
        }
    }
    
    // Second pass - identify interior vertices
    for (const key in state.uniqueVertices) {
        const vertex = state.uniqueVertices[key];
        if (vertex.polygonIndices.size >= 3) {
            vertex.isInterior = true;
            state.interiorVertices.add(key);
        }
    }
    
    // All interior vertices form one edge group
    if (state.interiorVertices.size > 0) {
        state.edgeGroups[0] = Array.from(state.interiorVertices);
        for (const key of state.interiorVertices) {
            state.uniqueVertices[key].edgeGroup = 0;
        }
    }
    
    // Next edge group ID starts after the interior group
    let edgeGroupId = 1;
    const processedVertices = new Set(state.interiorVertices);
    
    // Process boundary vertices in simple straight edges
    for (const key in state.uniqueVertices) {
        if (state.interiorVertices.has(key) || processedVertices.has(key)) continue;
        
        const edgeVertices = findCompleteEdge(key);
        state.edgeGroups[edgeGroupId] = edgeVertices;
        
        // Mark all these vertices as part of this edge group
        edgeVertices.forEach(vertexKey => {
            state.uniqueVertices[vertexKey].edgeGroup = edgeGroupId;
            processedVertices.add(vertexKey);
        });
        
        edgeGroupId++;
    }

    // STEP 1: First create all polygon meshes WITHOUT markers
    polygonsData.forEach((polygonData) => {
        createPolygonMesh(polygonData, polygonData.id, false); // false = no markers
    });
    
    // STEP 2: Apply heights from the stable system - this handles vertex heights
    applyStableHeightData(false); // false = don't update markers yet

    // STEP 3: NOW create all markers at once
    createAllVertexMarkers();
    
    // STEP 4: Restore camera position
    if (cameraPos && targetPos) {
        state.camera.position.copy(cameraPos);
        state.controls.target.copy(targetPos);
        state.controls.update();
    } else {
        adjustCamera();
    }

    import('./interaction.js').then(module => {
        module.setupMouseEvents();
        
        // Then trigger a resize event to ensure everything is properly initialized
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    });

    setTimeout(() => {
        checkOSMBuildingHeightAvailability();
    }, 500); // Small delay to ensure buildings are fully loaded
}


export function createPolygonMesh(polygonData, polygonIndex, recreateMarkers = true) {
    const points = polygonData.coordinates;
    if (points.length < 3) return;
    
    // Try with and without prefix
    let baseHeight = 0;
    
    // Try original polygonIndex
    if (state.baseHeights[polygonIndex] !== undefined) {
        baseHeight = state.baseHeights[polygonIndex];
    } 
    // Try with p- prefix
    else if (polygonIndex.toString().startsWith('p-') === false && 
             state.baseHeights[`p-${polygonIndex}`] !== undefined) {
        baseHeight = state.baseHeights[`p-${polygonIndex}`];
    }
    // Try without p- prefix
    else if (polygonIndex.toString().startsWith('p-') && 
             state.baseHeights[polygonIndex.toString().substring(2)] !== undefined) {
        baseHeight = state.baseHeights[polygonIndex.toString().substring(2)];
    }
    // No height found
    else {
        // Get the default height from UI if possible
        const heightSlider = document.getElementById('wall-height');
        if (heightSlider && heightSlider.value) {
            baseHeight = parseFloat(heightSlider.value);
            
            // Save this height for future use
            state.baseHeights[polygonIndex] = baseHeight;
        } else {
            baseHeight = 10; 
            
            // Save this height for future use
            state.baseHeights[polygonIndex] = baseHeight;
        }
    }
    
    // Local points for 2D shape
    const localPoints = [];
    
    // 3D vertices (for the building)
    const vertices3D = [];
    
    // Process points
    for (let i = 0; i < points.length; i++) {
        const { x, z } = convertLatLngToLocal(points[i][0], points[i][1]);
        const key = `${x.toFixed(3)},${z.toFixed(3)}`;
        
        // Check if we have a height for this vertex
        let height = 0;
        
        // Create stable key to check for height
        const stableKey = createStableVertexKey(polygonIndex, i);
        
        if (state.stableVertexHeights[stableKey] !== undefined) {
            height = state.stableVertexHeights[stableKey];
        } else if (state.vertexHeights[key] !== undefined) {
            height = state.vertexHeights[key];
        }
        
        // Store vertex data
        vertices3D.push({
            x: x,
            z: z, 
            key: key,
            vertexIndex: i,
            polygonIndex: polygonIndex,
            height: height
        });
        
        // Store for 2D shape
        localPoints.push(new THREE.Vector2(x, z));
    }
    
    // Create roof geometry with proper triangulation for non-convex shapes
    const roofGeometry = new THREE.BufferGeometry();
    const roofPositions = [];
    
    // Add top vertices
    for (let i = 0; i < vertices3D.length; i++) {
        const v = vertices3D[i];
        // Add vertices at base height + vertex height
        roofPositions.push(v.x, baseHeight + v.height, v.z);
    }
    
    // Create a 2D shape for triangulation
    const shape = new THREE.Shape();
    if (vertices3D.length > 0) {
        shape.moveTo(vertices3D[0].x, vertices3D[0].z);
        for (let i = 1; i < vertices3D.length; i++) {
            shape.lineTo(vertices3D[i].x, vertices3D[i].z);
        }
        shape.closePath();
    }
    
    const roofIndices = THREE.ShapeUtils.triangulateShape(
        vertices3D.map(v => new THREE.Vector2(v.x, v.z)),
        []
    );
    
    // Flatten the indices array since triangulateShape returns an array of arrays
    const flattenedIndices = [];
    for (let i = 0; i < roofIndices.length; i++) {
        flattenedIndices.push(roofIndices[i][0], roofIndices[i][1], roofIndices[i][2]);
    }
    
    roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
    roofGeometry.setIndex(flattenedIndices);
    roofGeometry.computeVertexNormals();
    
    // Wall geometry - create walls from the roof down to ground
    const wallGeometry = new THREE.BufferGeometry();
    const wallPositions = [];
    const wallIndices = [];
    
    // Create wall vertices (two triangles per wall segment)
    let wallIndex = 0;
    for (let i = 0; i < vertices3D.length; i++) {
        const v = vertices3D[i];
        const nextIdx = (i + 1) % vertices3D.length;
        const nextV = vertices3D[nextIdx];
        
        // Current vertex at roof height
        const topLeft = new THREE.Vector3(v.x, baseHeight + v.height, v.z);
        // Current vertex at ground level
        const bottomLeft = new THREE.Vector3(v.x, 0, v.z);
        // Next vertex at roof height
        const topRight = new THREE.Vector3(nextV.x, baseHeight + nextV.height, nextV.z);
        // Next vertex at ground level
        const bottomRight = new THREE.Vector3(nextV.x, 0, nextV.z);
        
        // Add vertices
        wallPositions.push(
            topLeft.x, topLeft.y, topLeft.z,
            bottomLeft.x, bottomLeft.y, bottomLeft.z,
            topRight.x, topRight.y, topRight.z,
            bottomRight.x, bottomRight.y, bottomRight.z
        );
        
        // Add indices for two triangles
        wallIndices.push(
            wallIndex, wallIndex + 1, wallIndex + 2,
            wallIndex + 1, wallIndex + 3, wallIndex + 2
        );
        
        wallIndex += 4;
    }
    
    // Set the attributes
    wallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
    wallGeometry.setIndex(wallIndices);
    wallGeometry.computeVertexNormals();
    
    // Create materials
    const roofMaterial = new THREE.MeshPhongMaterial({
        color: 0x2194ce,
        side: THREE.DoubleSide,
        flatShading: true,
    });

    if (state.showingEfficiencyColors) {
        roofMaterial.color.setHex(0x808080);
    }
    
    const wallMaterial = new THREE.MeshPhongMaterial({
        color: 0xd2b48c,
        side: THREE.DoubleSide,
        transparent: false,
        flatShading: false,
    });
    
    // Create separate meshes
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    
    // Group them together
    const buildingGroup = new THREE.Group();
    buildingGroup.add(roofMesh);
    buildingGroup.add(wallMesh);
    
    // Store the data we need
    buildingGroup.userData = {
        vertices3D: vertices3D,
        polygonIndex: polygonIndex,
        baseHeight: baseHeight,
        originalCoords: points
    };
    
    state.scene.add(buildingGroup);
    state.currentMeshes.push(buildingGroup);

    // Add vertex markers ONLY if requested
    if (recreateMarkers) {
        for (let i = 0; i < vertices3D.length; i++) {
            const v = vertices3D[i];
            const marker = createVertexMarker(v.x, baseHeight + v.height, v.z, v.key, i, polygonIndex);
            state.scene.add(marker);
            state.vertexMarkers.push(marker);
        }
    }

    // After creating roofMesh:
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;

    // After creating wallMesh:
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    // Create outlines
    createRoofOutline(vertices3D, baseHeight, polygonIndex);
    createWallOutlines(wallGeometry, baseHeight, polygonIndex);
    createBaseOutline(vertices3D, 0, polygonIndex);
}

export function updatePolygonGeometry(polygonIndex, recreateMarkers = false) {
    recreateMarkers = false;
    const mesh = state.currentMeshes.find(m => m.userData.polygonIndex === polygonIndex);
    if (!mesh) return;

    // Remove the old mesh
    state.scene.remove(mesh);
    state.currentMeshes = state.currentMeshes.filter(m => m !== mesh);
    
    // Remove old outlines
    const oldOutlines = state.currentOutlines.filter(o => 
        o.userData && o.userData.polygonIndex === polygonIndex
    );
    oldOutlines.forEach(outline => state.scene.remove(outline));
    state.currentOutlines = state.currentOutlines.filter(o => !oldOutlines.includes(o));
    
    // Remove old vertex markers for this specific polygon if needed
    if (recreateMarkers) {
        const oldMarkers = state.vertexMarkers.filter(marker => 
            marker.userData && marker.userData.polygonIndex === polygonIndex
        );
        oldMarkers.forEach(marker => {
            state.scene.remove(marker);
        });
        state.vertexMarkers = state.vertexMarkers.filter(marker => 
            !marker.userData || marker.userData.polygonIndex !== polygonIndex
        );
    }
    
    // Create new geometry with updated heights
    const polygonData = {
        coordinates: mesh.userData.originalCoords
    };
    
    createPolygonMesh(polygonData, polygonIndex, recreateMarkers);
}


export function updateBuildingHeights(height) {
    // Update base heights for all buildings
    const polygonIndices = new Set(state.currentMeshes.map(mesh => mesh.userData.polygonIndex));
    polygonIndices.forEach(polygonIndex => {
        state.baseHeights[polygonIndex] = height;
    });
    
    // Recreate all meshes with new base height
    if (state.currentMeshes.length > 0) {
        // Store current vertex heights
        const currentVertexHeights = {...state.vertexHeights};
        
        // Recreate all meshes
        const data = state.currentMeshes.map(mesh => ({
            polygonData: { coordinates: mesh.userData.originalCoords },
            polygonIndex: mesh.userData.polygonIndex
        }));
        
        // Clear and rebuild
        state.currentMeshes.forEach(mesh => state.scene.remove(mesh));
        state.currentOutlines.forEach(outline => state.scene.remove(outline));
        clearVertexMarkers();
        
        // Clear all solar panels
        clearExistingPanels();
        
        // Reset selected roof indices
        if (state.solarPanel) {
            state.solarPanel.selectedRoofIndices = [];
        }
        
        state.currentMeshes = [];
        state.currentOutlines = [];
        state.vertexHeights = currentVertexHeights; // Preserve vertex heights
        
        data.forEach(item => createPolygonMesh(item.polygonData, item.polygonIndex));
        
        // Save each polygon's data individually
        polygonIndices.forEach(polygonIndex => {
            saveRoofData(polygonIndex);
        });
    }
}

export function applyHeightData(forceUpdate = false) {
    // For each mesh, update its vertices based on height data
    state.currentMeshes.forEach(mesh => {
        const vertices3D = mesh.userData.vertices3D;
        const polygonIndex = mesh.userData.polygonIndex;
        
        // Check if any vertex heights need to be updated
        let needsUpdate = forceUpdate;
        
        const vertexSpatialIndex = {};
        const gridSize = 0.01; 
        
        // Index all vertex heights for fast lookup
        for (const key in state.vertexHeights) {
            if (state.vertexHeights[key] > 0) {
                const [x, z] = key.split(',').map(parseFloat);
                const cellX = Math.floor(x / gridSize);
                const cellZ = Math.floor(z / gridSize);
                
                // Add to grid cell and neighboring cells for better matching
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const cellKey = `${cellX + dx},${cellZ + dz}`;
                        if (!vertexSpatialIndex[cellKey]) {
                            vertexSpatialIndex[cellKey] = [];
                        }
                        vertexSpatialIndex[cellKey].push({
                            key,
                            height: state.vertexHeights[key],
                            x, z
                        });
                    }
                }
            }
        }
        
        // Now match vertices to their height data
        vertices3D.forEach(vertex => {
            const [vx, vz] = vertex.key.split(',').map(parseFloat);
            const cellX = Math.floor(vx / gridSize);
            const cellZ = Math.floor(vz / gridSize);
            const cellKey = `${cellX},${cellZ}`;
            
            // Look for a match in the spatial index
            const candidates = vertexSpatialIndex[cellKey] || [];
            let bestMatch = null;
            let bestDistance = 0.05;
            
            for (const candidate of candidates) {
                const dx = Math.abs(candidate.x - vx);
                const dz = Math.abs(candidate.z - vz);
                const distance = Math.sqrt(dx*dx + dz*dz);
                
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = candidate;
                }
            }
            
            if (bestMatch) {
                // Found a match - apply height
                const matchedHeight = bestMatch.height;
                vertex.height = matchedHeight;
                state.vertexHeights[vertex.key] = matchedHeight;
                
                needsUpdate = true;
            }
        });
        
        // If heights changed, recreate the mesh
        if (needsUpdate) {
            updatePolygonGeometry(polygonIndex, false); 
        }
    });
    
    // Update vertex marker positions to match heights
    state.vertexMarkers.forEach(marker => {
        if (marker.userData && marker.userData.key) {
            const key = marker.userData.key;
            const polygonIndex = marker.userData.polygonIndex;
            const baseHeight = state.baseHeights[polygonIndex] || 0;
            const vertexHeight = state.vertexHeights[key] || 0;
            
            // Update Y position to match height
            marker.position.y = baseHeight + vertexHeight;
        }
    });
}

// Helper function to clear all vertex markers
export function clearVertexMarkers() {
    state.vertexMarkers.forEach(marker => state.scene.remove(marker));
    state.vertexMarkers = [];
}

// Helper function to adjust camera to fit the scene
export function adjustCamera() {
    const maxDimension = Math.max(state.boundingBox.width, state.boundingBox.height);
    const cameraDistance = maxDimension * 1.5;
    state.camera.position.set(0, cameraDistance, 50);
    state.controls.target.set(0, 0, 0);
    state.controls.update();
}