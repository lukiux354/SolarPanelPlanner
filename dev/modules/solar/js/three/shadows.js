import * as THREE from 'three';
import { state } from './state.js';

export function toggleShadows(enabled = true) {
    if (!state.renderer) {
        console.error("Cannot toggle shadows: renderer not initialized");
        return false;
    }
    
    // Enable shadow rendering in the renderer
    state.renderer.shadowMap.enabled = enabled;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    
    let sunLight = null;
    state.scene.traverse(object => {
        if (object.isDirectionalLight && object.name === "sunLight") {
            sunLight = object;
        }
    });
    
    if (!sunLight) {
        console.warn("No sun light found for shadows");
    } else {
        sunLight.castShadow = enabled;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;
        sunLight.shadow.bias = -0.001;
    }
    
    let ground = state.scene.getObjectByName("ground");
    if (ground) {
        ground.receiveShadow = enabled;
        ground.material.needsUpdate = true;
    }
    
    state.scene.traverse(object => {
        if (object.isLight) {

            if (object === sunLight) {
                object.castShadow = enabled; 
            } else {
                object.castShadow = false;
            }
        } 

        else if (object.isVertexMarker || 
                 object.name === "vertexMarker" || 
                 (object.userData && object.userData.isVertex === true)) {
            object.castShadow = false;
            object.receiveShadow = false;
            

            if (object.material) {
                object.material.needsUpdate = true;
            }
        }

        else if (object.isMesh && object !== ground) {
            object.castShadow = enabled;
            object.receiveShadow = enabled;
            
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => {
                        mat.needsUpdate = true;
                    });
                } else {
                    object.material.needsUpdate = true;
                }
            }
        }
    });

    return true;
}

function addShadowCameraHelper(camera) {
    state.scene.traverse(obj => {
        if (obj.name === "shadowCameraHelper") {
            state.scene.remove(obj);
        }
    });
    
    const helper = new THREE.CameraHelper(camera);
    helper.name = "shadowCameraHelper";
    state.scene.add(helper);
}

export function setupShadowControls() {
    const container = document.createElement('div');
    container.className = 'shadow-controls';
    container.style.position = 'absolute';
    container.style.bottom = '10px';
    container.style.left = '10px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    container.style.borderRadius = '5px';
    container.style.padding = '10px';
    container.style.color = 'white';
    container.style.zIndex = '10';
    
    const shadowToggle = document.createElement('label');
    shadowToggle.style.display = 'flex';
    shadowToggle.style.alignItems = 'center';
    shadowToggle.style.cursor = 'pointer';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false;
    checkbox.style.marginRight = '8px';
    
    checkbox.addEventListener('change', (e) => {
        toggleShadows(e.target.checked);
    });
    
    shadowToggle.appendChild(checkbox);
    shadowToggle.appendChild(document.createTextNode('Enable Shadows'));
    
    container.appendChild(shadowToggle);
    
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug Shadows';
    debugButton.style.display = 'block';
    debugButton.style.marginTop = '8px';
    debugButton.style.padding = '4px 8px';
    
    debugButton.addEventListener('click', () => {  
        const lights = [];
        state.scene.traverse(obj => {
            if (obj.isLight) lights.push(obj);
        });
        
        const meshes = [];
        state.scene.traverse(obj => {
            if (obj.isMesh) meshes.push(obj);
        });
        
        console.table(meshes.map(m => ({ 
            name: m.name || 'unnamed', 
            castShadow: m.castShadow, 
            receiveShadow: m.receiveShadow,
            material: m.material ? m.material.type : 'none'
        })));
        
        let sunLight = null;
        state.scene.traverse(object => {
            if (object.isDirectionalLight && !object.isAmbientLight) {
                sunLight = object;
            }
        });
        
        if (sunLight) {
            addShadowCameraHelper(sunLight.shadow.camera);
            setTimeout(() => {
                state.scene.traverse(obj => {
                    if (obj.name === "shadowCameraHelper") {
                        state.scene.remove(obj);
                    }
                });
            }, 10000);
        }
    });
    
    container.appendChild(debugButton);
    
    const threeContainer = document.getElementById('three-container');
    if (threeContainer) {
        threeContainer.appendChild(container);
    } else {
        console.warn("Could not find #three-container for shadow controls");
        document.body.appendChild(container);
    }
    
    return container;
}