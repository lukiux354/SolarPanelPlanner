import { getCSRFToken, loadExistingShapes } from './api.js';
import { 
    showGuestProjectLimitModal,
    showRegisteredUserLimitModal,
    showDuplicateProjectNameModal,
    showErrorModal,
    showProjectCreationModal
} from './modals.js';
import { initProjectPanel, projectCreated, getCurrentProjectId, updateProjectInfo } from './project_panel.js';

export function loadProjects() {
    const createBtn = document.getElementById("create-project-btn");
    createBtn.addEventListener("click", () => {
        fetch('/solar/api/user-status/')
            .then(response => response.json())
            .then(data => {
                // Get existing projects
                return fetch("/solar/api/projects/")
                    .then(response => response.json())
                    .then(projects => ({ userStatus: data, projects: projects }));
            })
            .then(({ userStatus, projects }) => {
                if (userStatus.is_authenticated) {
                    if (userStatus.is_guest && projects.length >= 1) {
                        // Guest user already has a project
                        showGuestProjectLimitModal();
                    } else if (!userStatus.is_guest && projects.length >= 10) {
                        // Registered user already has 10 projects
                        showRegisteredUserLimitModal();
                    } else {
                        // Under the limit, show the creation modal
                        showProjectCreationModal();
                    }
                } else {
                    showProjectCreationModal();
                }
            })
            .catch(error => {
                console.error("Error checking user status:", error);
                showProjectCreationModal();
            });
    });
    
    initProjectPanel();
}

export function createProjectRequest(projectName) {
    return fetch("/solar/api/projects/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFToken()
        },
        body: JSON.stringify({ name: projectName })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.detail || text);
                } catch {
                    throw new Error(text);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        //project was created
        console.log("Project created successfully:", data);
        
        // Clear input field if it exists
        const inputField = document.getElementById("new-project-name");
        if (inputField) inputField.value = "";
        
        // Try to load shapes
        try {
            loadExistingShapes(data.id);
        } catch (err) {
            console.warn("Non-critical error loading shapes for new project:", err);
        }
        
        if (typeof window.checkGuestStatus === 'function') {
            try {
                window.checkGuestStatus();
            } catch (err) {
                console.warn("Non-critical error in checkGuestStatus:", err);
            }
        }
        
        projectCreated(data);
        
        return { success: true, data: data };
    })
    .catch(error => {
        console.error("Error creating project:", error);
        
        if (error.message && (
            error.message.includes("already exists") || 
            error.message.includes("duplicate") || 
            error.message.includes("already in use") ||
            error.message.includes("UNIQUE constraint failed") ||
            error.message.includes("IntegrityError")
        )) {
            showDuplicateProjectNameModal(projectName);
        } else {
            showErrorModal("Project Creation Error", "There was a problem creating your project. Please try again.");
        }
        
        return { success: false, error: error.message };
    });
}


export function updateCurrentProjectAddress() {
    const projectId = getCurrentProjectId();
    
    if (!projectId) {
        return; //no project selected
    }
    
    calculateProjectCenter(projectId).then(center => {
        if (center) {
            getAddressFromCoordinates(center.lat, center.lng).then(address => {
                if (address) {
                    // update the project info with the new address
                    updateProjectInfo(projectId, { address: address }, true);
                }
            });
        }
    });
}


export async function getAddressFromCoordinates(lat, lng) {
    return new Promise((resolve) => {
        const geocoder = new window.google.maps.Geocoder();
        const latlng = { lat, lng };
        
        geocoder.geocode({ location: latlng }, (results, status) => {
            if (status === "OK") {
                if (results[0]) {
                    const addressComponents = results[0].address_components;
                    let formattedAddress = "";
                    
                    const streetNumber = addressComponents.find(comp => 
                        comp.types.includes("street_number"));
                    
                    const street = addressComponents.find(comp => 
                        comp.types.includes("route"));
                    
                    const neighborhood = addressComponents.find(comp => 
                        comp.types.includes("sublocality") || 
                        comp.types.includes("neighborhood"));
                    
                    const locality = addressComponents.find(comp => 
                        comp.types.includes("locality"));
                    
                    if (street) {
                        formattedAddress += street.short_name;
                    }

                    if (streetNumber) {
                        if (formattedAddress) formattedAddress += " ";
                        formattedAddress += streetNumber.short_name;
                    }
                    
                    if (neighborhood && (!street || street.short_name !== neighborhood.short_name)) {
                        if (formattedAddress) formattedAddress += ", ";
                        formattedAddress += neighborhood.short_name;
                    }
                    
                    if (locality && (!neighborhood || neighborhood.short_name !== locality.short_name)) {
                        if (formattedAddress) formattedAddress += ", ";
                        formattedAddress += locality.short_name;
                    }
                    
                    resolve(formattedAddress || results[0].formatted_address.split(",")[0]);
                } else {
                    resolve("");
                }
            } else {
                console.warn("Geocoder failed due to: " + status);
                resolve("");
            }
        });
    });
}


export async function calculateProjectCenter(projectId) {
    return fetch(`/solar/api/roof-polygons/?project_id=${projectId}`)
        .then(response => response.json())
        .then(polygons => {
            if (polygons.length === 0) {
                return null; // no polygons
            }
            
            let allLats = [];
            let allLngs = [];
            
            polygons.forEach(polygon => {
                polygon.coordinates.forEach(coord => {
                    allLats.push(coord[0]);
                    allLngs.push(coord[1]);
                });
            });
            
            const avgLat = allLats.reduce((a, b) => a + b, 0) / allLats.length;
            const avgLng = allLngs.reduce((a, b) => a + b, 0) / allLngs.length;
            
            return { lat: avgLat, lng: avgLng };
        })
        .catch(error => {
            console.error("Error calculating project center:", error);
            return null;
        });
}