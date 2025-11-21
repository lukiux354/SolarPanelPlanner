import * as THREE from 'three';
import { state } from '../state.js';

// Default as fallback (Lithuania average)
const DEFAULT_LATITUDE = 55.1694;
const DEFAULT_LONGITUDE = 23.8813;

export function getProjectCoordinates() {
    // Try to get coordinates from the first polygon if available
    for (const mesh of state.currentMeshes) {
        if (mesh.userData && mesh.userData.originalCoords && mesh.userData.originalCoords.length > 0) {
            const [latitude, longitude] = mesh.userData.originalCoords[0];
            if (isValidCoordinate(latitude, longitude)) {
                return { latitude, longitude };
            }
        }
    }
    
    // Fallback to default coordinates
    return { latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE };
}

function isValidCoordinate(lat, lng) {
    return lat !== undefined && 
           lng !== undefined && 
           !isNaN(lat) && 
           !isNaN(lng) &&
           lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180;
}

export function calculateRoofSolarEfficiency(normal, options = {}) {
    const projectCoords = getProjectCoordinates();
    const latitude = options.latitude || projectCoords.latitude;
    const longitude = options.longitude || projectCoords.longitude;
    
    const upVector = new THREE.Vector3(0, 1, 0);
    const tiltRadians = Math.acos(normal.dot(upVector));
    const tiltAngle = THREE.MathUtils.radToDeg(tiltRadians);
    
    const normalHorizontal = new THREE.Vector3(normal.x, 0, normal.z).normalize();
    normalHorizontal.multiplyScalar(-1);
    
    const northVector = new THREE.Vector3(0, 0, 1);
    
    let azimuthRadians = Math.acos(northVector.dot(normalHorizontal));
    if (normalHorizontal.x > 0) {
        azimuthRadians = 2 * Math.PI - azimuthRadians;
    }
    
    const azimuthAngle = THREE.MathUtils.radToDeg(azimuthRadians);
    
    // Calculate optimal tilt angle for the latitude
    const optimalTilt = latitude;
    
    // Optimal azimuth is 180° (south) in northern hemisphere
    const optimalAzimuth = latitude > 0 ? 180 : 0;
    
    // Calculate deviations and efficiency
    const tiltDeviation = Math.abs(tiltAngle - optimalTilt);
    let azimuthDeviation = Math.abs(azimuthAngle - optimalAzimuth);
    if (azimuthDeviation > 180) azimuthDeviation = 360 - azimuthDeviation;
    
    const tiltFactor = Math.cos(THREE.MathUtils.degToRad(tiltDeviation));
    const azimuthFactor = Math.cos(THREE.MathUtils.degToRad(azimuthDeviation * 0.8));
    
    // Combined efficiency (weighted average with orientation being slightly more important)
    let efficiency = ((tiltFactor * 0.45) + (azimuthFactor * 0.55)) * 100;
    
    // Add minimum bound to ensure efficiency is never below 1%
    efficiency = Math.max(1, efficiency);
    
    return {
        tiltAngle,
        azimuthAngle,
        optimalTilt,
        optimalAzimuth,
        tiltDeviation,
        azimuthDeviation,
        efficiency,
        isFlat: tiltAngle < 5,
        facing: getFacingDirection(azimuthAngle),
        location: { latitude, longitude }
    };
}

function getFacingDirection(azimuth) {
    const directions = [
        "North", "North-Northeast", "Northeast", "East-Northeast", 
        "East", "East-Southeast", "Southeast", "South-Southeast",
        "South", "South-Southwest", "Southwest", "West-Southwest", 
        "West", "West-Northwest", "Northwest", "North-Northwest"
    ];
    
    // Convert azimuth to 0-15 index (each direction covers 22.5 degrees)
    const index = Math.round(azimuth / 22.5) % 16;
    return directions[index];
}