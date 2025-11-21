import * as THREE from 'three';
import { state } from './state.js';
import { createStableVertexKey } from './buildings.js';


// Base size of the markers 
const MARKER_BASE_SIZE = 0.5;
const MARKER_PIXEL_SIZE = 12;

export const MARKER_COLOR = 0x66b2b2;

export function createVertexMarker(x, y, z, key, vertexIndex, polygonIndex) {

    const stableKey = createStableVertexKey(polygonIndex, vertexIndex);
    
    const marker = new THREE.Mesh(
        new THREE.SphereGeometry(MARKER_BASE_SIZE, 16, 16),
        new THREE.MeshBasicMaterial({ 
            color: MARKER_COLOR,
            depthTest: false,
            transparent: true,
            opacity: 0.8
        })
    );
    
    marker.position.set(x, y, z);
    marker.userData = {
        isVertex: true,
        basePosition: new THREE.Vector3(x, 0, z),
        key: key,
        vertexIndex: vertexIndex,
        polygonIndex: polygonIndex,
        stableKey: stableKey
    };
    
    marker.castShadow = false;
    marker.receiveShadow = false;
    marker.renderOrder = 999; 
    
    marker.isVertexMarker = true;
    marker.name = "vertexMarker";
    
    updateMarkerScale(marker);
    
    return marker;
}

export function clearVertexMarkers() {
    state.vertexMarkers.forEach(marker => state.scene.remove(marker));
    state.vertexMarkers = [];
}

export function updateAllMarkerScales() {
    if (!state.camera) return;
    
    state.vertexMarkers.forEach(marker => {
        updateMarkerScale(marker);
    });
}

function updateMarkerScale(marker) {
    if (!state.camera) return;
    
    const distance = state.camera.position.distanceTo(marker.position);
    
    const heightAtDistance = 2 * Math.tan(THREE.MathUtils.degToRad(state.camera.fov / 2)) * distance;
    const scale = (MARKER_PIXEL_SIZE / window.innerHeight) * heightAtDistance;
    
    marker.scale.set(scale, scale, scale);
}