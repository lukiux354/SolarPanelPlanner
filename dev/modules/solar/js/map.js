import { state } from './state.js';
import { switchToMapOnly, switchToBothViews, switchToThreeOnly } from './layout.js';
import { updateMarkersClickability } from './markers.js';
import { cancelDrawing } from './drawing.js';
import { removePolygon } from './api.js'; 
import { checkOSMBuildingHeightAvailability } from './three/osm_data.js';


export let map;
export let polylines = [];
let previousLayoutState = 'both';

export function getMap() {
    return map;
}


export function setPolylines(newPolylines) {
    polylines = newPolylines;
}


export function initMap() {
    const deleteModeIndicator = document.createElement('div');
    deleteModeIndicator.id = 'delete-mode-indicator';
    deleteModeIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> DELETE MODE ACTIVE <i class="fas fa-exclamation-triangle"></i>';
    deleteModeIndicator.style.display = 'none';
    document.getElementById('map-column').appendChild(deleteModeIndicator);

    const deleteBtn = document.getElementById("delete-btn");
    
    deleteBtn.setAttribute('disabled', 'disabled');
    deleteBtn.classList.add('disabled');
    deleteBtn.title = 'Select a project first';
    
    deleteBtn.style.position = 'absolute';
    deleteBtn.style.top = '10px';
    deleteBtn.style.right = '10px';
    deleteBtn.style.left = 'auto'; 
    deleteBtn.style.zIndex = '1'; 

    deleteBtn.addEventListener("click", () => {
        state.deleteMode = !state.deleteMode;
    
        // Update the delete button style
        const deleteModeIndicator = document.getElementById('delete-mode-indicator');
        
        if (state.deleteMode) {
            // Clear current drawing if any
            cancelDrawing();
            
            // Save the current layout state before switching to map-only
            previousLayoutState = getCurrentLayoutState();
            
            // Switch to map-only view
            import('./layout.js').then(module => {
                module.switchToMapOnly();
            });
            
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>&nbsp;Cancel Delete Mode';
            deleteBtn.classList.add('active-delete-mode');
            document.body.classList.add('delete-cursor');
            deleteModeIndicator.style.display = 'flex';
            
            polylines.forEach(polygon => {
                // Ensure polygon stays clickable
                if (polygon.setClickable) {
                    polygon.setClickable(true);
                }
                
                if (polygon.vertexMarkers) {
                    updateMarkersClickability(polygon.vertexMarkers);
                }
            });
        } else {
            restorePreviousLayout();
            
            // Restore original button text and styling
            deleteBtn.innerHTML = '<i class="fas fa-house-damage"></i>&nbsp;Delete Roof';
            deleteBtn.classList.remove('active-delete-mode');
            document.body.classList.remove('delete-cursor');
            deleteModeIndicator.style.display = 'none';
            
            // Update all existing vertex markers to be clickable again
            polylines.forEach(polygon => {

                if (polygon.setClickable) {
                    polygon.setClickable(true);
                }
                
                if (polygon.vertexMarkers) {
                    updateMarkersClickability(polygon.vertexMarkers);
                }
            });
        }
    });


    // Function to update delete button state based on project selection
    function updateDeleteButtonState() {
        const projectSelect = document.getElementById('project-select');
        const noProjectSelected = !projectSelect || !projectSelect.value;
        
        // Disable button if no project is selected
        if (noProjectSelected) {
            deleteBtn.classList.add('disabled');
            deleteBtn.setAttribute('disabled', 'disabled');
            deleteBtn.title = 'Select a project first';
        } else {
            deleteBtn.classList.remove('disabled');
            deleteBtn.removeAttribute('disabled');
            deleteBtn.title = 'Delete roof';
        }
    }
    
    updateDeleteButtonState();
    
    // Add event listener to project select dropdown
    const projectSelect = document.getElementById('project-select');
    if (projectSelect) {
        projectSelect.addEventListener('change', updateDeleteButtonState);
    }
    
    deleteBtn.addEventListener("click", () => {
        // Skip if button is disabled
        if (deleteBtn.hasAttribute('disabled')) {
            return;
        }
        
        else {
            deleteBtn.classList.remove('active-delete-mode');
            document.body.classList.remove('delete-cursor');
            deleteModeIndicator.style.display = 'none';
            
            polylines.forEach(polygon => {
                // Ensure polygon stays clickable
                if (polygon.setClickable) {
                    polygon.setClickable(true);
                }
                
                if (polygon.vertexMarkers) {
                    updateMarkersClickability(polygon.vertexMarkers);
                }
            });
        }
    });

    map = new window.google.maps.Map(document.getElementById("map"), {
        center: { lat: 54.898521, lng: 23.903597 },
        zoom: 16,
        mapTypeId: window.google.maps.MapTypeId.SATELLITE,
        tilt: 0,
        maxZoom: 21,
        streetViewControl: false,
        fullscreenControl: false,
        draggableCursor: 'crosshair'
    });

    const searchContainer = document.querySelector('.map-search-container');
    if (searchContainer) {
        const searchIcon = document.createElement('i');
        searchIcon.className = 'fas fa-search search-icon';
        searchContainer.appendChild(searchIcon);
        
        const mapColumn = document.getElementById('map-column');
        if (mapColumn) {
            const resizeObserver = new ResizeObserver(() => {
                const mapColumnWidth = mapColumn.offsetWidth;
                searchContainer.style.maxWidth = `min(400px, ${mapColumnWidth - 20}px)`;
            });
            resizeObserver.observe(mapColumn);
        }
    }


    let mapMoveTimeout = null;
    map.addListener('center_changed', () => {
        // Clear any existing timeout
        if (mapMoveTimeout) clearTimeout(mapMoveTimeout);
        
        // Set new timeout to avoid checking too frequently
        mapMoveTimeout = setTimeout(() => {
            if (state.currentMeshes && state.currentMeshes.length > 0) {
                checkOSMBuildingHeightAvailability();
            }
        }, 2000); // 2 seconds debounce
    });
}

function getCurrentLayoutState() {
    const mapBtn = document.getElementById('show-map-btn');
    const threeBtn = document.getElementById('show-3d-btn');
        
    if (mapBtn.classList.contains('active')) {
        return 'map';
    } else if (threeBtn.classList.contains('active')) {
        return 'three';
    } else {
        return 'both';
    }
}

function restorePreviousLayout() {
    switch (previousLayoutState) {
        case 'map':
            switchToMapOnly();
            break;
        case 'three':
            switchToThreeOnly();
            break;
        case 'both':
        default:
            switchToBothViews();
            break;
    }
}


export function loadGoogleMaps() {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            initMap();
            resolve();
            return;
        }

        const script = document.createElement("script");
        const apiKey = document.getElementById('map').dataset.apiKey;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            initMap();
            resolve();
        };
        script.onerror = (error) => {
            reject(error);
        };
        document.head.appendChild(script);
    });
}


export function focusOnPolygons() {
    if (!map || !polylines || polylines.length === 0) {
        return;
    }
    
    const bounds = new window.google.maps.LatLngBounds();
    let pointCount = 0;
    
    polylines.forEach(polygon => {
        if (polygon.getPath) {
            const path = polygon.getPath();
            for (let i = 0; i < path.getLength(); i++) {
                bounds.extend(path.getAt(i));
                pointCount++;
            }
        }
    });
    
    if (pointCount > 0) {
        map.fitBounds(bounds);
        setTimeout(() => {
            if (map.getZoom() > 0) {
                map.setZoom(map.getZoom() - 0.5);
            }
        }, 100);
    }
}


export function handlePolygonDelete(latLng, specificPolygon = null) {
    // If a specific polygon is provided, delete it directly
    if (specificPolygon) {
        removePolygon(specificPolygon);
        return;
    }
    
    // Otherwise find all polygons at this point
    const overlappingPolygons = [];
    const clickPoint = new window.google.maps.LatLng(latLng.lat(), latLng.lng());
    
    polylines.forEach((polygon) => {
        // Skip non-roof polygons
        if (polygon.type !== 'roof') return;
        
        try {
            // First try with the native containsLocation with a stricter check
            if (window.google.maps.geometry.poly.containsLocation(clickPoint, polygon)) {
                // Ensure we're not adding duplicates
                if (!overlappingPolygons.includes(polygon)) {
                    overlappingPolygons.push(polygon);
                }
            } 
        } catch (e) {
            console.error("Error in polygon check:", e);
        }
    });
    
    if (overlappingPolygons.length === 0) {
        // No polygons found at this location
        return;
    } else if (overlappingPolygons.length === 1) {
        // Only one polygon, delete directly
        removePolygon(overlappingPolygons[0]);
    } else {
        // Multiple polygons, show selection modal
        import('./modals.js').then(module => {
            module.showPolygonSelectionModal(overlappingPolygons, (selectedPolygon) => {
                removePolygon(selectedPolygon);
            });
        });
    }
}

window.handlePolygonDelete = handlePolygonDelete;