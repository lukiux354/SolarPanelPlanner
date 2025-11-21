import { state as threeState } from './three/state.js';
import { getCSRFToken } from './api.js';
import { setupTabSwitching, createMonthlyChart } from './stats.js';

function createModal(id, headerContent, bodyContent, footerContent = '', options = {}) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.id = id;
    modalBackdrop.style.display = 'flex';
    
    const headerStyle = options.headerStyle ? `style="${options.headerStyle}"` : '';
    
    modalBackdrop.innerHTML = `
        <div class="modal-container">
            <div class="modal-header" ${headerStyle}>
                ${headerContent}
            </div>
            <div class="modal-body">
                ${bodyContent}
            </div>
            ${footerContent ? `<div class="modal-footer">${footerContent}</div>` : ''}
        </div>
    `;
    
    document.body.appendChild(modalBackdrop);
    return modalBackdrop;
}


function setupModalBehaviors(modalBackdrop, closeCallback = null) {
    const closeButtons = modalBackdrop.querySelectorAll('.close-modal-btn, [data-dismiss="modal"]');
    
    const closeModal = () => {
        document.body.removeChild(modalBackdrop);
        if (closeCallback) closeCallback();
    };
    
    closeButtons.forEach(button => {
        button.addEventListener('click', closeModal);
    });
    
    // Click outside to close
    let mouseDownOnBackdrop = false;
    modalBackdrop.addEventListener('mousedown', e => {
        mouseDownOnBackdrop = e.target === modalBackdrop;
    });
    modalBackdrop.addEventListener('mouseup', e => {
        if (e.target === modalBackdrop && mouseDownOnBackdrop) {
            closeModal();
        }
        mouseDownOnBackdrop = false;
    });
    
    return closeModal;
}

export function showGuestProjectLimitModal() {
    const headerContent = `
        <h4><i class="fas fa-user-clock"></i> Project Limit Reached</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div style="text-align: center; margin-bottom: 15px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2.5em; color: #f39c12;"></i>
        </div>
        <p>As a guest user, you can only create one project.</p>
        <p>Would you like to register for a full account to create up to 10 projects?</p>
    `;
    
    const footerContent = `
        <button id="guest-limit-cancel" class="btn" data-dismiss="modal">Not Now</button>
        <button id="guest-limit-register" class="btn primary">
            <i class="fas fa-user-plus"></i>&nbsp;Register Now
        </button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #f39c12, #e67e22);'
    };
    
    const modal = createModal('guest-limit-modal', headerContent, bodyContent, footerContent, options);
    const closeModal = setupModalBehaviors(modal);
    
    modal.querySelector('#guest-limit-register').addEventListener('click', () => {
        closeModal();

        if (window.showRegisterModal) {
            window.showRegisterModal();
        } else {

            const registerBtn = document.querySelector('#register-from-header-btn') || 
                               document.querySelector('#register-btn') ||
                               document.querySelector('#register-from-guest-btn');
            if (registerBtn) {
                registerBtn.click();
            }
        }
    });
}

export function showRegisteredUserLimitModal() {
    const headerContent = `
        <h4><i class="fas fa-exclamation-circle"></i> Project Limit Reached</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div style="text-align: center; margin-bottom: 15px;">
            <i class="fas fa-folder-minus" style="font-size: 2.5em; color: #3498db;"></i>
        </div>
        <p>You have reached the maximum limit of 10 projects.</p>
        <p>To create a new project, please delete one of your existing projects first.</p>
    `;
    
    const footerContent = `
        <button id="registered-limit-ok" class="btn primary" data-dismiss="modal">
            <i class="fas fa-check"></i>&nbsp;Got It
        </button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #3498db, #2980b9);'
    };
    
    const modal = createModal('registered-limit-modal', headerContent, bodyContent, footerContent, options);
    setupModalBehaviors(modal);
}

export function showDuplicateProjectNameModal(projectName) {
    const headerContent = `
        <h4><i class="fas fa-copy"></i> Duplicate Project Name</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div style="text-align: center; margin-bottom: 15px;">
            <i class="fas fa-clone" style="font-size: 2.5em; color: #9b59b6;"></i>
        </div>
        <p>A project with the name "<strong>${projectName}</strong>" already exists.</p>
        <p>Please choose a different name for your project.</p>
    `;
    
    const footerContent = `
        <button id="duplicate-name-ok" class="btn primary" data-dismiss="modal">
            <i class="fas fa-check"></i>&nbsp;OK
        </button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #9b59b6, #8e44ad);'
    };
    
    const modal = createModal('duplicate-name-modal', headerContent, bodyContent, footerContent, options);
    setupModalBehaviors(modal);
}

export function showErrorModal(title, message) {
    const headerContent = `
        <h4><i class="fas fa-exclamation-circle"></i> ${title}</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div style="text-align: center; margin-bottom: 15px;">
            <i class="fas fa-times-circle" style="font-size: 2.5em; color: #e74c3c;"></i>
        </div>
        <p>${message}</p>
    `;
    
    const footerContent = `
        <button id="error-ok" class="btn danger" data-dismiss="modal">
            <i class="fas fa-check"></i>&nbsp;OK
        </button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #e74c3c, #c0392b);'
    };
    
    const modal = createModal('error-modal', headerContent, bodyContent, footerContent, options);
    setupModalBehaviors(modal);
}

export function showSuccessModal(title, message) {
    const headerContent = `
        <h4><i class="fas fa-check-circle"></i> ${title}</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div style="text-align: center; margin-bottom: 15px;">
            <i class="fas fa-thumbs-up" style="font-size: 2.5em; color: #2ecc71;"></i>
        </div>
        <p>${message}</p>
    `;
    
    const footerContent = `
        <button id="success-ok" class="btn success" data-dismiss="modal">
            <i class="fas fa-check"></i>&nbsp;OK
        </button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #2ecc71, #27ae60);'
    };
    
    const modal = createModal('success-modal', headerContent, bodyContent, footerContent, options);
    setupModalBehaviors(modal);
}

export function showDeleteConfirmationModal(projectId, projectName, onConfirm) {
    const headerContent = `
        <h4><i class="fas fa-trash-alt"></i> Confirm Project Deletion</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div style="text-align: center; margin-bottom: 15px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2.5em; color: #e74c3c;"></i>
        </div>
        <p>Are you sure you want to delete the project "<strong>${projectName}</strong>"?</p>
        <p><strong>This action cannot be undone and will remove all buildings and solar panels in this project.</strong></p>
    `;
    
    const footerContent = `
        <button id="cancel-delete-btn" class="btn" data-dismiss="modal">
            <i class="fas fa-times"></i>&nbsp;Cancel
        </button>
        <button id="confirm-delete-btn" class="btn danger">
            <i class="fas fa-trash"></i>&nbsp;Delete Project
        </button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #e74c3c, #c0392b);'
    };
    
    const modal = createModal('delete-confirm-modal', headerContent, bodyContent, footerContent, options);
    const closeModal = setupModalBehaviors(modal);
    
    modal.querySelector('#confirm-delete-btn').addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm(projectId, projectName);
    });
}

export function showPanelDeleteConfirmationModal(panelId, panelName, onConfirm) {
    const headerContent = `
        <h4><i class="fas fa-solar-panel"></i> Delete Solar Panel</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div style="text-align: center; margin-bottom: 15px;">
            <i class="fas fa-trash-alt" style="font-size: 2.5em; color: #e74c3c;"></i>
        </div>
        <p>Are you sure you want to delete the panel "<strong>${panelName}</strong>"?</p>
        <p><strong>This will remove this panel type from all your projects.</strong></p>
    `;
    
    const footerContent = `
        <button id="cancel-panel-delete-btn" class="btn">
            <i class="fas fa-times"></i>&nbsp;Cancel
        </button>
        <button id="confirm-panel-delete-btn" class="btn danger">
            <i class="fas fa-trash"></i>&nbsp;Delete Panel
        </button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #e74c3c, #c0392b);'
    };
    
    const modal = createModal('panel-delete-modal', headerContent, bodyContent, footerContent, options);
    
    // Set up event listeners
    const closeBtn = modal.querySelector('.close-modal-btn');
    const cancelBtn = modal.querySelector('#cancel-panel-delete-btn');
    const confirmBtn = modal.querySelector('#confirm-panel-delete-btn');
    
    const closeModal = () => document.body.removeChild(modal);
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    confirmBtn.addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm(panelId, panelName);
    });
    
    // Click outside to close
    let mouseDownOnBackdrop = false;
    modal.addEventListener('mousedown', e => {
        mouseDownOnBackdrop = e.target === modal;
    });
    modal.addEventListener('mouseup', e => {
        if (e.target === modal && mouseDownOnBackdrop) {
            closeModal();
        }
        mouseDownOnBackdrop = false;
    });
}

export function showPolygonDeleteConfirmationModal(polygon, onConfirm) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.id = 'polygon-delete-modal';
    modalBackdrop.style.display = 'flex';
    
    modalBackdrop.innerHTML = `
        <div class="modal-container">
            <div class="modal-header" style="background: linear-gradient(135deg, #e74c3c, #c0392b);">
                <h4><i class="fas fa-draw-polygon"></i> Delete Roof</h4>
                <button class="close-modal-btn">×</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: 15px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2.5em; color: #e74c3c;"></i>
                </div>
                <p>Are you sure you want to delete this roof from the map?</p>
                <p><strong>This will remove the roof and all associated solar panels.</strong></p>
            </div>
            <div class="modal-footer">
                <button id="cancel-polygon-delete-btn" class="btn">Cancel</button>
                <button id="confirm-polygon-delete-btn" class="btn danger">
                    <i class="fas fa-cut"></i>&nbsp;Delete Roof
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalBackdrop);
    
    // Set up event listeners
    const closeBtn = modalBackdrop.querySelector('.close-modal-btn');
    const cancelBtn = modalBackdrop.querySelector('#cancel-polygon-delete-btn');
    const confirmBtn = modalBackdrop.querySelector('#confirm-polygon-delete-btn');
    
    const closeModal = () => document.body.removeChild(modalBackdrop);
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    confirmBtn.addEventListener('click', () => {
        closeModal();
        if (onConfirm) {
            onConfirm(polygon);
            
            // Show success modal
            setTimeout(() => {
                showSuccessModal('Roof Deleted', 'The roof has been deleted successfully.');
            }, 300); // Optional delay for better UX
        }
    });
    
    // Click outside to close
    let mouseDownOnBackdrop = false;
    modalBackdrop.addEventListener('mousedown', e => {
        mouseDownOnBackdrop = e.target === modalBackdrop;
    });
    modalBackdrop.addEventListener('mouseup', e => {
        if (e.target === modalBackdrop && mouseDownOnBackdrop) {
            closeModal();
        }
        mouseDownOnBackdrop = false;
    });
}

export function showWelcomeModal() {
    const headerContent = `
        <h4>Welcome to Solar Panel Planner</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    // Check if the "don't show again" setting is already in localStorage
    const hideWelcomeModal = localStorage.getItem('hideWelcomeModal') === 'true';
    
    const bodyContent = `
        <div class="welcome-content">
            <h3 style="color: #388e3c; margin-top: 0;">Getting Started</h3>
            <p>Welcome to the Solar Panel Planning Tool! Here's how to get started:</p>
            
            <div class="welcome-section">
                <h4><i class="fas fa-project-diagram"></i> Projects</h4>
                <p>Create a new project by entering a name and clicking the + button. You can manage multiple projects from the dropdown.</p>
            </div>
            
            <div class="welcome-section">
                <h4><i class="fas fa-map-marked-alt"></i> Map Tools</h4>
                <p>Search for an address (or find manually) and draw roof outlines by left-clicking clicking on the map. Use the "Delete Roof" button to delete roof sections.</p>
            </div>
            
            <div class="welcome-section">
                <h4><i class="fas fa-sun"></i> Solar Panels</h4>
                <p>Once you've created roof outlines, in the 3D view, edit your roof, customize your solar panels and select roofs for solar panel placement.</p>
            </div>
        </div>
    `;
    
    const footerContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div class="toggle-switch-container" style="display: flex; align-items: center;">
                <label class="switch">
                    <input type="checkbox" id="dont-show-again" ${hideWelcomeModal ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
                <span style="margin-left: 10px;">Don't show this message again</span>
            </div>
            <button id="welcome-ok-btn" class="btn primary">Get Started</button>
        </div>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #642774, #9b4dca);'
    };
    
    const modal = createModal('welcome-modal', headerContent, bodyContent, footerContent, options);
    
    // Save preference function to be called when modal is closed
    const savePreference = () => {
        const dontShowAgain = modal.querySelector('#dont-show-again').checked;
        localStorage.setItem('hideWelcomeModal', dontShowAgain.toString());
    };
    
    // Set up modal behaviors with our callback to save preference on any close action
    const closeModal = setupModalBehaviors(modal, savePreference);
    
    // Handle the OK button click
    modal.querySelector('#welcome-ok-btn').addEventListener('click', () => {
        closeModal();
    });
    
    return modal;
}


export function showProjectRequiredModal() {
    const headerContent = `
        <h4>Project Required</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div style="text-align: center; margin-bottom: 15px;">
            <i class="fas fa-exclamation-circle" style="font-size: 2.5em; color: #ffc107;"></i>
        </div>
        <p>Please select a project before drawing.</p>
        <p>If you don't have any projects yet, create one now:</p>
    `;
    
    const footerContent = `
        <button id="project-required-cancel" class="btn" data-dismiss="modal">Cancel</button>
        <button id="project-required-create" class="btn secondary">
            <i class="fas fa-plus"></i>&nbsp;Create New Project
        </button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #ffa000, #ff6f00);'
    };
    
    const modal = createModal('project-required-modal', headerContent, bodyContent, footerContent, options);
    const closeModal = setupModalBehaviors(modal);
    
    // Add event listener for the Create New Project button
    const createProjectBtn = modal.querySelector('#project-required-create');
    createProjectBtn.addEventListener('click', () => {
        closeModal(); // Close this modal first
        
        // After a small delay, show the project creation modal
        setTimeout(() => {
            showProjectCreationModal();
        }, 100);
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function showPolygonSelectionModal(polygons, onSelect) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.id = 'polygon-selection-modal';
    modalBackdrop.style.display = 'flex';
    
    // Define some different colors for the polygon previews
    const previewColors = ['#0000FF', '#FF0000', '#00AA00', '#FF6600', '#9900CC', '#009999'];
    
    const polygonsList = polygons.map((p, index) => {
        // Calculate area of the polygon
        const area = calculatePolygonArea(p);
        const formattedArea = area.toFixed(1);
        
        // Generate a more accurate preview shape for each option
        const shape = getPreviewShape(index, p, polygons);
        const color = previewColors[index % previewColors.length];
        
        // Format creation date if available
        let displayName;
        if (p.created_at) {
            displayName = formatDate(p.created_at);
        } else if (p.id) {
            displayName = `Roof ${index + 1}`;
        } else {
            displayName = `New Roof`;
        }
        
        return `
            <div class="polygon-option" data-index="${index}">
                <div class="polygon-preview-container" style="width: 60px; height: 40px; display: flex; align-items: center; justify-content: center; margin-right: 10px;">
                    <div class="polygon-preview" style="${shape} background-color: ${color}; opacity: 0.7;"></div>
                </div>
                <div class="polygon-info">
                    <div class="polygon-title">${displayName}</div>
                    <div class="polygon-details">Area: ${formattedArea} m²</div>
                </div>
            </div>
        `;
    }).join('');
    
    modalBackdrop.innerHTML = `
        <div class="modal-container">
            <div class="modal-header" style="background: linear-gradient(135deg, #ff9800, #f57c00);">
                <h4><i class="fas fa-layer-group"></i> Multiple Roofs Detected</h4>
                <button class="close-modal-btn">×</button>
            </div>
            <div class="modal-body">
                <p>There are multiple overlapping roofs at this location. Please select which one you want to delete:</p>
                <div class="polygon-select-list" style="max-height: 300px; overflow-y: auto; margin-top: 15px;">
                    ${polygonsList}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalBackdrop);
    
    // Set up event listeners
    const closeBtn = modalBackdrop.querySelector('.close-modal-btn');
    const polygonOptions = modalBackdrop.querySelectorAll('.polygon-option');
    
    const closeModal = () => document.body.removeChild(modalBackdrop);
    
    closeBtn.addEventListener('click', closeModal);
    
    polygonOptions.forEach(option => {
        option.addEventListener('click', () => {
            const index = parseInt(option.dataset.index);
            closeModal();
            if (onSelect) onSelect(polygons[index]);
        });
        
        // Add hover effect
        option.addEventListener('mouseover', () => {
            option.style.backgroundColor = '#f5f5f5';
            option.style.cursor = 'pointer';
        });
        
        option.addEventListener('mouseout', () => {
            option.style.backgroundColor = '';
        });
    });
    
    // Click outside to close
    let mouseDownOnBackdrop = false;
    modalBackdrop.addEventListener('mousedown', e => {
        mouseDownOnBackdrop = e.target === modalBackdrop;
    });
    modalBackdrop.addEventListener('mouseup', e => {
        if (e.target === modalBackdrop && mouseDownOnBackdrop) {
            closeModal();
        }
        mouseDownOnBackdrop = false;
    });
}

// Helper function to format date in a user-friendly way
function formatDate(dateString) {
    if (!dateString) return "Unknown date";
    
    try {
        const date = new Date(dateString);
        
        // If the date is today, show time
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        
        // If the date is yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        
        // Otherwise show full date
        return date.toLocaleDateString([], { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        console.error("Error formatting date:", e);
        return "Unknown date";
    }
}


function calculatePolygonArea(polygon) {
    const path = polygon.getPath();
    const length = path.getLength();
    if (length < 3) return 0;
    
    return window.google.maps.geometry.spherical.computeArea(path);
}


function getPreviewShape(index, polygon, allPolygons) {
    // Create a more accurate visual representation based on the roof's actual shape
    
    // Calculate the largest area to create relative sizing
    const areas = allPolygons.map(p => calculatePolygonArea(p));
    const maxArea = Math.max(...areas);
    const thisArea = areas[index];
    
    // Calculate relative size (between 40% and 100%)
    const relativeSize = Math.max(40, Math.min(100, (thisArea / maxArea) * 100));
    
    // Determine the basic shape type by analyzing the polygon vertices
    const vertices = polygon.getPath().getLength();
    
    let shapeStyle = '';
    
    // Determine shape based on number of vertices
    if (vertices <= 3) {
        // Triangle-like roof
        shapeStyle = `clip-path: polygon(50% 0%, 0% 100%, 100% 100%);`;
    } else if (vertices === 4) {
        // Analyze if it's more like a square or a rectangle
        const bounds = new window.google.maps.LatLngBounds();
        polygon.getPath().forEach(point => bounds.extend(point));
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const width = window.google.maps.geometry.spherical.computeDistanceBetween(
            new window.google.maps.LatLng(ne.lat(), sw.lng()),
            new window.google.maps.LatLng(ne.lat(), ne.lng())
        );
        const height = window.google.maps.geometry.spherical.computeDistanceBetween(
            new window.google.maps.LatLng(sw.lat(), sw.lng()),
            new window.google.maps.LatLng(ne.lat(), sw.lng())
        );
        
        if (Math.abs(width - height) < 5) {
            // Close to square
            shapeStyle = `clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);`;
        } else if (width > height) {
            // Wide rectangle
            shapeStyle = `clip-path: polygon(0% 20%, 100% 20%, 100% 80%, 0% 80%);`;
        } else {
            // Tall rectangle
            shapeStyle = `clip-path: polygon(20% 0%, 80% 0%, 80% 100%, 20% 100%);`;
        }
    } else if (vertices === 5) {
        // pentagon
        shapeStyle = `clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);`;
    } else if (vertices === 6) {
        // hexagon
        shapeStyle = `clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);`;
    } else {
        // more complex polygon
        shapeStyle = `clip-path: polygon(10% 50%, 10% 100%, 90% 100%, 90% 50%, 50% 0%);`;
    }
    
    // Scale the shape based on its relative area
    return `${shapeStyle} width: ${relativeSize}%; height: ${relativeSize}%; margin: 0 auto;`;
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


export function showProjectCreationModal() {
    const headerContent = `
        <h4><i class="fas fa-folder-plus"></i> Create New Project</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div class="form-group">
            <label for="modal-new-project-name">Project Name</label>
            <input type="text" id="modal-new-project-name" placeholder="Enter project name" maxlength="16">
            <small class="character-count">0/16</small>
        </div>
    `;
    
    const footerContent = `
        <button id="cancel-project-btn" class="btn" data-dismiss="modal">Cancel</button>
        <button id="confirm-project-btn" class="btn secondary">Create</button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #388e3c, #2e7d32);'
    };
    
    const modal = createModal('project-creation-modal', headerContent, bodyContent, footerContent, options);
    const closeModal = setupModalBehaviors(modal);
    
    // Set up character count indicator
    const nameInput = modal.querySelector('#modal-new-project-name');
    const charCount = modal.querySelector('.character-count');
    
    nameInput.addEventListener('input', () => {
        const length = nameInput.value.length;
        charCount.textContent = `${length}/16`;
        
        if (length > 12 && length < 16) {
            charCount.style.color = '#e67e22';
        } else if (length === 16) {
            charCount.style.color = '#e74c3c';
        } else {
            charCount.style.color = '';
        }
    });
    
    setTimeout(() => nameInput.focus(), 100);
    
    modal.querySelector('#confirm-project-btn').addEventListener('click', () => {
        const projectName = nameInput.value.trim();
        
        if (!projectName) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'Please enter a project name';
            
            const existingError = modal.querySelector('.error-message');
            if (existingError) existingError.remove();
            
            modal.querySelector('.form-group').appendChild(errorMsg);
            nameInput.focus();
            return;
        }
        
        // Close the modal
        closeModal();
        
        // Use existing project creation logic with success handling
        import('./project.js').then(module => {
            module.createProjectRequest(projectName)
                .then(response => {
                    if (response && response.success) {
                        // Show success modal when project is created
                        showSuccessModal('Project Created', `Project "${projectName}" has been created successfully.`);
                    }
                })
                .catch(error => {
                    console.error('Error creating project:', error);
                });
        });
    });
    
    return closeModal;
}


export function showStatisticsModal() {
    const headerContent = `
        <h4><i class="fas fa-chart-line"></i> Solar Power Statistics</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div class="stats-tabs">
            <button class="tab-btn active" data-tab="monthly-generation">Monthly Generation</button>
            <button class="tab-btn" data-tab="panel-efficiency">Panel Efficiency</button>
            <button class="tab-btn" data-tab="financial-analysis">Financial Analysis</button>
        </div>
        
        <div class="tab-content active" id="monthly-generation">
            <h3>Monthly Power Generation</h3>
            <div class="chart-container">
                <canvas id="monthly-power-chart"></canvas>
            </div>
            <div class="stats-summary">
                <div class="summary-item">
                    <div class="summary-title">Estimated Annual Production</div>
                    <div class="summary-value" id="annual-production">0 kWh</div>
                </div>
                <div class="summary-item">
                    <div class="summary-title">Peak Production Month</div>
                    <div class="summary-value" id="peak-month">July</div>
                </div>
                <div class="summary-item">
                    <div class="summary-title">Average Monthly Production</div>
                    <div class="summary-value" id="avg-production">0 kWh</div>
                </div>
            </div>
        </div>
        
        <div class="tab-content" id="panel-efficiency">
            <p>Panel efficiency data will be displayed here in future updates.</p>
        </div>
        
        <div class="tab-content" id="financial-analysis">
            <p>Financial analysis data will be displayed here in future updates.</p>
        </div>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #388e3c, #1b5e20);'
    };
    
    const modal = createModal('statistics-modal', headerContent, bodyContent, '', options);
    
    const modalContainer = modal.querySelector('.modal-container');
    modalContainer.classList.add('stats-modal-container');
    
    const modalBody = modal.querySelector('.modal-body');
    modalBody.classList.add('stats-modal-body');
    
    const closeModal = setupModalBehaviors(modal);
    setupTabSwitching(modal);

    const panelEfficiencyTab = modal.querySelector('#panel-efficiency');
    populatePanelEfficiencyTab(panelEfficiencyTab);

    const financialAnalysisTab = modal.querySelector('#financial-analysis');
    populateFinancialAnalysisTab(financialAnalysisTab);
    
    setTimeout(() => {
        createMonthlyChart();
    }, 100);
    
    return closeModal;
}

export function showPanelEditModal(panel, specsSection) {
    const headerContent = `
        <h4><i class="fas fa-solar-panel"></i> Edit Solar Panel</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div class="form-group">
            <label for="panel-name">Panel Name</label>
            <input type="text" id="panel-name" placeholder="Enter panel name" value="${panel.name}" maxlength="20" required>
            <small class="character-count">${panel.name.length}/20</small>
            <div class="field-error" id="name-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-manufacturer">Manufacturer (Optional)</label>
            <select id="panel-manufacturer">
                <option value="">No manufacturer</option>
                <!-- Will be populated from API -->
            </select>
            <div class="field-error" id="manufacturer-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-width">Width (m)</label>
            <input type="text" id="panel-width" step="0.01" min="1.0" max="5" value="${panel.width}" required>
            <small>Minimum: 1m, Maximum: 5m</small>
            <div class="field-error" id="width-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-height">Height (m)</label>
            <input type="text" id="panel-height" step="0.01" min="1.0" max="5" value="${panel.height}" required>
            <small>Minimum: 1m, Maximum: 5m</small>
            <div class="field-error" id="height-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-wattage">Power Output (W)</label>
            <input type="text" id="panel-wattage" step="1" min="1" value="${panel.wattage}" required>
            <div class="field-error" id="wattage-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-cost">Cost (€)</label>
            <input type="text" id="panel-cost" step="0.01" min="0" value="${panel.cost}" required>
            <div class="field-error" id="cost-error"></div>
        </div>
    `;
    
    const footerContent = `
        <button id="cancel-panel-edit" class="btn" data-dismiss="modal">Cancel</button>
        <button id="confirm-panel-edit" class="btn primary">Save Changes</button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #2196F3, #1976D2);'
    };
    
    const modal = createModal('panel-edit-modal', headerContent, bodyContent, footerContent, options);
    const closeModal = setupModalBehaviors(modal);
    
    // Setup character count indicator
    const nameInput = modal.querySelector('#panel-name');
    const charCount = modal.querySelector('.character-count');
    
    nameInput.addEventListener('input', () => {
        const length = nameInput.value.length;
        charCount.textContent = `${length}/20`;
        
        // Change color when approaching limit
        if (length > 14 && length <= 19) {
            charCount.style.color = '#e67e22';
        } else if (length === 20) {
            charCount.style.color = '#e74c3c';
        } else {
            charCount.style.color = '';
        }
    });
    
    // Populate manufacturer dropdown
    const manufacturerSelect = modal.querySelector('#panel-manufacturer');
    
    // Fetch manufacturers from the API
    fetch('/solar/api/manufacturers/')
        .then(response => response.json())
        .then(manufacturers => {
            manufacturers.forEach(manufacturer => {
                const option = document.createElement('option');
                option.value = manufacturer.id;
                option.textContent = manufacturer.name;
                // Pre-select the current manufacturer if it matches
                if (manufacturer.name === panel.manufacturer_name) {
                    option.selected = true;
                }
                manufacturerSelect.appendChild(option);
            });
            
            // If no manufacturer was selected, try to select one by ID if available
            if (!manufacturerSelect.value && panel.manufacturer_id) {
                const option = manufacturerSelect.querySelector(`option[value="${panel.manufacturer_id}"]`);
                if (option) option.selected = true;
            }
        })
        .catch(error => {
            console.error('Error loading manufacturers:', error);
            // Add the current manufacturer as fallback
            const option = document.createElement('option');
            option.value = panel.manufacturer_id || "default";
            option.textContent = panel.manufacturer_name || "Default Manufacturer";
            option.selected = true;
            manufacturerSelect.appendChild(option);
        });
    
    // Convert input fields to support both . and , as decimal separators
    const decimalInputs = modal.querySelectorAll('input[type="text"][step]');
    decimalInputs.forEach(input => {
        // Replace any commas with periods in the default value
        input.value = input.value.toString().replace(',', '.');
        
        // Add input validation
        input.addEventListener('input', function() {
            // Allow both comma and period as decimal separator
            this.value = this.value.replace(/,/g, '.');
            
            // Remove any non-numeric characters except decimal point
            const isNegativeAllowed = parseFloat(this.min) < 0;
            if (isNegativeAllowed) {
                this.value = this.value.replace(/[^\d.]/g, '');
            } else {
                this.value = this.value.replace(/[^\d.]/g, '');
            }
            
            // Ensure only one decimal point
            const parts = this.value.split('.');
            if (parts.length > 2) {
                this.value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Enforce max value for dimensions
            if (this.hasAttribute('max')) {
                const maxVal = parseFloat(this.getAttribute('max'));
                const currentVal = parseFloat(this.value);
                if (!isNaN(currentVal) && currentVal > maxVal) {
                    this.value = maxVal;
                }
            }
        });
    });
    
    // Helper function
    const showFieldError = (fieldId, message) => {
        const errorElement = modal.querySelector(`#${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            errorElement.style.color = '#e74c3c';
            errorElement.style.fontSize = '0.9em';
            errorElement.style.marginTop = '3px';
        }
    };
    
    // Helper function
    const clearFieldErrors = () => {
        const errorElements = modal.querySelectorAll('.field-error');
        errorElements.forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    };
    
    // Set up form submission
    const saveBtn = modal.querySelector('#confirm-panel-edit');
    saveBtn.addEventListener('click', () => {
        // Clear any previous error messages
        clearFieldErrors();
        
        // Get form values
        const name = modal.querySelector('#panel-name').value.trim();
        const manufacturerId = modal.querySelector('#panel-manufacturer').value;
        
        // Parse numeric values, handling both . and , as decimal separators
        const parseNumericValue = (value) => {
            return parseFloat(value.toString().replace(',', '.'));
        };
        
        const width = parseNumericValue(modal.querySelector('#panel-width').value);
        const height = parseNumericValue(modal.querySelector('#panel-height').value);
        const wattage = parseNumericValue(modal.querySelector('#panel-wattage').value);
        const cost = parseNumericValue(modal.querySelector('#panel-cost').value);
        
        // Keep existing values for thickness and efficiency
        const thickness = panel.thickness;
        const efficiency = panel.efficiency;
        
        // Validate each field individually
        let hasErrors = false;
        
        if (!name) {
            showFieldError('name', 'Panel name is required');
            hasErrors = true;
        }
        
        if (isNaN(width) || width < 1) {
            showFieldError('width', 'Width must be at least 1m');
            hasErrors = true;
        } else if (width > 5) {
            showFieldError('width', 'Width cannot exceed 5m');
            hasErrors = true;
        }
        
        if (isNaN(height) || height < 1) {
            showFieldError('height', 'Height must be at least 1m');
            hasErrors = true;
        } else if (height > 5) {
            showFieldError('height', 'Height cannot exceed 5m');
            hasErrors = true;
        }
        
        if (isNaN(wattage) || wattage <= 0) {
            showFieldError('wattage', 'Please enter a valid power output');
            hasErrors = true;
        }
        
        if (isNaN(cost) || cost < 0) {
            showFieldError('cost', 'Cost cannot be negative');
            hasErrors = true;
        }
        
        if (hasErrors) {
            return;
        }
        
        // Create updated panel object
        const updatedPanel = {
            name,
            manufacturer: manufacturerId || null,
            width,
            height,
            thickness,
            wattage,
            efficiency,
            cost
        };
        
        closeModal();
        
        fetch(`/solar/api/panels/${panel.id}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(updatedPanel)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Show success message
            showSuccessModal('Panel Updated', `The panel "${name}" has been updated successfully.`);
            
            // If panel selection is available, update the specs
            if (specsSection) {
                import('./three/ui.js').then(module => {
                    module.updatePanelDisplay(data, specsSection);
                    
                    // If the panel is currently selected, update the constraints
                    if (threeState.solarPanel.id === panel.id) {
                        threeState.solarPanel.name = data.name;
                        threeState.solarPanel.width = data.width;
                        threeState.solarPanel.height = data.height;
                        threeState.solarPanel.thickness = data.thickness;
                        threeState.solarPanel.power.wattage = data.wattage;
                        threeState.solarPanel.power.efficiency = data.efficiency;
                        threeState.solarPanel.cost = data.cost;
                        
                        // Update panels if needed
                        if (threeState.solarPanel.selectedRoofIndices && 
                            threeState.solarPanel.selectedRoofIndices.length > 0) {
                            import('./three/solar_panel/panel_placement.js').then(placementModule => {
                                placementModule.updatePanelsForAllSelectedRoofs();
                            });
                        }
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error updating panel:', error);
            showErrorModal('Error', 'Failed to update the panel. Please try again later.');
        });
    });
    
    return closeModal;
}

export function showPanelCreationModal(panelDropdown, specsSection) {
    const headerContent = `
        <h4><i class="fas fa-solar-panel"></i> Create New Solar Panel</h4>
        <button class="close-modal-btn">×</button>
    `;
    
    const bodyContent = `
        <div class="form-group">
            <label for="panel-name">Panel Name</label>
            <input type="text" id="panel-name" placeholder="Enter panel name" maxlength="20" required>
            <small class="character-count">0/20</small>
            <div class="field-error" id="name-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-manufacturer">Manufacturer (Optional)</label>
            <select id="panel-manufacturer">
                <option value="">No manufacturer</option>
                <!-- Will be populated from API -->
            </select>
            <div class="field-error" id="manufacturer-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-width">Width (m)</label>
            <input type="text" id="panel-width" step="0.01" min="1.0" max="5" value="1.7" required>
            <small>Minimum: 1m, Maximum: 5m</small>
            <div class="field-error" id="width-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-height">Height (m)</label>
            <input type="text" id="panel-height" step="0.01" min="1.0" max="5" value="1.0" required>
            <small>Minimum: 1m, Maximum: 5m</small>
            <div class="field-error" id="height-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-wattage">Power Output (W)</label>
            <input type="text" id="panel-wattage" step="1" min="1" value="400" required>
            <div class="field-error" id="wattage-error"></div>
        </div>
        <div class="form-group">
            <label for="panel-cost">Cost (€)</label>
            <input type="text" id="panel-cost" step="0.01" min="0" value="350" required>
            <div class="field-error" id="cost-error"></div>
        </div>
    `;
    
    const footerContent = `
        <button id="cancel-panel-create" class="btn" data-dismiss="modal">Cancel</button>
        <button id="confirm-panel-create" class="btn secondary">Create Panel</button>
    `;
    
    const options = {
        headerStyle: 'background: linear-gradient(135deg, #388e3c, #1b5e20);'
    };
    
    const modal = createModal('panel-create-modal', headerContent, bodyContent, footerContent, options);
    const closeModal = setupModalBehaviors(modal);
    
    // Setup character count indicator
    const nameInput = modal.querySelector('#panel-name');
    const charCount = modal.querySelector('.character-count');
    
    nameInput.addEventListener('input', () => {
        const length = nameInput.value.length;
        charCount.textContent = `${length}/20`;
        
        // Change color when approaching limit
        if (length > 14 && length <= 19) {
            charCount.style.color = '#e67e22';
        } else if (length === 20) {
            charCount.style.color = '#e74c3c';
        } else {
            charCount.style.color = '';
        }
    });
    
    // Populate manufacturer dropdown
    const manufacturerSelect = modal.querySelector('#panel-manufacturer');
    
    // Fetch manufacturers from the API
    fetch('/solar/api/manufacturers/')
        .then(response => response.json())
        .then(manufacturers => {
            manufacturers.forEach(manufacturer => {
                const option = document.createElement('option');
                option.value = manufacturer.id;
                option.textContent = manufacturer.name;
                manufacturerSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error loading manufacturers:', error);
            // Add a default manufacturer option as fallback
            const option = document.createElement('option');
            option.value = "default";
            option.textContent = "Default Manufacturer";
            option.selected = true;
            manufacturerSelect.appendChild(option);
        });
    
    // Convert input fields to support both . and , as decimal separators
    const decimalInputs = modal.querySelectorAll('input[type="text"][step]');
    decimalInputs.forEach(input => {
        // Replace any commas with periods in the default value
        input.value = input.value.toString().replace(',', '.');
        
        // Add input validation
        input.addEventListener('input', function() {
            // Allow both comma and period as decimal separator
            this.value = this.value.replace(/,/g, '.');
            
            // Remove any non-numeric characters except decimal point
            const isNegativeAllowed = parseFloat(this.min) < 0;
            if (isNegativeAllowed) {
                this.value = this.value.replace(/[^\d.]/g, '');
            } else {
                this.value = this.value.replace(/[^\d.]/g, '');
            }
            
            // Ensure only one decimal point
            const parts = this.value.split('.');
            if (parts.length > 2) {
                this.value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Enforce max value for dimensions
            if (this.hasAttribute('max')) {
                const maxVal = parseFloat(this.getAttribute('max'));
                const currentVal = parseFloat(this.value);
                if (!isNaN(currentVal) && currentVal > maxVal) {
                    this.value = maxVal;
                }
            }
        });
    });
    
    // Helper function to show field-specific errors
    const showFieldError = (fieldId, message) => {
        const errorElement = modal.querySelector(`#${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            errorElement.style.color = '#e74c3c';
            errorElement.style.fontSize = '0.9em';
            errorElement.style.marginTop = '3px';
        }
    };
    
    // Helper function to clear all field errors
    const clearFieldErrors = () => {
        const errorElements = modal.querySelectorAll('.field-error');
        errorElements.forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    };
    
    // Set up form submission
    const createBtn = modal.querySelector('#confirm-panel-create');
    createBtn.addEventListener('click', () => {
        // Clear any previous error messages
        clearFieldErrors();
        
        // Get form values
        const name = modal.querySelector('#panel-name').value.trim();
        const manufacturerId = modal.querySelector('#panel-manufacturer').value;
        
        // Parse numeric values, handling both . and , as decimal separators
        const parseNumericValue = (value) => {
            return parseFloat(value.toString().replace(',', '.'));
        };
        
        const width = parseNumericValue(modal.querySelector('#panel-width').value);
        const height = parseNumericValue(modal.querySelector('#panel-height').value);
        const wattage = parseNumericValue(modal.querySelector('#panel-wattage').value);
        const cost = parseNumericValue(modal.querySelector('#panel-cost').value);
        
        const thickness = 0.04;  // Default thickness in meters
        const efficiency = 20;   // Default efficiency percentage
        
        // Validate each field individually
        let hasErrors = false;
        
        if (!name) {
            showFieldError('name', 'Panel name is required');
            hasErrors = true;
        }
        
        if (isNaN(width) || width < 1) {
            showFieldError('width', 'Width must be at least 1m');
            hasErrors = true;
        } else if (width > 5) {
            showFieldError('width', 'Width cannot exceed 5m');
            hasErrors = true;
        }
        
        if (isNaN(height) || height < 1) {
            showFieldError('height', 'Height must be at least 1m');
            hasErrors = true;
        } else if (height > 5) {
            showFieldError('height', 'Height cannot exceed 5m');
            hasErrors = true;
        }
        
        if (isNaN(wattage) || wattage <= 0) {
            showFieldError('wattage', 'Please enter a valid power output');
            hasErrors = true;
        }
        
        if (isNaN(cost) || cost < 0) {
            showFieldError('cost', 'Cost cannot be negative');
            hasErrors = true;
        }
        
        // Stop if there are validation errors
        if (hasErrors) {
            return;
        }
        
        // Create panel object
        const newPanel = {
            name,
            manufacturer: manufacturerId || null,
            width,
            height,
            thickness,
            wattage,
            efficiency,
            cost
        };
        
        // Close the modal
        closeModal();
        
        // Send request to create panel
        fetch('/solar/api/panels/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(newPanel)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Show success message
            showSuccessModal('Panel Created', `The panel "${name}" has been created successfully.`);
            
            // Update the panel dropdown and select the new panel
            if (panelDropdown && specsSection) {
                import('./three/ui.js').then(module => {
                    // Refresh the dropdown and select the new panel
                    fetch('/solar/api/panels/')
                        .then(response => response.json())
                        .then(panels => {
                            // Clear existing options
                            panelDropdown.innerHTML = '';
                            
                            // Create optgroups
                            const defaultGroup = document.createElement('optgroup');
                            defaultGroup.label = "Default Panels";
                            
                            const customGroup = document.createElement('optgroup');
                            customGroup.label = "My Custom Panels";
                            
                            let hasCustomPanels = false;
                            
                            // Populate dropdown
                            panels.forEach(panel => {
                                const option = document.createElement('option');
                                option.value = panel.id;
                                option.textContent = panel.name;
                                
                                // Select newly created panel
                                if (panel.id === data.id) {
                                    option.selected = true;
                                }
                                
                                if (panel.is_public) {
                                    defaultGroup.appendChild(option);
                                } else {
                                    customGroup.appendChild(option);
                                    hasCustomPanels = true;
                                }
                            });
                            
                            panelDropdown.appendChild(defaultGroup);
                            if (hasCustomPanels) {
                                panelDropdown.appendChild(customGroup);
                            }
                            
                            // Update display with new panel
                            module.updatePanelDisplay(data, specsSection);
                            
                            // Update state with the new panel's data
                            import('./three/state.js').then(stateModule => {
                                stateModule.state.solarPanel.id = data.id;
                                stateModule.state.solarPanel.name = data.name;
                                stateModule.state.solarPanel.width = data.width;
                                stateModule.state.solarPanel.height = data.height;
                                stateModule.state.solarPanel.thickness = data.thickness;
                                stateModule.state.solarPanel.power.wattage = data.wattage;
                                stateModule.state.solarPanel.power.efficiency = data.efficiency;
                                stateModule.state.solarPanel.cost = data.cost;
                                
                                // Update panels if needed
                                if (stateModule.state.solarPanel.selectedRoofIndices && 
                                    stateModule.state.solarPanel.selectedRoofIndices.length > 0) {
                                    import('./three/solar_panel/panel_placement.js').then(placementModule => {
                                        placementModule.updatePanelsForAllSelectedRoofs();
                                    });
                                }
                            });
                        });
                });
            }
        })
        .catch(error => {
            console.error('Error creating panel:', error);
            showErrorModal('Error', 'Failed to create the panel. Please try again later.');
        });
    });
    
    return closeModal;
}


function populatePanelEfficiencyTab(tabElement) {
    import('./three/solar_panel/sun_efficiency.js').then(module => {
        // Get the project coordinates
        const projectCoords = module.getProjectCoordinates();
        
        // Get selected roofs data
        import('./three/state.js').then(stateModule => {
            const state = stateModule.state;
            
            let content = `
                <div class="stats-content">
                    <div class="stats-summary">
                        <div class="summary-cards-container two-cards">
                            <div class="stat-card info-card">
                                <h4><i class="fas fa-map-marker-alt"></i> Project Location</h4>
                                <div class="info-grid">
                                    <div class="info-item">
                                        <div class="info-label">Latitude</div>
                                        <div class="info-value">${projectCoords.latitude.toFixed(4)}°</div>
                                    </div>
                                    <div class="info-item">
                                        <div class="info-label">Longitude</div>
                                        <div class="info-value">${projectCoords.longitude.toFixed(4)}°</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="stat-card info-card">
                                <h4><i class="fas fa-bullseye"></i> Optimal Panel Settings</h4>
                                <div class="info-grid">
                                    <div class="info-item">
                                        <div class="info-label">Optimal Tilt Angle</div>
                                        <div class="info-value">${projectCoords.latitude.toFixed(1)}°</div>
                                    </div>
                                    <div class="info-item">
                                        <div class="info-label">Optimal Orientation</div>
                                        <div class="info-value">South (${projectCoords.latitude > 0 ? '180' : '0'}°)</div>
                                    </div>
                                </div>
                            </div>
                        </div>`;

            if (state.solarPanel && state.solarPanel.selectedRoofIndices && state.solarPanel.selectedRoofIndices.length > 0) {
                content += `
                        <div class="stats-panel roof-efficiency">
                            <h4><i class="fas fa-home"></i> Selected Roof Analysis</h4>
                            <div class="table-container">
                                <table class="efficiency-table">
                                    <thead>
                                        <tr>
                                            <th>Roof</th>
                                            <th>Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody>`;
                
                let hasAnyRoofData = false;
                
                state.solarPanel.selectedRoofIndices.forEach((roofIndex, i) => {
                    const roofMesh = state.currentMeshes.find(mesh => mesh.userData.polygonIndex === roofIndex);
                    if (roofMesh) {
                        // Make sure we have efficiency data, if not calculate it
                        if (!roofMesh.userData.solarEfficiency) {
                            // Calculate or fetch the missing data
                            import('./three/solar_panel/roof_analysis.js').then(analysisModule => {
                                if (roofMesh.userData.averageNormal || 
                                    (roofMesh.userData.vertices3D && state.baseHeights[roofIndex])) {
                                    const normal = roofMesh.userData.averageNormal || 
                                                  analysisModule.calculateRoofNormal(
                                                      roofMesh.userData.vertices3D, 
                                                      state.baseHeights[roofIndex] || 0
                                                  );
                                    const effData = module.calculateRoofSolarEfficiency(normal);
                                    roofMesh.userData.solarEfficiency = effData.efficiency;
                                }
                            });
                        }
                        
                        // Get efficiency class for color coding
                        const effClass = getEfficiencyClass(roofMesh.userData.solarEfficiency || 0);
                        const effValue = (roofMesh.userData.solarEfficiency || 0).toFixed(1);
                        
                        content += `
                            <tr>
                                <td>Roof ${i + 1}</td>
                                <td class="${effClass}">${effValue}%</td>
                            </tr>`;
                        
                        hasAnyRoofData = true;
                    }
                });
                
                if (!hasAnyRoofData) {
                    content += `
                            <tr>
                                <td colspan="2" class="no-data-message">
                                    No efficiency data available for selected roofs
                                </td>
                            </tr>`;
                }
                
                content += `
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="efficiency-legend">
                        <div class="legend-item">
                            <span class="legend-color excellent"></span>
                            <span>Excellent (90-100%)</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color good"></span>
                            <span>Good (70-90%)</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color average"></span>
                            <span>Average (50-70%)</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color poor"></span>
                            <span>Poor (< 50%)</span>
                        </div>
                    </div>
                </div>`;
            } else {
                content += `
                <div class="empty-state-container">
                    <div class="empty-state-icon">
                        <i class="fas fa-home"></i>
                    </div>
                    <p class="no-data-message">No roofs are currently selected.</p>
                    <p class="empty-state-hint">Please select a roof to see its efficiency data.</p>
                </div>`;
            }
            
            // Add efficiency tips section
            content += `
                        <div class="stats-panel stats-note efficiency-tips">
                            <h4><i class="fas fa-lightbulb"></i> Efficiency Optimization Tips</h4>
                            <ul>
                                <li>For maximum energy production, panels should face south (in the northern hemisphere).</li>
                                <li>The optimal tilt angle is generally equal to your location's latitude.</li>
                                <li>East/west facing roofs typically produce about 80% compared to south-facing roofs.</li>
                                <li>Flat roofs allow for optimal positioning using mounting brackets.</li>
                            </ul>
                        </div>
                    </div>
                </div>`;
            
            // Set the content to the tab
            tabElement.innerHTML = content;
        });
    });
}

// Helper function to get efficiency class for coloring
function getEfficiencyClass(efficiency) {
    if (efficiency >= 90) return 'excellent';
    if (efficiency >= 70) return 'good';
    if (efficiency >= 50) return 'average';
    return 'poor';
}


function populateFinancialAnalysisTab(tabElement) {
    import('./three/state.js').then(stateModule => {
        const state = stateModule.state;
        import('./stats.js').then(statsModule => {
            
            // Get data for calculations
            const panelCount = state.solarPanel.panels.length;
            
            // Show loading state
            tabElement.innerHTML = `
                <div class="loading-indicator">
                    <i class="fas fa-spinner fa-spin"></i> Loading financial data...
                </div>
            `;
            
            // Use setTimeout to improve perceived performance
            setTimeout(() => {
                if (panelCount === 0) {
                    tabElement.innerHTML = `
                        <div class="empty-state-container">
                            <div class="empty-state-icon">
                                <i class="fas fa-solar-panel"></i>
                            </div>
                            <p class="no-data-message">No solar panels have been placed yet.</p>
                            <p class="empty-state-hint">Add panels to see detailed financial analysis.</p>
                        </div>
                    `;
                    return;
                }
                
                // Get the consistent production data from the stats calculation
                const productionData = statsModule.calculateMonthlyProduction();
                const annualProduction = productionData.annualProduction;
                
                const panelCost = state.solarPanel.cost;
                const totalCapacityKW = state.solarPanel.panels.length * state.solarPanel.power.wattage / 1000;
                
                // Financial assumptions (can be adjusted based on location)
                const electricityPrice = 0.15; // €/kWh
                const annualSavings = annualProduction * electricityPrice; // € saved per year
                
                // Installation costs
                const totalPanelCost = panelCount * panelCost;
                const installationCost = totalPanelCost * 0.3; // Assume installation is 30% of panel cost
                const inverterCost = totalCapacityKW * 500; // Assume 500 euros per kW for inverter
                const totalSystemCost = totalPanelCost + installationCost + inverterCost;
                
                // ROI calculations
                const simplePaybackYears = totalSystemCost / annualSavings;
                const lifespanYears = 25;
                const lifetimeSavings = annualSavings * lifespanYears;
                const roi = ((lifetimeSavings - totalSystemCost) / totalSystemCost) * 100;
                
                // Format currency values
                const formatCurrency = (value) => {
                    return new Intl.NumberFormat('en-EU', { 
                        style: 'currency', 
                        currency: 'EUR',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    }).format(value);
                };
                
                // Build the HTML content with improved layout and styling
                let content = `
                    <div class="financial-analysis-container">
                        <div class="financial-summary">
                            <div class="summary-cards-container">
                                <!-- Key metrics cards -->
                                <div class="metric-card">
                                    <div class="metric-icon"><i class="fas fa-solar-panel"></i></div>
                                    <div class="metric-value">${panelCount}</div>
                                    <div class="metric-label">Total Panels</div>
                                </div>
                                
                                <div class="metric-card">
                                    <div class="metric-icon"><i class="fas fa-bolt"></i></div>
                                    <div class="metric-value">${totalCapacityKW.toFixed(1)} kW</div>
                                    <div class="metric-label">System Capacity</div>
                                </div>
                                
                                <div class="metric-card">
                                    <div class="metric-icon"><i class="fas fa-plug"></i></div>
                                    <div class="metric-value">${annualProduction.toLocaleString()} kWh</div>
                                    <div class="metric-label">Annual Production</div>
                                </div>
                                
                                <div class="metric-card highlight">
                                    <div class="metric-icon"><i class="fas fa-euro-sign"></i></div>
                                    <div class="metric-value">${formatCurrency(totalSystemCost)}</div>
                                    <div class="metric-label">Total Investment</div>
                                </div>
                            </div>
                            
                            <div class="financial-details">
                                <div class="financial-section stats-panel">
                                    <h4><i class="fas fa-chart-pie"></i> Cost Breakdown</h4>
                                    <div class="cost-breakdown-chart">
                                        <div class="chart-bar">
                                            <div class="chart-segment panels" style="width: ${(totalPanelCost/totalSystemCost*100).toFixed(0)}%">
                                                <span class="segment-label">Panels</span>
                                            </div>
                                            <div class="chart-segment installation" style="width: ${(installationCost/totalSystemCost*100).toFixed(0)}%">
                                                <span class="segment-label">Inst.</span>
                                            </div>
                                            <div class="chart-segment inverter" style="width: ${(inverterCost/totalSystemCost*100).toFixed(0)}%">
                                                <span class="segment-label">Inverter</span>
                                            </div>
                                        </div>
                                        <div class="chart-legend">
                                            <div class="legend-item"><span class="color-box panels"></span> Panels (${formatCurrency(totalPanelCost)})</div>
                                            <div class="legend-item"><span class="color-box installation"></span> Installation (${formatCurrency(installationCost)})</div>
                                            <div class="legend-item"><span class="color-box inverter"></span> Inverter & Equipment (${formatCurrency(inverterCost)})</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="financial-section stats-panel">
                                    <h4><i class="fas fa-hand-holding-usd"></i> Return on Investment</h4>
                                    <div class="roi-grid">
                                        <div class="roi-item">
                                            <div class="roi-label">Annual Savings</div>
                                            <div class="roi-value">${formatCurrency(annualSavings)}/year</div>
                                        </div>
                                        <div class="roi-item">
                                            <div class="roi-label">Payback Period</div>
                                            <div class="roi-value">${simplePaybackYears.toFixed(1)} years</div>
                                        </div>
                                        <div class="roi-item">
                                            <div class="roi-label">ROI (25 years)</div>
                                            <div class="roi-value">${roi.toFixed(0)}%</div>
                                        </div>
                                        <div class="roi-item highlight">
                                            <div class="roi-label">25-Year Savings</div>
                                            <div class="roi-value">${formatCurrency(lifetimeSavings)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="financial-disclaimer stats-note">
                                <p><i class="fas fa-info-circle"></i> <strong>Note:</strong> This is a simplified financial analysis based on estimated values. Actual results may vary based on many factors including weather patterns, electricity rates, and system degradation. Consult with a solar installer for a detailed analysis.</p>
                            </div>
                        </div>
                    </div>`;
                    
                tabElement.innerHTML = content;
            }, 50);
        });
    });
}