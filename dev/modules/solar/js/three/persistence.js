import { getCSRFToken } from '../api.js';
import { state } from './state.js';
import { createPolygonMesh, createStableVertexKey } from './buildings.js';
import { getCurrentProjectId } from '../project_panel.js';

//prevents multiple fast calls
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, wait);
    };
}

function _saveAllRoofData() {
    const projectId = getCurrentProjectId();
    
    if (!projectId) {
        console.error("No project selected");
        return;
    }
    
    const allHeightData = {
        polygons: {}
    };
    
    state.currentMeshes.forEach(mesh => {
        if (!mesh.userData.polygonIndex) return;
        
        const polygonId = mesh.userData.polygonIndex;
        const baseHeight = state.baseHeights[polygonId] || 0;
        
        const heightData = {
            baseHeight: baseHeight,
            vertexHeights: {},
            stableVertexHeights: {}
        };
        
        const vertices3D = mesh.userData.vertices3D || [];
        if (vertices3D && vertices3D.length > 0) {
            vertices3D.forEach((vertex, idx) => {
                if (vertex) {
                    const stableKey = createStableVertexKey(polygonId, idx);
                    const height = state.stableVertexHeights[stableKey] || 0;
                    
                    heightData.vertexHeights[vertex.key] = height;
                    heightData.stableVertexHeights[stableKey] = height;
                }
            });
        }
        
        // Add to the complete data structure
        allHeightData.polygons[polygonId] = heightData;
    });
    
    fetch(`/solar/api/projects/${projectId}/update-all-heights/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFToken()
        },
        body: JSON.stringify(allHeightData)
    })
    .then(response => {
        if (!response.ok) {
            console.error(`Error saving heights: ${response.status}`);
            return response.text().then(text => {
                throw new Error(`Server error: ${text}`);
            });
        }
        return response.json();
    })
    .catch(error => console.error("Error saving heights:", error));
}

export const saveAllRoofData = debounce(_saveAllRoofData, 1000);

export function saveRoofData() {
    saveAllRoofData();
}

export function applyHeightData(forceUpdate = false) {
    state.currentMeshes.forEach(mesh => {
        const vertices3D = mesh.userData.vertices3D;
        const polygonIndex = mesh.userData.polygonIndex;
        
        let needsUpdate = forceUpdate; 
        
        vertices3D.forEach(vertex => {
            const key = vertex.key;
            
            if (state.vertexHeights[key] !== undefined) {
                vertex.height = state.vertexHeights[key];
                needsUpdate = true;
            } else {
                const [vx, vz] = key.split(',').map(parseFloat);
                const tolerance = 0.001;
                
                for (const storedKey in state.vertexHeights) {
                    const [sx, sz] = storedKey.split(',').map(parseFloat);
                    
                    if (Math.abs(vx - sx) < tolerance && Math.abs(vz - sz) < tolerance) {
                        vertex.height = state.vertexHeights[storedKey];
                        state.vertexHeights[key] = state.vertexHeights[storedKey];
                        needsUpdate = true;
                        break;
                    }
                }
            }
        });
        
        if (needsUpdate) {
            updatePolygonGeometry(polygonIndex, false);
        }
    });
    
    state.vertexMarkers.forEach(marker => {
        if (marker.userData && marker.userData.key) {
            const key = marker.userData.key;
            const polygonIndex = marker.userData.polygonIndex;
            const baseHeight = state.baseHeights[polygonIndex] || 0;
            const vertexHeight = state.vertexHeights[key] || 0;
            
            marker.position.y = baseHeight + vertexHeight;
        }
    });
}

function updatePolygonGeometry(polygonIndex) {
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
    
    const polygonData = {
        coordinates: mesh.userData.originalCoords
    };
    
    createPolygonMesh(polygonData, polygonIndex);
}