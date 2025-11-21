import * as THREE from 'three';

export const state = {
    // Core ThreeJS objects
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    
    // Meshes and visuals
    currentMeshes: [],
    currentOutlines: [],
    vertexMarkers: [],
    
    // Reference points and coordinates
    referencePoint: null,
    boundingBox: null,
    
    // Height data
    vertexHeights: {},
    baseHeights: {},
    
    // Vertex grouping and management
    uniqueVertices: {},
    edgeGroups: {},
    interiorVertices: new Set(),
    
    // Interaction state
    selectedVertex: null,
    hoveredVertex: null,
    isDragging: false,
    heightLabel: null,
    isSnapToVertexEnabled: true,
    snapIncrement: 0.05, // 5cm snapping
    isEdgeGroupModeEnabled: false,
    
    // Raycasting
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    dragPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    
    // Save timeout
    saveTimeout: null,

    // Flag for checking if in solar efficiency visual mode
    showingEfficiencyColors: false,

    areVerticesSeparated: false,

    stableVertexHeights: {}, // Heights stored by stable IDs

    locationToStableKeys: {}, // Maps location keys to arrays of stable keys
    stableKeyToLocation: {}, // Maps stable keys to their location keys

    //default solar panel
    solarPanel: {
        // Panel identification
        id: 'default',
        name: 'Default Panel',
        
        // Physical dimensions
        width: 1.7,         // meters - typical panel width
        height: 1.0,        // meters - typical panel height
        thickness: 0.04,    // panel thickness in meters
        spacing: 0.15,      // gap between panels in meters
        isVerticalOrientation: false,
        
        // Financial properties
        cost: 350,          // euros per panel (average cost)
        
        // Power specifications
        power: {
            wattage: 400,   // peak power in watts (W)
            voltage: 40,     // operating voltage (V)
            current: 10,     // operating current (A)
            efficiency: 20,  // efficiency percentage (%)
        },
        
        // Project constraints
        maxBudget: 0,   // maximum budget in euros
        targetPower: 10000,  // target power output in watts
        
        // Panel tracking
        selectedRoofIndices: [],
        panels: [],           // will store all placed panel objects

        priorityMode: 'none', // 'budget', 'power', or 'none'
        isPowerConstrained: false,
        isBudgetConstrained: false,
        totalPanelsFit: 0,
        totalMaxPanelsFit: 0,
        isLimitedByRoof: false,

    }
};