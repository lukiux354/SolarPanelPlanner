import { state } from '../state.js';
import { calculateRoofNormal, calculateRoofCenter, calculateRoofAxes } from './roof_analysis.js';
import { projectVerticesToPlane, calculateBounds } from './geometry_utils.js';
import { calculatePanelGrid, placePanels } from './panel_placement.js';
import { clearExistingPanels } from './panel_model.js';

// Find optimal placement of panels on a roof
export function placePanelsOnRoof(roofIndex) {
    if (roofIndex === -1) return 0;
    
    // Clean up any existing panels
    clearExistingPanels();
    
    // Get the selected roof from the current meshes
    const roofMesh = state.currentMeshes.find(mesh => mesh.userData.polygonIndex === roofIndex);
    if (!roofMesh) return 0;
    
    const vertices3D = roofMesh.userData.vertices3D;
    const baseHeight = state.baseHeights[roofIndex] || 0;
    
    // 1. Calculate roof normal
    const normal = calculateRoofNormal(vertices3D, baseHeight);
    
    // 2. Create a reference point at the center of the roof
    const centerPoint = calculateRoofCenter(vertices3D, baseHeight);
    
    // 3. Determine principal axes for panel alignment
    const { xAxis, yAxis } = calculateRoofAxes(normal);
    
    // 4. Project vertices to the roof plane
    const projectedVertices = projectVerticesToPlane(vertices3D, baseHeight, normal, xAxis, yAxis, centerPoint);
    
    // 5. Calculate bounds of projected vertices
    const bounds = calculateBounds(projectedVertices);
    
    // 6. Create a grid of panels within the bounds
    const { positions, allPositions } = calculatePanelGrid(bounds, state.solarPanel);
    
    // 7. Place panels - pass projectedVertices for boundary checking
    const actualPanelCount = placePanels(
        positions, 
        normal, 
        xAxis, 
        yAxis, 
        centerPoint, 
        roofIndex, 
        projectedVertices, 
        allPositions
    );
    
    return actualPanelCount;
}


export function updatePanelsForSelectedRoof() {
    if (state.solarPanel.selectedRoofIndex !== -1) {
        return placePanelsOnRoof(state.solarPanel.selectedRoofIndex);
    }
    return 0;
}


// Reexport functions that need to be public
export { clearExistingPanels } from './panel_model.js';