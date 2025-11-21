import * as THREE from 'three';
import { state } from './state.js';

// Convert lat/lng to local coordinates
export function convertLatLngToLocal(lat, lng) {
    if (!state.referencePoint) return { x: 0, z: 0 };

    const from = new window.google.maps.LatLng(state.referencePoint.lat, state.referencePoint.lng);
    const to = new window.google.maps.LatLng(lat, lng);
    const distance = window.google.maps.geometry.spherical.computeDistanceBetween(from, to);
    let heading = window.google.maps.geometry.spherical.computeHeading(from, to);
    
    // Convert heading to radians
    const angle = THREE.MathUtils.degToRad(heading);
    
    //East corresponds to +X in THREE.js
    //North corresponds to -Z in THREE.js
    return {
        x: distance * Math.sin(angle),
        z: -distance * Math.cos(angle)
    };
}

// Calculate bounding box for a set of polygons
export function calculateBoundingBox(polygonsData) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    polygonsData.forEach(polygonData => {
        polygonData.coordinates.forEach(coord => {
            const [lat, lng] = coord;
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
        });
    });

    return {
        minLat, maxLat, minLng, maxLng,
        center: {
            lat: (minLat + maxLat) / 2,
            lng: (minLng + maxLng) / 2
        },
        width: window.google.maps.geometry.spherical.computeDistanceBetween(
            new window.google.maps.LatLng(minLat, minLng),
            new window.google.maps.LatLng(minLat, maxLng)
        ),
        height: window.google.maps.geometry.spherical.computeDistanceBetween(
            new window.google.maps.LatLng(minLat, minLng),
            new window.google.maps.LatLng(maxLat, minLng)
        )
    };
}

// Merge multiple buffer geometries into one
export function mergeBufferGeometries(geometries) {
    let vertexCount = 0;
    let indexCount = 0;
    
    // Count total vertices and indices
    for (let i = 0; i < geometries.length; i++) {
        const geo = geometries[i];
        vertexCount += geo.attributes.position.count;
        if (geo.index) indexCount += geo.index.count;
    }
    
    // Create merged geometry
    const mergedGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(indexCount);
    
    let positionOffset = 0;
    let indexOffset = 0;
    let currentIndex = 0;
    
    // Merge all geometries
    for (let i = 0; i < geometries.length; i++) {
        const geo = geometries[i];
        const posArray = geo.attributes.position.array;
        
        // Copy positions
        for (let j = 0; j < posArray.length; j++) {
            positions[positionOffset + j] = posArray[j];
        }
        
        // Copy and adjust indices
        if (geo.index) {
            const indexArray = geo.index.array;
            for (let j = 0; j < indexArray.length; j++) {
                indices[indexOffset + j] = indexArray[j] + currentIndex;
            }
            indexOffset += indexArray.length;
        }
        
        positionOffset += posArray.length;
        currentIndex += geo.attributes.position.count;
    }
    
    // Set attributes
    mergedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    mergedGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    mergedGeometry.computeVertexNormals();
    
    return mergedGeometry;
}

// Find a complete edge that includes the given vertex
export function findCompleteEdge(startKey) {
    const edgeVertices = [startKey];
    const visited = new Set([startKey]);
    
    // Get the position of the starting vertex
    const startPos = state.uniqueVertices[startKey].position;
    
    // Find vertices on the same line
    for (const key in state.uniqueVertices) {
        if (key === startKey || visited.has(key)) continue;
        
        const pos = state.uniqueVertices[key].position;
        
        // Check if this vertex forms a straight line with the start vertex
        const dx = Math.abs(pos.x - startPos.x);
        const dz = Math.abs(pos.z - startPos.z);
        
        // If the vertex lies on the same X or Z line (within a small tolerance)
        if (dx < 0.001 || dz < 0.001) {
            edgeVertices.push(key);
            visited.add(key);
        }
    }
    
    return edgeVertices;
}