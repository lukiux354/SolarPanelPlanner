import { state } from './state.js';
import { updateWallHeightControls, updateSolarCalculations } from './ui.js';
import { updateBuildingHeights } from './buildings.js';
import { saveAllRoofData } from './persistence.js';

// Fetch building height from OpenStreetMap data
export async function fetchOSMBuildingHeight() {
    // Check if we have any buildings
    if (state.currentMeshes.length === 0) {
        showNotification('No buildings available to fetch height for', 'warning');
        return;
    }
    
    // Get button
    const button = getButtonByText("Auto Detect Height");
    let originalText = '';
    
    if (button) {
        originalText = button.textContent;
        button.textContent = 'Applying...';
        button.disabled = true;
    }
    
    try {
        // Check if we already have cached height data
        if (state.fetchedOSMHeightData && state.fetchedOSMHeightData.height > 0) {
            const heightData = state.fetchedOSMHeightData;
            
            const selectedRoofIndices = [...state.solarPanel.selectedRoofIndices];
            
            state.solarPanel.selectedRoofIndices = [];
            state.solarPanel.isBudgetConstrained = false;
            state.solarPanel.isPowerConstrained = false;
            state.solarPanel.isLimitedByRoof = false;
            state.solarPanel.totalPanelsFit = 0;
            state.solarPanel.totalMaxPanelsFit = 0;
            
            updateSolarCalculations();
            
            for (const roofIndex of selectedRoofIndices) {
                const roofMesh = state.currentMeshes.find(mesh => mesh.userData.polygonIndex === roofIndex);
                if (roofMesh && roofMesh.userData.hasHighlight) {
                    roofMesh.userData.hasHighlight = false;
                }
            }
            
            // Clear all panels
            import('./solar_panel/panel_model.js')
                .then(module => {
                    module.clearExistingPanels();
                });
            
            // Update UI to reflect cleared state
            updateSolarCalculations();
            
            // Apply the cached height
            applyOSMHeight(heightData.height);
            showNotification(`Applied building height: ${heightData.height.toFixed(2)}m (${heightData.source})`, 'success');
            
            resetButton();
            return;
        }
        
        // If no cached data, new API call
        const coords = getBuildingCoordinates();
        
        if (!coords) {
            showNotification('Could not determine building coordinates', 'error');
            resetButton();
            return;
        }
    } catch (error) {
        console.error('Error fetching OSM height data:', error);
        showNotification('Failed to fetch building height data', 'error');
        resetButton();
    }
    
    function resetButton() {
        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
    }
}

function getBuildingCoordinates() {
    if (state.currentMeshes.length > 0) {
        const mesh = state.currentMeshes[0];
        
        if (mesh.userData && mesh.userData.originalCoords && mesh.userData.originalCoords.length > 0) {
            const [lat, lng] = mesh.userData.originalCoords[0];
            return { lat, lng };
        }
    }
    return null;
}

async function queryOSMBuildingData(lat, lng) {
    const radius = 0.0001; // ~10m 
    
    const bbox = {
        south: lat - radius,
        west: lng - radius,
        north: lat + radius,
        east: lng + radius
    };
    
    //Overpass API query
    const query = `
        [out:json];
        (
          way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          relation["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        );
        out body;
        >;
        out skel qt;
    `;
    
    // Encode the query for URL
    const encodedQuery = encodeURIComponent(query);
    
    // List of alternative Overpass API endpoints
    const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
    ];
    
    // Try each endpoint with retries
    let lastError = null;
    
    for (const baseUrl of endpoints) {
        // Try up to 2 times with this endpoint
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
                
                const url = `${baseUrl}?data=${encodedQuery}`;
                const response = await fetch(url, { timeout: 5000 });
                
                if (!response.ok) {
                    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                return data.elements;
            } catch (error) {
                lastError = error;
                console.warn(`Attempt ${attempt + 1} failed for ${baseUrl}:`, error.message);
            }
        }
    }
    
    console.error('All Overpass API endpoints failed');
    throw lastError || new Error('Could not connect to any Overpass API endpoint');
}

function extractHeightData(elements) {
    let bestMatch = null;
    
    for (const element of elements) {
        if (element.tags && element.tags.building) {
            let height = 0;
            let source = '';
            
            // Try to get height data in order of preference
            if (element.tags.height) {
                height = parseHeightValue(element.tags.height);
                source = 'height';
            } 
            else if (element.tags['building:height']) {
                height = parseHeightValue(element.tags['building:height']);
                source = 'building:height';
            }
            else if (element.tags['building:levels']) {
                const levels = parseFloat(element.tags['building:levels']);
                if (!isNaN(levels) && levels > 0) {
                    height = levels * 3; // Assume 3m per level
                    source = 'levels';
                }
            }
            
            // If we found valid height data, use this building
            if (height > 0) {
                bestMatch = {
                    id: element.id,
                    type: element.type,
                    height: height,
                    source: source,
                    tags: { ...element.tags }
                };
                
                // Stop at the first building with height data
                break;
            }
        }
    }
    
    return bestMatch;
}

function parseHeightValue(heightStr) {
    if (!heightStr) return 0;
    
    // Remove any whitespace
    heightStr = heightStr.trim();
    
    // Check for meter units
    if (heightStr.endsWith('m')) {
        return parseFloat(heightStr.slice(0, -1));
    }
    
    // Check for feet units
    if (heightStr.endsWith('ft') || heightStr.endsWith("'")) {
        const feet = parseFloat(heightStr.replace(/ft|'/g, ''));
        return feet * 0.3048; // Convert feet to meters
    }
    
    // Try parsing as plain number
    const height = parseFloat(heightStr);
    return isNaN(height) ? 0 : height;
}

// Apply the OSM height to all buildings
function applyOSMHeight(height) {
    // Update the UI controls first
    updateWallHeightControls(height);
    
    // Then update all buildings
    updateBuildingHeights(height);
    
    // Save the data
    saveAllRoofData();
}

function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('osm-notification');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'osm-notification';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '12px 16px';
        notification.style.borderRadius = '4px';
        notification.style.color = 'white';
        notification.style.fontWeight = 'bold';
        notification.style.zIndex = '9999';
        notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        notification.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(notification);
    }
    
    // Set color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'warning':
            notification.style.backgroundColor = '#FF9800';
            break;
        case 'error':
            notification.style.backgroundColor = '#F44336';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
    }
    
    // Set message
    notification.textContent = message;
    
    // Show notification
    notification.style.opacity = '1';
    
    // Hide after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        
        // Remove from DOM after fade out
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, 5000);
}

if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector || 
                              Element.prototype.webkitMatchesSelector;
}

function getButtonByText(text) {
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
        if (button.textContent.includes(text)) {
            return button;
        }
    }
    return null;
}

export async function checkOSMBuildingHeightAvailability() {
    try {
        // Get coordinates from the first building
        const coords = getBuildingCoordinates();
        
        if (!coords) {
            disableOSMHeightButton();
            return false;
        }
        
        // Fetch building data from Overpass API
        const buildingData = await queryOSMBuildingData(coords.lat, coords.lng);
        
        if (!buildingData || buildingData.length === 0) {
            disableOSMHeightButton();
            return false;
        }
        
        // Find tallest building and extract height
        const heightData = extractHeightData(buildingData);
        
        if (heightData && heightData.height > 0) {
            // Store the height data in state for reuse
            state.fetchedOSMHeightData = heightData;
            enableOSMHeightButton();
            return true;
        } else {
            state.fetchedOSMHeightData = null;
            disableOSMHeightButton();
            return false;
        }
    } catch (error) {
        console.error('Error checking OSM height data availability:', error);
        state.fetchedOSMHeightData = null;
        disableOSMHeightButton();
        return false;
    }
}

// Helper functions to enable/disable the button
export function enableOSMHeightButton() {
    const button = document.getElementById('osm-height-button');
    if (button) {
        button.disabled = false;
        button.classList.remove('disabled');
        button.title = 'Automatically detect building height from OpenStreetMap data';
    }
}

export function disableOSMHeightButton() {
    const button = document.getElementById('osm-height-button');
    if (button) {
        button.disabled = true;
        button.classList.add('disabled');
        button.title = 'No building height data available in OpenStreetMap for this location';
        
        // Add a visual indicator to the button icon
        const icon = button.querySelector('i');
        if (icon) {
            icon.setAttribute('data-disabled', 'true');
        }
    }
}