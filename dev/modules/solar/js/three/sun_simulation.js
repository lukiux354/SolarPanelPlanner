import * as THREE from 'three';
import { state } from './state.js';
import { toggleShadows } from './shadows.js';

// Default location
const defaultLocation = {
    latitude: 54.687157, // Vilnius, Lithuania
    longitude: 25.279652
};

// Sun state
const sunState = {
    light: null,
    sphere: null,
    helper: null,
    date: new Date(),
    location: { ...defaultLocation },
    showSunHelper: false,
    sunIntensity: 5.0,
    distance: 300, // distance of sun from center for visualization
    autoMovement: false,
    animationId: null,
    timeSpeed: 10,
};

/**
 * Initialize sun simulation
 */
export function initSunSimulation() {
    // Create sun directional light
    sunState.light = new THREE.DirectionalLight(0xffffaa, sunState.sunIntensity);
    sunState.light.name = "sunLight";
    
    // Configure shadow properties
    sunState.light.castShadow = true;
    sunState.light.shadow.mapSize.width = 2048;
    sunState.light.shadow.mapSize.height = 2048;
    sunState.light.shadow.camera.near = 0.1;
    sunState.light.shadow.camera.far = 500;
    sunState.light.shadow.camera.left = -100;
    sunState.light.shadow.camera.right = 100;
    sunState.light.shadow.camera.top = 100;
    sunState.light.shadow.camera.bottom = -100;
    sunState.light.shadow.bias = -0.001;
    
    // Create helper to visualize light direction
    sunState.helper = new THREE.DirectionalLightHelper(sunState.light, 5);
    if (sunState.showSunHelper) {
        state.scene.add(sunState.helper);
    }
    
    // Add light to scene
    state.scene.add(sunState.light);
    
    // Set initial sun position
    updateSunPosition();
    
    // No longer create separate UI controls - they're now in the Solar Panel Designer
    // Enable shadows for all objects
    toggleShadows(true);

    if (sunState.autoMovement) {
        toggleAutoMovement(true);
    }
    
    // Make sunState and updateSunPosition accessible globally for the UI
    window.sunState = sunState;
    window.updateSunPosition = updateSunPosition;
    window.toggleAutoMovement = toggleAutoMovement;
}

//Based on PSA algorithm (Plataforma Solar de Almería)
function calculateSunPosition(date, latitude, longitude) {
    // Convert latitude & longitude to radians
    const lat = latitude * Math.PI / 180;
    
    // Get day of year (1-365)
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    // Get decimal hour (0-24)
    const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    
    // Calculate fractional year in radians
    const gamma = 2 * Math.PI / 365 * (dayOfYear - 1 + (hour - 12) / 24);
    
    // Calculate equation of time (in minutes)
    const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) 
                     - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    
    // Calculate solar declination angle (in radians)
    const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) 
                        - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) 
                        - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
    
    // Calculate time offset (in minutes)
    const timeOffset = eqTime - 4 * longitude + 60 * date.getTimezoneOffset() / 60;
    
    // Calculate true solar time (in minutes)
    let trueSolarTime = hour * 60 + timeOffset;
    while (trueSolarTime > 1440) trueSolarTime -= 1440;
    while (trueSolarTime < 0) trueSolarTime += 1440;
    
    // Calculate hour angle (in radians)
    const hourAngle = Math.PI * ((trueSolarTime / 4) - 180) / 180;
    
    // Calculate solar zenith angle (in radians)
    const cosZenith = Math.sin(lat) * Math.sin(declination) + 
                     Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
    const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
    
    // Calculate solar elevation
    const elevation = Math.PI/2 - zenith;
    
    // Calculate solar azimuth (in radians)
    // Method that avoids ambiguities in arcsin and arccos functions
    let azimuth;
    const azDenom = Math.cos(lat) * Math.sin(zenith);
    
    if (Math.abs(azDenom) > 0.001) {
        const azRaw = ((Math.sin(lat) * Math.cos(zenith)) - Math.sin(declination)) / azDenom;
        const azimuthTemp = Math.acos(Math.max(-1, Math.min(1, azRaw)));
        azimuth = (hourAngle > 0) ? azimuthTemp : (2 * Math.PI - azimuthTemp);
    } else {
        // For edge cases (sun directly overhead or at poles)
        azimuth = (lat >= 0) ? Math.PI : 0;
    }
    
    return {
        elevation: elevation,
        azimuth: azimuth
    };
}

function updateSunPosition() {
    // Calculate sun position
    const { elevation, azimuth } = calculateSunPosition(
        sunState.date,
        sunState.location.latitude,
        sunState.location.longitude
    );
    
    const correctedAzimuth = 2 * Math.PI - azimuth;
    
    // First ensure elevation is not negative (sun not below horizon)
    const safeElevation = Math.max(0.01, elevation);
    
    // Use the corrected azimuth for proper clockwise movement
    const x = sunState.distance * Math.cos(safeElevation) * Math.sin(correctedAzimuth);
    const y = sunState.distance * Math.sin(safeElevation);
    const z = sunState.distance * Math.cos(safeElevation) * Math.cos(correctedAzimuth);
    
    // Update directional light position and target
    if (sunState.light) {
        sunState.light.position.set(x, y, z);
        sunState.light.target.position.set(0, 0, 0);
        
        if (elevation <= 0) {
            // Sun is below horizon
            sunState.light.intensity = 0;
        } else {
            // Sun is above horizon
            const normalizedElevation = Math.sin(elevation);
            sunState.light.intensity = sunState.sunIntensity * Math.pow(normalizedElevation, 0.5);
            
            // Change light color based on elevation
            if (elevation < 0.2) {
                const t = elevation / 0.2;
                const r = 1;
                const g = 0.5 + 0.5 * t;
                const b = 0.2 + 0.8 * t;
                sunState.light.color.setRGB(r, g, b);
            } else {
                sunState.light.color.set(0xffffff);
            }
            
            if (sunState.light.shadow && sunState.light.shadow.camera) {
                const shadowDistance = 100 + Math.max(0, 100 * (1 - normalizedElevation));
                sunState.light.shadow.camera.left = -shadowDistance;
                sunState.light.shadow.camera.right = shadowDistance;
                sunState.light.shadow.camera.top = shadowDistance;
                sunState.light.shadow.camera.bottom = -shadowDistance;
                sunState.light.shadow.camera.updateProjectionMatrix();
            }
        }
    }
    
    if (sunState.helper) {
        sunState.helper.update();
    }
}

// Helper functions for date handling
function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function formatDate(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

export function setLocation(latitude, longitude) {
    sunState.location.latitude = latitude;
    sunState.location.longitude = longitude;
    updateSunPosition();
}

export function enableShadows() {
    state.scene.traverse(object => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });
}

function updateSunAnimationFrame() {
    if (!sunState.autoMovement) {
        sunState.animationId = null;
        return;
    }
    
    // Calculate time delta (milliseconds)
    const now = performance.now();
    const lastTime = sunState._lastTime || now;
    const delta = now - lastTime;
    sunState._lastTime = now;
    
    // Make the time changes more significant for visual feedback
    const effectiveDelta = Math.max(delta, 100);
    
    // Convert delta to minutes based on speed setting
    const minutesElapsed = (effectiveDelta / 1000) * sunState.timeSpeed;
    
    // Update the date
    const currentDate = sunState.date;
    const currentMinutes = currentDate.getMinutes();
    const currentHours = currentDate.getHours();
    
    // Add minutes to the current time
    let newMinutes = currentMinutes + minutesElapsed;
    let newHours = currentHours;
    
    // Handle minute overflow
    if (newMinutes >= 60) {
        newHours += Math.floor(newMinutes / 60);
        newMinutes = newMinutes % 60;
        
        // Handle hour overflow - move to next day
        if (newHours >= 24) {
            const daysToAdd = Math.floor(newHours / 24);
            newHours = newHours % 24;
            
            // Add days to the date
            const newDate = new Date(currentDate);
            newDate.setDate(currentDate.getDate() + daysToAdd);
            newDate.setHours(newHours, newMinutes, currentDate.getSeconds());
            sunState.date = newDate;
            
            // Update date display and slider
            const dateDisplay = document.getElementById('date-display');
            if (dateDisplay) {
                dateDisplay.textContent = formatDate(sunState.date);
            }
            
            const dateSlider = document.querySelector('.sun-controls input[type="range"]:first-of-type');
            if (dateSlider) {
                dateSlider.value = getDayOfYear(sunState.date);
            }
        } else {
            // Just update hours and minutes
            currentDate.setHours(newHours, newMinutes);
        }
    } else {
        // Just update minutes
        currentDate.setMinutes(newMinutes);
    }
    
    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) {
        timeDisplay.textContent = formatTime(sunState.date);
    }
    
    const timeSlider = document.querySelector('input[type="range"][min="0"][max="1440"]');

    if (timeSlider) {
        timeSlider.classList.add('auto-moving');
        
        timeSlider.value = sunState.date.getHours() * 60 + sunState.date.getMinutes();
        
        timeSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    updateSunPosition();
    
    if (state.requestRender) {
        state.requestRender();
    } else if (state.renderer && state.camera) {
        state.renderer.render(state.scene, state.camera);
    }
    
    // Continue animation loop
    sunState.animationId = requestAnimationFrame(updateSunAnimationFrame);
}

function toggleAutoMovement(enabled) {
    sunState.autoMovement = enabled;
    
    if (enabled && !sunState.animationId) {
        // Start animation
        sunState._lastTime = performance.now();
        sunState.animationId = requestAnimationFrame(updateSunAnimationFrame);
    }
}

export function cleanupSunSimulation() {
    // Stop any running animation
    if (sunState.animationId) {
        cancelAnimationFrame(sunState.animationId);
        sunState.animationId = null;
    }
    
    sunState.autoMovement = false;
    
    // Clean up references
    if (sunState.helper && sunState.helper.parent) {
        sunState.helper.parent.remove(sunState.helper);
    }
    
    if (sunState.light && sunState.light.parent) {
        sunState.light.parent.remove(sunState.light);
    }
    
    // Reset state
    sunState.helper = null;
    sunState.light = null;
    sunState.sphere = null;
}