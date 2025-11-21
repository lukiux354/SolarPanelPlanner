import * as THREE from 'three';
import { state } from '../state.js';
import { updateSolarCalculations } from '../ui.js';

export function createSolarPanelMesh() {
    const { width, height, thickness } = state.solarPanel;
    
    const geometry = new THREE.BoxGeometry(width, thickness, height);
    
    const frameMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x303030,     // Dark  frame
        shininess: 100,
        specular: 0x555555,  // Light reflections
    });
    
    const panelMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x0a1a3f,     // Deep blue panel
        metalness: 0.7,
        roughness: 0.2,
        opacity: 0.98,
        transparent: true,
        reflectivity: 0.7,  
        clearcoat: 0.3,   
        clearcoatRoughness: 0.1
    });
    
    // Create the panel with grid texture
    const materials = [
        frameMaterial, // Right side
        frameMaterial, // Left side
        frameMaterial, // Top edge
        frameMaterial, // Bottom edge
        panelMaterial, // Front face (solar cells)
        panelMaterial  // Back face
    ];
    
    // Create the mesh
    const panel = new THREE.Mesh(geometry, materials);
    
    return panel;
}


// Clear any existing panels
export function clearExistingPanels() {
    state.solarPanel.panels.forEach(panel => {
        state.scene.remove(panel);
    });
    
    state.solarPanel.panels = [];

    updateSolarCalculations();
}