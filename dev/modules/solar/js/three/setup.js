import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { state } from './state.js';
import { setupMouseEvents } from './interaction.js';
import { setupWallControls, setupSolarPanelControls, setupSolarBudgetControls } from './ui.js';
import { addGroundPlane,updateAllLabelScales } from './visualization.js';
import { initSunSimulation } from './sun_simulation.js';
import { updateAllMarkerScales } from './vertices.js';

export function initThreeJS() {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    state.scene = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / 2 / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 100, 50);
    state.camera = camera;

    // Initialize raycaster
    state.raycaster = new THREE.Raycaster();
    state.mouse = new THREE.Vector2();
    state.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Get the container element
    const threeContainer = document.getElementById('three-container');

    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
    state.renderer.setClearColor(0x87CEEB);
    
    // Enable shadows in the renderer
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    
    // Append the renderer to the DOM
    threeContainer.appendChild(state.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x707070);
    state.scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight1.position.set(100, 100, 100);
    directionalLight1.castShadow = true;
    directionalLight1.shadow.mapSize.width = 2048;
    directionalLight1.shadow.mapSize.height = 2048;
    directionalLight1.shadow.camera.near = 1;
    directionalLight1.shadow.camera.far = 500;
    directionalLight1.shadow.camera.left = -100;
    directionalLight1.shadow.camera.right = 100;
    directionalLight1.shadow.camera.top = 100;
    directionalLight1.shadow.camera.bottom = -100;
    directionalLight1.shadow.bias = -0.001;
    state.scene.add(directionalLight1);
    
    // Controls
    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.5;
    state.controls.screenSpacePanning = true;

    // After creating controls, add the event listener
    state.controls.addEventListener('change', () => {
        // Update vertex markers
        updateAllMarkerScales();
        
        // Update height labels
        updateAllLabelScales();
    });
    
    // Also update on window resize
    window.addEventListener('resize', () => {
        updateAllMarkerScales();
        updateAllLabelScales();
    });
    
    // Initial update
    updateAllMarkerScales();
    
    // Setup events and controls
    setupMouseEvents();
    setupWallControls();
    setupSolarPanelControls();
    setupSolarBudgetControls();

    window.addEventListener('resize', onWindowResize, false);
    
    // Add ground plane
    addGroundPlane();

    // Sun simulation
    initSunSimulation();
    
    animate();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    state.controls.update();
    state.renderer.render(state.scene, state.camera);
}

// Window resize handler
function onWindowResize() {
    const threeContainer = document.getElementById('three-container');
    
    if (threeContainer.offsetParent !== null) {
        const width = threeContainer.clientWidth;
        const height = threeContainer.clientHeight;
        
        state.camera.aspect = width / height;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(width, height);
    }
}

// Getter functions for external use
export function getRenderer() {
    return state.renderer;
}

export function getCamera() {
    return state.camera;
}