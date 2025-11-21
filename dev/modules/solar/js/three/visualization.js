import * as THREE from 'three';
import { state } from './state.js';

export function addGroundPlane() {
    // Create a ground plane for visualization
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4CAF50, 
        side: THREE.DoubleSide,
        transparent: false, 
        opacity: 1.0,
        shininess: 10,
        specular: 0x333333
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    ground.castShadow = false;
    ground.name = "ground";
    
    ground.renderOrder = -1;
    
    state.scene.add(ground);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(1000, 100, 0x358634, 0x358634); 
    gridHelper.position.y = -0.04; 
    gridHelper.material.opacity = 0.25;
    gridHelper.material.transparent = true;
    gridHelper.name = "groundGrid";
    
    state.scene.add(gridHelper);
    
    return ground;
}

export function createHeightLabel(position, height, baseHeight) {

    const roofHeight = height - baseHeight;
    
    // Create canvas for text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 180;
    canvas.height = 40;
    
    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw text
    context.font = '20px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${roofHeight.toFixed(2)}m (${height.toFixed(2)}m)`, canvas.width/2, canvas.height/2);
    
    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
        map: texture,
        depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    
    // Position the label above the vertex
    sprite.position.copy(position);
    sprite.position.y += 2;
    
    sprite.scale.set(1.5, 0.5, 0.15);
    sprite.userData.baseScale = {x: 0.9, y: 0.3, z: 0.15}; 
    sprite.userData.isHeightLabel = true; 
    
    sprite.renderOrder = 2; 
    state.scene.add(sprite);
    
    updateLabelScale(sprite);
    
    return sprite;
}

export function updateLabelScale(label) {
    if (!state.camera || !label) return;
    
    const distance = state.camera.position.distanceTo(label.position);
    
    const heightAtDistance = 2 * Math.tan(THREE.MathUtils.degToRad(state.camera.fov / 2)) * distance;
    const scaleFactor = (100 / window.innerHeight) * heightAtDistance;
    
    // Apply the scale, using the baseScale values as reference
    const baseScale = label.userData.baseScale;
    label.scale.set(
        baseScale.x * scaleFactor,
        baseScale.y * scaleFactor,
        baseScale.z * scaleFactor
    );
}

// Update all height labels in the scene
export function updateAllLabelScales() {
    if (!state.scene) return;
    
    // Find all sprites that are height labels
    state.scene.traverse(object => {
        if (object instanceof THREE.Sprite && object.userData.isHeightLabel) {
            updateLabelScale(object);
        }
    });
}

export function createRoofOutline(vertices3D, baseHeight, polygonIndex) {
    const points = [];
    for (let i = 0; i < vertices3D.length; i++) {
        const v = vertices3D[i];
        points.push(new THREE.Vector3(v.x, baseHeight + v.height, v.z));
    }
    const first = vertices3D[0];
    points.push(new THREE.Vector3(first.x, baseHeight + first.height, first.z));
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
        color: 0x000000,
        linewidth: 1.5
    });
    
    const outline = new THREE.Line(geometry, material);
    outline.userData = { 
        polygonIndex: polygonIndex,
        isRoofOutline: true
    };
    
    state.scene.add(outline);
    state.currentOutlines.push(outline);
    
    return outline;
}

export function createWallOutlines(wallGeometry, baseHeight, polygonIndex) {
    const wallOutline = new THREE.LineSegments(
        new THREE.EdgesGeometry(wallGeometry),
        new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 1
        })
    );
    
    wallOutline.userData = { 
        polygonIndex: polygonIndex,
        isWallOutline: true
    };
    
    state.scene.add(wallOutline);
    state.currentOutlines.push(wallOutline);
    
    return wallOutline;
}

export function createBaseOutline(vertices3D, baseHeight, polygonIndex) {
    // Create a line geometry for the base outline
    const points = [];
    
    // Add all vertices at the base height
    for (let i = 0; i < vertices3D.length; i++) {
        const v = vertices3D[i];
        points.push(new THREE.Vector3(v.x, baseHeight, v.z));
    }
    
    // Close the loop
    const first = vertices3D[0];
    points.push(new THREE.Vector3(first.x, baseHeight, first.z));
    
    // Create geometry and material
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
        color: 0x000000,
        linewidth: 1
    });
    
    // Create the line
    const outline = new THREE.Line(geometry, material);
    outline.userData = { 
        polygonIndex: polygonIndex,
        isBaseOutline: true
    };
    
    state.scene.add(outline);
    state.currentOutlines.push(outline);
    
    return outline;
}

export function visualizeEdgeGroups() {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    
    Object.keys(state.edgeGroups).forEach((groupId, index) => {
        const color = colors[index % colors.length];
        const vertices = state.edgeGroups[groupId];
        
        vertices.forEach(key => {
            state.vertexMarkers.forEach(marker => {
                if (marker.userData.key === key) {
                    marker.material.color.set(color);
                }
            });
        });
    });
}

export function updatePolygonOutline(mesh) {
    const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 15),
        new THREE.LineBasicMaterial({ 
            color: 0x000000,
            linewidth: 2
        })
    );
    
    outline.userData = { polygonIndex: mesh.userData.polygonIndex };
    state.scene.add(outline);
    state.currentOutlines.push(outline);
    
    return outline;
}