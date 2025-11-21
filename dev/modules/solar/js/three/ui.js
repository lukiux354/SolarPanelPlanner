import { state } from './state.js';
import { createPolygonMesh } from './buildings.js';
import { saveAllRoofData } from './persistence.js';
import { clearVertexMarkers } from './buildings.js';
import { showPanelDeleteConfirmationModal, showStatisticsModal, showPanelEditModal, showPanelCreationModal } from '../modals.js';
import { initSunSimulation } from './sun_simulation.js';
import { fetchOSMBuildingHeight } from './osm_data.js';

let solarPanelInstance = null;

export function updateWallHeightControls(height) {
    const wallHeightSlider = document.getElementById('wall-height');
    const wallHeightText = document.getElementById('wall-height-text');
    
    if (wallHeightSlider && wallHeightText) {
        // Update slider and text input without triggering events
        wallHeightSlider.value = height;
        wallHeightText.value = height.toFixed(2);
    }
}

export function updateBuildingHeights(height) {
    // Update base heights for all buildings
    const polygonIndices = new Set(state.currentMeshes.map(mesh => mesh.userData.polygonIndex));
    polygonIndices.forEach(polygonIndex => {
        state.baseHeights[polygonIndex] = height;
    });
    
    const selectedRoofIndices = [...state.solarPanel.selectedRoofIndices];
    
    state.solarPanel.selectedRoofIndices = [];
    
    state.solarPanel.isBudgetConstrained = false;
    state.solarPanel.isPowerConstrained = false;
    state.solarPanel.isLimitedByRoof = false;
    state.solarPanel.totalPanelsFit = 0;
    state.solarPanel.totalMaxPanelsFit = 0;
    
    updateSolarCalculations();
    
    // Remove roof highlights manually before removing meshes
    for (const roofIndex of selectedRoofIndices) {
        const roofMesh = state.currentMeshes.find(mesh => mesh.userData.polygonIndex === roofIndex);
        if (roofMesh && roofMesh.userData.hasHighlight) {
            // Remove wireframe overlay
            if (roofMesh.userData.wireframeOverlay) {
                state.scene.remove(roofMesh.userData.wireframeOverlay);
                if (roofMesh.userData.wireframeOverlay.geometry) {
                    roofMesh.userData.wireframeOverlay.geometry.dispose();
                }
                if (roofMesh.userData.wireframeOverlay.material) {
                    roofMesh.userData.wireframeOverlay.material.dispose();
                }
                roofMesh.userData.wireframeOverlay = null;
            }
            
            // Remove fill overlay
            if (roofMesh.userData.fillOverlay) {
                state.scene.remove(roofMesh.userData.fillOverlay);
                if (roofMesh.userData.fillOverlay.geometry) {
                    roofMesh.userData.fillOverlay.geometry.dispose();
                }
                if (roofMesh.userData.fillOverlay.material) {
                    roofMesh.userData.fillOverlay.material.dispose();
                }
                roofMesh.userData.fillOverlay = null;
            }
            
            // Reset highlight flag
            roofMesh.userData.hasHighlight = false;
        }
    }
    
    import('./solar_panel/panel_model.js')
        .then(module => {
            module.clearExistingPanels();
        });
    
    // Recreate all meshes with new base height
    if (state.currentMeshes.length > 0) {
        const currentVertexHeights = {...state.vertexHeights};
        
        // Recreate all meshes
        const data = state.currentMeshes.map(mesh => ({
            polygonData: { coordinates: mesh.userData.originalCoords },
            polygonIndex: mesh.userData.polygonIndex
        }));
        
        // Clear and rebuild
        state.currentMeshes.forEach(mesh => state.scene.remove(mesh));
        state.currentOutlines.forEach(outline => state.scene.remove(outline));
        clearVertexMarkers();
        
        state.currentMeshes = [];
        state.currentOutlines = [];
        state.vertexHeights = currentVertexHeights;
        
        data.forEach(item => createPolygonMesh(item.polygonData, item.polygonIndex));
    }
}

export function setupWallControls() {
    return {
        slider: document.getElementById('wall-height'),
        numberInput: document.getElementById('wall-height-text')
    };
}

export function setupSolarBudgetControls() {
    if (!solarPanelInstance) {
        solarPanelInstance = setupCombinedSolarPanel();
    }
    return solarPanelInstance;
}

export function setupSolarPanelControls() {
    return setupSolarBudgetControls();
}

const styleElement = document.createElement('style');
styleElement.textContent = `
    /* Hide spinner buttons for number inputs */
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    input[type=number] {
        -moz-appearance: textfield;
    }
`;
document.head.appendChild(styleElement);

function loadAvailablePanels(dropdown, specsSection) {
    fetch('/solar/api/panels/')
        .then(response => response.json())
        .then(data => {
            dropdown.innerHTML = '';
            
            const defaultGroup = document.createElement('optgroup');
            defaultGroup.label = "Default Panels";
            
            const customGroup = document.createElement('optgroup');
            customGroup.label = "My Custom Panels";
            
            // Track whether we have any custom panels
            let hasCustomPanels = false;
            let defaultPanelFound = false;
            
            // Sort and add panels to appropriate groups
            data.forEach(panel => {
                const option = document.createElement('option');
                option.value = panel.id;
                option.textContent = panel.name;
                
                // Set the first default panel or specifically marked default panel as selected
                if ((panel.is_default && !defaultPanelFound) || panel.id === state.solarPanel.id) {
                    option.selected = true;
                    defaultPanelFound = true;
                    
                    updatePanelDisplay(panel, specsSection);
                    
                    state.solarPanel.id = panel.id;
                    state.solarPanel.name = panel.name;
                    state.solarPanel.width = panel.width;
                    state.solarPanel.height = panel.height;
                    state.solarPanel.thickness = panel.thickness;
                    state.solarPanel.power.wattage = panel.wattage;
                    state.solarPanel.power.efficiency = panel.efficiency;
                    state.solarPanel.cost = panel.cost;
                    
                    if (state.solarPanel.selectedRoofIndices && state.solarPanel.selectedRoofIndices.length > 0) {
                        updatePanelsBasedOnConstraints();
                    }
                }
                
                // Add to appropriate group
                if (panel.is_public) {
                    defaultGroup.appendChild(option);
                } else {
                    customGroup.appendChild(option);
                    hasCustomPanels = true;
                }
            });
            
            dropdown.appendChild(defaultGroup);
            
            if (hasCustomPanels) {
                dropdown.appendChild(customGroup);
            }
        })
        .catch(error => {
            console.error('Error loading solar panels:', error);
        });
}

// Update the selected panel
function updateSelectedPanel(panelId, specsSection) {
    fetch(`/solar/api/panels/${panelId}/`)
        .then(response => response.json())
        .then(selectedPanel => {
            state.solarPanel.id = selectedPanel.id;
            state.solarPanel.name = selectedPanel.name;
            state.solarPanel.width = selectedPanel.width;
            state.solarPanel.height = selectedPanel.height;
            state.solarPanel.thickness = selectedPanel.thickness;
            state.solarPanel.power.wattage = selectedPanel.wattage;
            state.solarPanel.power.efficiency = selectedPanel.efficiency;
            state.solarPanel.cost = selectedPanel.cost;
            
            // Update display
            updatePanelDisplay(selectedPanel, specsSection);
            
            // Update panels if roofs are selected
            if (state.solarPanel.selectedRoofIndices && 
                state.solarPanel.selectedRoofIndices.length > 0) {
                updatePanelsBasedOnConstraints();
            }
        })
        .catch(error => {
            console.error('Error loading panel details:', error);
        });
}

export function updatePanelDisplay(panel, specsSection) {
    specsSection.innerHTML = '';
    
    const specsContainer = document.createElement('div');
    specsContainer.className = 'panel-specs';
    
    // Display panel specs
    specsContainer.innerHTML = 
        `${panel.manufacturer_name ? `<div><strong>Manufacturer:</strong> ${panel.manufacturer_name}</div>` : ''}
        <div><strong>Dimensions:</strong> ${panel.width.toFixed(2)}m × ${panel.height.toFixed(2)}m</div>
        <div><strong>Power Rating:</strong> ${panel.wattage}W</div>
        <div><strong>Cost:</strong> €${panel.cost.toFixed(2)}</div>`;
    
    if (!panel.is_public) {
        const actionButtonsContainer = document.createElement('div');
        actionButtonsContainer.className = 'panel-actions';
        actionButtonsContainer.style.marginTop = '8px';
        actionButtonsContainer.style.display = 'flex';
        actionButtonsContainer.style.gap = '8px';
        
        // Edit button
        const editButton = document.createElement('button');
        editButton.className = 'btn primary small';
        editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
        editButton.style.padding = '1px 8px';
        editButton.style.fontSize = '1em';
        editButton.style.flex = '1';
        
        editButton.addEventListener('click', () => {
            showPanelEditModal(panel, specsSection);
        });
        
        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn danger small';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete';
        deleteButton.style.padding = '1px 8px';
        deleteButton.style.fontSize = '1em';
        deleteButton.style.flex = '1';
        
        deleteButton.addEventListener('click', () => {
            showPanelDeleteConfirmationModal(panel.id, panel.name, () => {
                deleteSolarPanel(panel.id, specsSection);
            });
        });
        
        actionButtonsContainer.appendChild(editButton);
        actionButtonsContainer.appendChild(deleteButton);
        specsContainer.appendChild(actionButtonsContainer);
    }
    
    specsSection.appendChild(specsContainer);
}

function setupCombinedSolarPanel() {
    const container = document.createElement('div');
    container.className = 'combined-solar-panel-controls modern-panel';
    
    // Create collapsible header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'panel-header';
    headerDiv.innerHTML = `
        <h4>Solar Panel Designer</h4>
        <span class="collapse-icon">▼</span>
    `;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'panel-content';
    
    headerDiv.addEventListener('click', () => {
        contentDiv.classList.toggle('collapsed');
        const icon = headerDiv.querySelector('.collapse-icon');
        icon.classList.toggle('collapsed');
    });
    
    container.appendChild(headerDiv);
    
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tabs-container';
    
    const panelTab = document.createElement('button');
    panelTab.className = 'tab-btn active';
    panelTab.innerHTML ='<i class="fas fa-solar-panel"></i>';
    panelTab.dataset.tab = 'panel';
    
    const budgetTab = document.createElement('button');
    budgetTab.className = 'tab-btn';
    budgetTab.innerHTML = '<i class="fas fa-tools"></i>';
    budgetTab.dataset.tab = 'budget';
    
    const sunTab = document.createElement('button');
    sunTab.className = 'tab-btn';
    sunTab.innerHTML = '<i class="fas fa-sun"></i>';
    sunTab.title = 'Sun Position Simulation';
    sunTab.dataset.tab = 'sun';
    
    tabsContainer.appendChild(panelTab);
    tabsContainer.appendChild(budgetTab);
    tabsContainer.appendChild(sunTab);
    contentDiv.appendChild(tabsContainer);
    
    // Create tab content containers
    const panelContent = document.createElement('div');
    panelContent.className = 'tab-content active';
    panelContent.id = 'panel-tab-content';
    
    const budgetContent = document.createElement('div');
    budgetContent.className = 'tab-content';
    budgetContent.id = 'budget-tab-content';
    
    const sunContent = document.createElement('div');
    sunContent.className = 'tab-content';
    sunContent.id = 'sun-tab-content';
    
    // Set up tab switching
    panelTab.addEventListener('click', () => {
        panelTab.classList.add('active');
        budgetTab.classList.remove('active');
        sunTab.classList.remove('active');
        panelContent.classList.add('active');
        budgetContent.classList.remove('active');
        sunContent.classList.remove('active');
    });
    
    budgetTab.addEventListener('click', () => {
        budgetTab.classList.add('active');
        panelTab.classList.remove('active');
        sunTab.classList.remove('active');
        budgetContent.classList.add('active');
        panelContent.classList.remove('active');
        sunContent.classList.remove('active');
    });
    
    sunTab.addEventListener('click', () => {
        sunTab.classList.add('active');
        panelTab.classList.remove('active');
        budgetTab.classList.remove('active');
        sunContent.classList.add('active');
        panelContent.classList.remove('active');
        budgetContent.classList.remove('active');
    });
    
    // ---------------------------------- PANEL SELECTION TAB CONTENT ----------------------------------
    const panelSelectionDiv = document.createElement('div');
    panelSelectionDiv.className = 'panel-selection';
    
    // Create panel dropdown
    const panelSelectWrapper = document.createElement('div');
    panelSelectWrapper.className = 'panel-select-wrapper';
    
    const panelDropdown = document.createElement('select');
    panelDropdown.id = 'panel-select';
    panelDropdown.className = 'panel-dropdown';
    
    // Add "New Panel" button
    const newPanelBtn = document.createElement('button');
    newPanelBtn.innerHTML = '<i class="fas fa-plus"></i>';
    newPanelBtn.className = 'new-panel-btn';
    newPanelBtn.title = 'Create new panel';
    newPanelBtn.style.display = 'flex';
    newPanelBtn.style.justifyContent = 'center';
    newPanelBtn.style.alignItems = 'center';
    
    // Add elements to wrappers
    panelSelectWrapper.appendChild(panelDropdown);
    panelSelectWrapper.appendChild(newPanelBtn);
    
    panelSelectionDiv.appendChild(panelSelectWrapper);
    panelContent.appendChild(panelSelectionDiv);
    
    const specsSection = document.createElement('div');
    specsSection.className = 'specs-section';
    specsSection.innerHTML = `
        <div><strong>Panel Specs:</strong></div>
        <div>Size: ${state.solarPanel.width}m × ${state.solarPanel.height}m</div>
        <div>Power: ${state.solarPanel.power.wattage}W (${state.solarPanel.power.efficiency}% efficiency)</div>
        <div>Cost: ${state.solarPanel.cost}€ per panel</div>
    `;
    panelContent.appendChild(specsSection);
    
    const panelCount = document.createElement('div');
    panelCount.id = 'panel-count';
    panelCount.className = 'panel-count-display';
    panelCount.innerHTML = '<strong>Panels placed:</strong> 0';
    panelContent.appendChild(panelCount);
    
    const instructions = document.createElement('p');
    instructions.className = 'instructions';
    instructions.textContent = 'Click on a roof to place solar panels';
    panelContent.appendChild(instructions);
    
    const panelButtonContainer = document.createElement('div');
    panelButtonContainer.className = 'button-grid';
    
    const orientationBtn = document.createElement('button');
    orientationBtn.textContent = 'Horizontal';
    orientationBtn.title = 'Change panel orientation';
    orientationBtn.id = 'panel-orientation-btn';
    orientationBtn.className = 'btn primary compact-btn';
    orientationBtn.innerHTML = '<i class="fas fa-arrows-alt-h"></i>&nbsp;Horizontal';
    
    orientationBtn.addEventListener('click', () => {
        state.solarPanel.isVerticalOrientation = !state.solarPanel.isVerticalOrientation;
        
        const temp = state.solarPanel.width;
        state.solarPanel.width = state.solarPanel.height;
        state.solarPanel.height = temp;
        
        if (state.solarPanel.isVerticalOrientation) {
            orientationBtn.innerHTML = '<i class="fas fa-arrows-alt-v"></i>&nbsp;Vertical';
            orientationBtn.classList.add('active');
        } else {
            orientationBtn.innerHTML = '<i class="fas fa-arrows-alt-h"></i>&nbsp;Horizontal';
            orientationBtn.classList.remove('active');
        }
        
        if (state.solarPanel.selectedRoofIndices && state.solarPanel.selectedRoofIndices.length > 0) {
            updatePanelsBasedOnConstraints();
        }
    });
    
    const showEfficiencyBtn = document.createElement('button');
    showEfficiencyBtn.innerHTML = '<i class="fas fa-sun"></i>&nbsp;Efficiency';
    showEfficiencyBtn.id = 'show-efficiency-btn';
    showEfficiencyBtn.title = 'Show/hide roof efficiency';
    showEfficiencyBtn.className = 'btn primary compact-btn';
    
    showEfficiencyBtn.addEventListener('click', () => {
        if (!state.showingEfficiencyColors) {
            import('./solar_panel/panel_placement.js').then(module => {
                module.visualizeAllRoofEfficiencies();
                showEfficiencyBtn.innerHTML = '<i class="fas fa-sun"></i>&nbsp;Hide Eff.';
                showEfficiencyBtn.classList.remove('primary');
                showEfficiencyBtn.classList.add('secondary');
                state.showingEfficiencyColors = true;
            });
        } else {
            import('./solar_panel/panel_placement.js').then(module => {
                module.resetAllRoofColors();
                showEfficiencyBtn.innerHTML = '<i class="fas fa-sun"></i>&nbsp;Efficiency';
                showEfficiencyBtn.classList.remove('secondary');
                showEfficiencyBtn.classList.add('primary');
                state.showingEfficiencyColors = false;
            });
        }
    });
    
    const splitVerticesBtn = document.createElement('button');
    splitVerticesBtn.innerHTML = '<i class="fas fa-object-ungroup"></i>&nbsp;Split Off';
    splitVerticesBtn.className = 'btn primary compact-btn';
    splitVerticesBtn.title = 'Enable/disable vertex splitting';
    
    splitVerticesBtn.addEventListener('click', () => {
        state.areVerticesSeparated = !state.areVerticesSeparated;
        
        if (state.areVerticesSeparated) {
            splitVerticesBtn.innerHTML = '<i class="fas fa-object-ungroup"></i>&nbsp;Split On';
            splitVerticesBtn.classList.remove('primary');
            splitVerticesBtn.classList.add('danger');
        } else {
            splitVerticesBtn.innerHTML = '<i class="fas fa-object-ungroup"></i>&nbsp;Split Off';
            splitVerticesBtn.classList.remove('danger');
            splitVerticesBtn.classList.add('primary');
        }
    });
    
    const statsButton = document.createElement('button');
    statsButton.className = 'btn primary compact-btn';
    statsButton.innerHTML = '<i class="fas fa-chart-line"></i>&nbsp;Stats';
    statsButton.title = 'View detailed statistics';
    statsButton.addEventListener('click', () => {
        showStatisticsModal();
    });
    
    const clearPanelsBtn = document.createElement('button');
    clearPanelsBtn.className = 'btn danger compact-btn';
    clearPanelsBtn.innerHTML = '<i class="fas fa-trash"></i>&nbsp;Clear Panels';
    clearPanelsBtn.title = 'Remove all placed panels';
    clearPanelsBtn.id = 'clear-panels-btn';
    clearPanelsBtn.disabled = true;
    clearPanelsBtn.classList.add('disabled');
    
    clearPanelsBtn.addEventListener('click', () => {
        const selectedRoofIndices = [...state.solarPanel.selectedRoofIndices];
        
        state.solarPanel.selectedRoofIndices = [];
        state.solarPanel.isBudgetConstrained = false;
        state.solarPanel.isPowerConstrained = false;
        state.solarPanel.isLimitedByRoof = false;
        state.solarPanel.totalPanelsFit = 0;
        state.solarPanel.totalMaxPanelsFit = 0;
        updateSolarCalculations();
        
        import('./solar_panel/panel_model.js').then(module => {
            module.clearExistingPanels();
        });
        
        import('./interaction.js').then(module => {
            for (const roofIndex of selectedRoofIndices) {
                const roofMesh = state.currentMeshes.find(mesh => mesh.userData.polygonIndex === roofIndex);
                if (roofMesh) {
                    module.removeRoofOutline(roofMesh);
                }
            }
        });
        
        clearPanelsBtn.disabled = true;
        clearPanelsBtn.classList.add('disabled');
    });
    
    panelButtonContainer.appendChild(orientationBtn);
    panelButtonContainer.appendChild(showEfficiencyBtn);
    panelButtonContainer.appendChild(splitVerticesBtn);
    panelButtonContainer.appendChild(statsButton);
    panelButtonContainer.appendChild(clearPanelsBtn);
    
    panelContent.appendChild(panelButtonContainer);
    
    // ----------------------------------BUDGET TAB CONTENT ----------------------------------
    // Create budget section
    const budgetSection = document.createElement('div');
    budgetSection.className = 'section';
    
    const budgetLabel = document.createElement('label');
    budgetLabel.textContent = 'Max Budget (€):';
    budgetLabel.htmlFor = 'max-budget';
    
    // Create a wrapper for the input and clear button
    const budgetInputWrapper = document.createElement('div');
    budgetInputWrapper.className = 'input-wrapper';
    budgetInputWrapper.style.display = 'flex';
    budgetInputWrapper.style.alignItems = 'center';
    budgetInputWrapper.style.marginBottom = '10px';
    
    const budgetInput = document.createElement('input');
    budgetInput.type = 'number';
    budgetInput.id = 'max-budget';
    budgetInput.value = state.solarPanel.maxBudget;
    budgetInput.min = '0';
    budgetInput.step = '100';
    budgetInput.className = 'form-control';
    budgetInput.style.flexGrow = '1';
    budgetInput.style.padding = '5px';
    budgetInput.style.border = '1px solid #ddd';
    budgetInput.style.borderRadius = '4px';
    budgetInput.style.margin = '0';
    
    // Create clear button for budget
    const budgetClearBtn = document.createElement('button');
    budgetClearBtn.innerHTML = '&#10005;';
    budgetClearBtn.className = 'clear-button';
    budgetClearBtn.title = 'Clear budget';
    budgetClearBtn.style.marginLeft = '5px';
    
    // Add input and clear button to wrapper
    budgetInputWrapper.appendChild(budgetInput);
    budgetInputWrapper.appendChild(budgetClearBtn);
    
    budgetInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        const newBudget = value === '' ? 0 : parseFloat(value);
        
        if (!isNaN(newBudget) && newBudget >= 0) {
            state.solarPanel.maxBudget = newBudget;
            
            if (state.solarPanel.selectedRoofIndices && state.solarPanel.selectedRoofIndices.length > 0) {
                updatePanelsBasedOnConstraints();
            }
        }
    });
    
    budgetClearBtn.addEventListener('click', () => {
        budgetInput.value = '';
        state.solarPanel.maxBudget = 0;
        
        if (state.solarPanel.selectedRoofIndices && state.solarPanel.selectedRoofIndices.length > 0) {
            updatePanelsBasedOnConstraints();
        }
    });
    
    budgetSection.appendChild(budgetLabel);
    budgetSection.appendChild(budgetInputWrapper);
    
    // Create target power section
    const powerSection = document.createElement('div');
    powerSection.className = 'section';
    
    const powerLabel = document.createElement('label');
    powerLabel.textContent = 'Target Power (W):';
    powerLabel.htmlFor = 'target-power';
    
    // Create a wrapper for the power input and clear button
    const powerInputWrapper = document.createElement('div');
    powerInputWrapper.className = 'input-wrapper';
    powerInputWrapper.style.display = 'flex';
    powerInputWrapper.style.alignItems = 'center';
    powerInputWrapper.style.marginBottom = '10px';
    
    const powerInput = document.createElement('input');
    powerInput.type = 'number';
    powerInput.id = 'target-power';
    powerInput.value = state.solarPanel.targetPower;
    powerInput.min = '0';
    powerInput.step = '100';
    powerInput.className = 'form-control'; 
    powerInput.style.flexGrow = '1';
    powerInput.style.padding = '5px';
    powerInput.style.border = '1px solid #ddd';
    powerInput.style.borderRadius = '4px';
    powerInput.style.margin = '0';
    
    // Create clear button for power
    const powerClearBtn = document.createElement('button');
    powerClearBtn.innerHTML = '&#10005;';
    powerClearBtn.className = 'clear-button';
    powerClearBtn.title = 'Clear target power';
    powerClearBtn.style.marginLeft = '5px';
    
    // Add input and clear button to wrapper
    powerInputWrapper.appendChild(powerInput);
    powerInputWrapper.appendChild(powerClearBtn);
    
    powerInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        const newPower = value === '' ? 0 : parseFloat(value);
        
        if (!isNaN(newPower) && newPower >= 0) {
            state.solarPanel.targetPower = newPower;
            
            if (state.solarPanel.selectedRoofIndices && state.solarPanel.selectedRoofIndices.length > 0) {
                updatePanelsBasedOnConstraints();
            }
        }
    });
    
    powerClearBtn.addEventListener('click', () => {
        powerInput.value = '';
        state.solarPanel.targetPower = 0;
        
        if (state.solarPanel.selectedRoofIndices && state.solarPanel.selectedRoofIndices.length > 0) {
            updatePanelsBasedOnConstraints();
        }
    });
    
    powerSection.appendChild(powerLabel);
    powerSection.appendChild(powerInputWrapper);
    
    // Create power progress section
    const powerProgressSection = document.createElement('div');
    powerProgressSection.className = 'progress-section';
    
    const powerProgressLabel = document.createElement('div');
    powerProgressLabel.innerHTML = '<strong>Power Goal Progress:</strong>';
    
    // Create progress bar container and elements
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'progress-bar-container';
    progressBarContainer.style.backgroundColor = '#e9ecef';
    progressBarContainer.style.border = '1px solid #ced4da';
    progressBarContainer.style.borderRadius = '4px';
    progressBarContainer.style.overflow = 'hidden';
    progressBarContainer.style.height = '24px'; 
    progressBarContainer.style.position = 'relative';
    progressBarContainer.style.marginTop = '8px';
    progressBarContainer.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.15)';

    const progressBar = document.createElement('div');
    progressBar.id = 'power-progress-bar';
    progressBar.className = 'progress-bar';
    progressBar.style.height = '100%';
    progressBar.style.transition = 'width 0.2s ease-in-out';
    progressBar.style.position = 'absolute';
    progressBar.style.left = '0';
    progressBar.style.top = '0';
    progressBar.style.boxShadow = '0 0 5px rgba(0,0,0,0.2)';

    const progressText = document.createElement('div');
    progressText.id = 'power-progress-text';
    progressText.className = 'progress-text';
    progressText.textContent = '0%';
    progressText.style.position = 'absolute';
    progressText.style.width = '100%';
    progressText.style.height = '100%'; 
    progressText.style.display = 'flex';
    progressText.style.alignItems = 'center';
    progressText.style.justifyContent = 'center';
    progressText.style.fontWeight = 'bold';
    progressText.style.fontSize = '1.1em'; 
    progressText.style.padding = '0'; 
    progressText.style.margin = '0';
    progressText.style.lineHeight = '24px';
    progressText.style.top = '0';
    progressText.style.left = '0';
    progressText.style.zIndex = '2';
    progressText.style.textShadow = '0 1px 1px rgba(0,0,0,0.3)';
    
    progressBarContainer.appendChild(progressBar);
    progressBarContainer.appendChild(progressText);
    powerProgressSection.appendChild(powerProgressLabel);
    powerProgressSection.appendChild(progressBarContainer);
    
    // Add budget constraint indicator
    const budgetConstraintInfo = document.createElement('div');
    budgetConstraintInfo.id = 'budget-constraint-info';
    budgetConstraintInfo.className = 'budget-constraint-info';
    
    // Add wall height control section to budget tab
    const heightControlSection = document.createElement('div');
    heightControlSection.className = 'height-control-section';
    
    const heightTitle = document.createElement('h5');
    heightTitle.textContent = 'Building Wall Height';
    heightControlSection.appendChild(heightTitle);
    
    const heightInfo = document.createElement('p');
    heightInfo.className = 'height-info';
    heightInfo.textContent = 'Adjust the wall height of all buildings in the scene.';
    heightControlSection.appendChild(heightInfo);
    
    const heightSliderWrapper = document.createElement('div');
    heightSliderWrapper.className = 'height-slider-wrapper';
    
    const heightSlider = document.createElement('input');
    heightSlider.type = 'range';
    heightSlider.id = 'wall-height';
    heightSlider.min = '0';
    heightSlider.max = '50';
    heightSlider.value = '10';
    heightSlider.step = '0.01';
    heightSlider.className = 'form-range'; 
    heightSlider.style.flex = '1';
    
    const heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.id = 'wall-height-text';
    heightInput.min = '0';
    heightInput.max = '50';
    heightInput.value = '10';
    heightInput.step = '0.01';
    heightInput.className = 'form-control';
    heightInput.style.width = '60px';
    heightInput.style.marginLeft = '10px';
    heightInput.style.padding = '5px';
    heightInput.style.border = '1px solid #ddd';
    heightInput.style.borderRadius = '4px';
    heightInput.style.textAlign = 'center';
    heightInput.style.margin = '0';
    
    // Add the elements to the wrapper
    heightSliderWrapper.appendChild(heightSlider);
    heightSliderWrapper.appendChild(heightInput);
    heightControlSection.appendChild(heightSliderWrapper);
    
    // Add OSM Building Height button
    const osmHeightButton = document.createElement('button');
    osmHeightButton.innerHTML = '<i class="fas fa-magic"></i>&nbspAuto Detect Height';
    osmHeightButton.className = 'btn primary';
    osmHeightButton.title = 'Auto-detect building height';
    osmHeightButton.id = 'osm-height-button';
    osmHeightButton.style.marginTop = '10px';
    osmHeightButton.style.width = '100%';
    osmHeightButton.style.padding = '8px';
    osmHeightButton.style.fontSize = '0.9em';
    osmHeightButton.disabled = true;
    osmHeightButton.addEventListener('click', fetchOSMBuildingHeight);
    heightControlSection.appendChild(osmHeightButton);
    
    // Add the height control functionality
    heightSlider.addEventListener('input', (e) => {
        const height = parseFloat(e.target.value);
        heightInput.value = height.toFixed(2);
        updateBuildingHeights(height);
    });
    
    heightSlider.addEventListener('change', () => {
        saveAllRoofData();
    });
    
    heightInput.addEventListener('input', (e) => {
        const height = parseFloat(e.target.value);
        if (!isNaN(height)) {
            heightSlider.value = height;
            updateBuildingHeights(height);
        }
    });
    
    heightInput.addEventListener('change', () => {
        saveAllRoofData();
    });
    
    // Add all sections to budget tab content
    budgetContent.appendChild(budgetSection);
    budgetContent.appendChild(powerSection);
    budgetContent.appendChild(powerProgressSection);
    budgetContent.appendChild(heightControlSection); 
    budgetContent.appendChild(budgetConstraintInfo);
    
    //-------------------------SUN SIMULATION TAB CONTENT------------------------
    
    // Create date slider group
    const dateContainer = document.createElement('div');
    dateContainer.className = 'slider-group';
    
    const dateHeader = document.createElement('div');
    dateHeader.className = 'slider-header';
    
    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Date: ';
    dateHeader.appendChild(dateLabel);
    
    const dateDisplay = document.createElement('span');
    dateDisplay.id = 'date-display';
    dateDisplay.textContent = formatDate(new Date());
    dateHeader.appendChild(dateDisplay);
    
    dateContainer.appendChild(dateHeader);
    
    const dateSlider = document.createElement('input');
    dateSlider.type = 'range';
    dateSlider.min = '1';
    dateSlider.max = '365';
    dateSlider.value = getDayOfYear(new Date());
    dateSlider.className = 'form-range';
    dateSlider.style.width = '100%';
    dateSlider.style.display = 'block';
    
    dateSlider.addEventListener('input', (e) => {
        const dayOfYear = parseInt(e.target.value);
        const currentDate = window.sunState ? window.sunState.date : new Date();
        const date = getDayFromDayNumber(currentDate.getFullYear(), dayOfYear);
        
        if (window.sunState) {
            window.sunState.date = date;
        }
        
        dateDisplay.textContent = formatDate(date);
        
        if (window.updateSunPosition) {
            window.updateSunPosition();
        }
    });
    
    dateContainer.appendChild(dateSlider);
    sunContent.appendChild(dateContainer);
    
    // Create time slider group
    const timeContainer = document.createElement('div');
    timeContainer.className = 'slider-group';
    
    const timeHeader = document.createElement('div');
    timeHeader.className = 'slider-header';
    
    const timeLabel = document.createElement('label');
    timeLabel.textContent = 'Time: ';
    timeHeader.appendChild(timeLabel);
    
    const timeDisplay = document.createElement('span');
    timeDisplay.id = 'time-display';
    timeDisplay.textContent = formatTime(new Date());
    timeHeader.appendChild(timeDisplay);
    
    timeContainer.appendChild(timeHeader);
    
    const timeSlider = document.createElement('input');
    timeSlider.type = 'range';
    timeSlider.min = '0';
    timeSlider.max = '1440'; // minutes in a day
    const now = new Date();
    timeSlider.value = now.getHours() * 60 + now.getMinutes();
    timeSlider.className = 'form-range';
    timeSlider.style.width = '100%'; 
    timeSlider.style.display = 'block';
    
    timeSlider.addEventListener('input', (e) => {
        const minutes = parseInt(e.target.value);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (window.sunState) {
            window.sunState.date.setHours(hours, mins);
        }
        
        timeDisplay.textContent = formatTime(window.sunState ? window.sunState.date : new Date());
        
        if (window.updateSunPosition) {
            window.updateSunPosition();
        }
    });
    
    timeContainer.appendChild(timeSlider);
    sunContent.appendChild(timeContainer);
    
    // Add sun options
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'checkbox-group';

    // Show helper toggle switch
    const helperLabel = document.createElement('label');
    helperLabel.className = 'toggle-switch-label';
    helperLabel.style.display = 'flex';
    helperLabel.style.alignItems = 'center';
    helperLabel.style.justifyContent = 'flex-start'; 
    helperLabel.style.width = '100%';
    helperLabel.style.marginBottom = '12px';
    helperLabel.style.cursor = 'pointer';
    helperLabel.style.fontSize = '14px';

    // Create toggle container
    const helperToggleContainer = document.createElement('div');
    helperToggleContainer.className = 'toggle-switch-container';
    helperToggleContainer.style.position = 'relative';
    helperToggleContainer.style.display = 'inline-block';
    helperToggleContainer.style.width = '40px';
    helperToggleContainer.style.height = '20px';
    helperToggleContainer.style.marginRight = '10px';


    // Hidden checkbox
    const helperCheck = document.createElement('input');
    helperCheck.type = 'checkbox';
    helperCheck.checked = false;
    helperCheck.style.opacity = '0';
    helperCheck.style.width = '0';
    helperCheck.style.height = '0';

    // Slider element
    const helperSlider = document.createElement('span');
    helperSlider.className = 'toggle-slider';
    helperSlider.style.position = 'absolute';
    helperSlider.style.cursor = 'pointer';
    helperSlider.style.top = '0';
    helperSlider.style.left = '0';
    helperSlider.style.right = '0';
    helperSlider.style.bottom = '0';
    helperSlider.style.backgroundColor = '#ccc';
    helperSlider.style.borderRadius = '20px';
    helperSlider.style.transition = '0.4s';

    // Toggle dot/circle
    const helperDot = document.createElement('span');
    helperDot.style.position = 'absolute';
    helperDot.style.content = '""';
    helperDot.style.height = '16px';
    helperDot.style.width = '16px';
    helperDot.style.left = '2px';
    helperDot.style.bottom = '2px';
    helperDot.style.backgroundColor = 'white';
    helperDot.style.borderRadius = '50%';
    helperDot.style.transition = '0.4s';

    helperSlider.appendChild(helperDot);
    helperToggleContainer.appendChild(helperCheck);
    helperToggleContainer.appendChild(helperSlider);

    // Add the same event listener
    helperCheck.addEventListener('change', (e) => {
        if (window.sunState) {
            window.sunState.showSunHelper = e.target.checked;
            
            // Update toggle appearance
            helperSlider.style.backgroundColor = e.target.checked ? '#1976d2' : '#ccc';
            helperDot.style.transform = e.target.checked ? 'translateX(20px)' : 'translateX(0)';
            
            if (window.sunState.showSunHelper) {
                state.scene.add(window.sunState.helper);
            } else {
                state.scene.remove(window.sunState.helper);
            }
        }
    });

    // Add text and toggle to label
    helperLabel.appendChild(helperToggleContainer); 
    helperLabel.appendChild(document.createTextNode('Show Sun Direction'));
    optionsContainer.appendChild(helperLabel);

    // Auto movement toggle switch 
    const autoMovementLabel = document.createElement('label');
    autoMovementLabel.className = 'toggle-switch-label';
    autoMovementLabel.style.display = 'flex';
    autoMovementLabel.style.alignItems = 'center';
    autoMovementLabel.style.justifyContent = 'flex-start'; 
    autoMovementLabel.style.width = '100%';
    autoMovementLabel.style.marginBottom = '8px';
    autoMovementLabel.style.cursor = 'pointer';
    autoMovementLabel.style.fontSize = '14px'; 

    // Create toggle container
    const autoToggleContainer = document.createElement('div');
    autoToggleContainer.className = 'toggle-switch-container';
    autoToggleContainer.style.position = 'relative';
    autoToggleContainer.style.display = 'inline-block';
    autoToggleContainer.style.width = '40px';
    autoToggleContainer.style.height = '20px';
    autoToggleContainer.style.marginRight = '10px';
    

    const autoMovementCheck = document.createElement('input');
    autoMovementCheck.type = 'checkbox';
    autoMovementCheck.checked = false;
    autoMovementCheck.style.opacity = '0';
    autoMovementCheck.style.width = '0';
    autoMovementCheck.style.height = '0';

    // Slider element
    const autoSlider = document.createElement('span');
    autoSlider.className = 'toggle-slider';
    autoSlider.style.position = 'absolute';
    autoSlider.style.cursor = 'pointer';
    autoSlider.style.top = '0';
    autoSlider.style.left = '0';
    autoSlider.style.right = '0';
    autoSlider.style.bottom = '0';
    autoSlider.style.backgroundColor = '#ccc';
    autoSlider.style.borderRadius = '20px';
    autoSlider.style.transition = '0.4s';

    // Toggle dot/circle
    const autoDot = document.createElement('span');
    autoDot.style.position = 'absolute';
    autoDot.style.content = '""';
    autoDot.style.height = '16px';
    autoDot.style.width = '16px';
    autoDot.style.left = '2px';
    autoDot.style.bottom = '2px';
    autoDot.style.backgroundColor = 'white';
    autoDot.style.borderRadius = '50%';
    autoDot.style.transition = '0.4s';

    autoSlider.appendChild(autoDot);
    autoToggleContainer.appendChild(autoMovementCheck);
    autoToggleContainer.appendChild(autoSlider);

    autoMovementCheck.addEventListener('change', (e) => {
        if (window.toggleAutoMovement) {
            window.toggleAutoMovement(e.target.checked);
            
            // Update toggle appearance
            autoSlider.style.backgroundColor = e.target.checked ? '#1976d2' : '#ccc';
            autoDot.style.transform = e.target.checked ? 'translateX(20px)' : 'translateX(0)';
        }
    });

    autoMovementLabel.appendChild(autoToggleContainer);
    autoMovementLabel.appendChild(document.createTextNode('Auto Movement'));
    optionsContainer.appendChild(autoMovementLabel);

    sunContent.appendChild(optionsContainer);
    
    // Create speed control slider
    const speedContainer = document.createElement('div');
    speedContainer.className = 'slider-group';
    
    const speedHeader = document.createElement('div');
    speedHeader.className = 'slider-header';
    speedHeader.textContent = 'Animation Speed:';
    speedContainer.appendChild(speedHeader);
    
    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.min = '1';
    speedSlider.max = '100';
    speedSlider.value = '10';
    speedSlider.className = 'form-range';
    speedSlider.style.width = '100%';
    speedSlider.style.display = 'block';
    
    speedSlider.addEventListener('input', (e) => {
        if (window.sunState) {
            window.sunState.timeSpeed = parseInt(e.target.value);
        }
    });
    
    speedContainer.appendChild(speedSlider);
    sunContent.appendChild(speedContainer);
    
    // Create sun intensity slider
    const intensityContainer = document.createElement('div');
    intensityContainer.className = 'slider-group';
    
    const intensityHeader = document.createElement('div');
    intensityHeader.className = 'slider-header';
    intensityHeader.textContent = 'Sun Intensity:';
    intensityContainer.appendChild(intensityHeader);
    
    const intensitySlider = document.createElement('input');
    intensitySlider.type = 'range';
    intensitySlider.min = '1';
    intensitySlider.max = '10';
    intensitySlider.step = '0.1';
    intensitySlider.value = '5';
    intensitySlider.className = 'form-range';
    intensitySlider.style.width = '100%'; 
    intensitySlider.style.display = 'block'; 
    
    intensitySlider.addEventListener('input', (e) => {
        if (window.sunState) {
            window.sunState.sunIntensity = parseFloat(e.target.value);
            
            if (window.updateSunPosition) {
                window.updateSunPosition();
            }
        }
    });
    
    intensityContainer.appendChild(intensitySlider);
    sunContent.appendChild(intensityContainer);
    
    contentDiv.appendChild(panelContent);
    contentDiv.appendChild(budgetContent);
    contentDiv.appendChild(sunContent);
    
    // Add content to container
    container.appendChild(contentDiv);
    
    // Load available panels and populate dropdown
    loadAvailablePanels(panelDropdown, specsSection);
    
    // Handle panel selection change
    panelDropdown.addEventListener('change', (e) => {
        const selectedPanelId = e.target.value;
        updateSelectedPanel(selectedPanelId, specsSection);
    });
    
    // Handle new panel creation
    newPanelBtn.addEventListener('click', () => {
        showPanelCreationModal(panelDropdown, specsSection);
    });
    
    // Style the container
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.left = '10px';
    container.style.maxWidth = '280px';
    container.style.maxHeight = 'calc(100% - 60px)';
    container.style.overflow = 'auto';
    container.style.zIndex = '100';
    
    const threeContainer = document.getElementById('three-container');
    threeContainer.appendChild(container);
    
    // Initialize calculations
    updateSolarCalculations();
    
    initSunSimulation();
    
    let sunUIInitialized = false;
    sunTab.addEventListener('click', () => {
        if (!sunUIInitialized) {

            sunUIInitialized = true;

            if (window.sunState) {
                dateSlider.value = getDayOfYear(window.sunState.date);
                dateDisplay.textContent = formatDate(window.sunState.date);
                
                const minutes = window.sunState.date.getHours() * 60 + window.sunState.date.getMinutes();
                timeSlider.value = minutes;
                timeDisplay.textContent = formatTime(window.sunState.date);
                
                helperCheck.checked = window.sunState.showSunHelper;
                autoMovementCheck.checked = window.sunState.autoMovement;
                speedSlider.value = window.sunState.timeSpeed;
                intensitySlider.value = window.sunState.sunIntensity;
            }
        }
    });
    
    return container;
}

function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function getDayFromDayNumber(year, dayOfYear) {
    const date = new Date(year, 0, 0);
    const currentDate = window.sunState ? window.sunState.date : new Date();
    const currentHours = currentDate.getHours();
    const currentMinutes = currentDate.getMinutes();
    const currentSeconds = currentDate.getSeconds();
    
    date.setDate(date.getDate() + dayOfYear);
    date.setHours(currentHours, currentMinutes, currentSeconds);
    
    return date;
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

export function updateSolarCalculations() {
    const panelCount = state.solarPanel.panels.length;
    const panelWattage = state.solarPanel.power.wattage;
    const targetPower = state.solarPanel.targetPower;
    
    let totalPower = 0;
    

    for (const panel of state.solarPanel.panels) {
        const efficiency = panel.userData.roofEfficiency || 100;

        const panelPower = panelWattage * (efficiency / 100);
        totalPower += panelPower;
    }
    
    // Update panel count display
    const panelCountElement = document.getElementById('panel-count');
    if (panelCountElement) {
        panelCountElement.innerHTML = `<strong>Panels placed:</strong> ${panelCount}${totalPower > 0 ? ` (${Math.round(totalPower).toLocaleString()}W)` : ''}`;
    }
    
    // Update clear panels button state
    const clearPanelsBtn = document.getElementById('clear-panels-btn');
    if (clearPanelsBtn) {
        if (state.solarPanel.selectedRoofIndices && state.solarPanel.selectedRoofIndices.length > 0) {
            clearPanelsBtn.disabled = false;
            clearPanelsBtn.classList.remove('disabled');
        } else {
            clearPanelsBtn.disabled = true;
            clearPanelsBtn.classList.add('disabled');
        }
    }
    
    // Update power goal progress display
    const progressBar = document.getElementById('power-progress-bar');
    const progressText = document.getElementById('power-progress-text');
    const powerProgressSection = document.querySelector('.progress-section');
    
    if (progressBar && progressText && powerProgressSection) {
        // Hide progress bar if no target power is set
        if (!targetPower || targetPower <= 0) {
            powerProgressSection.style.display = 'none';
        } else {
            powerProgressSection.style.display = 'block';
            
            // Calculate percentage
            const percentage = Math.min(100, Math.round((totalPower / targetPower) * 100));
            
            progressBar.style.width = `${percentage}%`;
            
            if (percentage < 50) {
                progressBar.style.background = 'linear-gradient(to right, #dc3545, #e74c3c)';
                progressBar.style.opacity = '1'; 
                progressBar.style.boxShadow = '0 0 8px rgba(220, 53, 69, 0.5)'; 
                progressText.style.color = '#000000'; 
            } else if (percentage < 100) {
                progressBar.style.background = 'linear-gradient(to right, #ffc107, #f39c12)';
                progressBar.style.opacity = '1'; 
                progressBar.style.boxShadow = '0 0 8px rgba(255, 193, 7, 0.5)'; 
                progressText.style.color = '#000000'; 
            } else {
                progressBar.style.background = 'linear-gradient(to right, #28a745, #2ecc71)';
                progressBar.style.opacity = '1';
                progressBar.style.boxShadow = '0 0 8px rgba(40, 167, 69, 0.5)'; 
                progressText.style.color = '#ffffff'; 
            }
            
            progressText.textContent = `${percentage}%`;
        }
    }
    
    const budgetConstraintInfo = document.getElementById('budget-constraint-info');
    if (budgetConstraintInfo) {
        budgetConstraintInfo.style.display = 'none';

        if (state.solarPanel.selectedRoofIndices.length === 0) {
            budgetConstraintInfo.style.display = 'none';
            return;
        }
        
        const coverage = state.solarPanel.totalMaxPanelsFit > 0 ? 
            Math.round((state.solarPanel.totalPanelsFit / state.solarPanel.totalMaxPanelsFit) * 100) : 0;
        const coverageInfo = state.solarPanel.selectedRoofIndices.length > 0 ? 
            `${coverage}% roof coverage` : '';
            
        if (state.solarPanel.isBudgetConstrained && state.solarPanel.targetPower > 0) {
            // Budget is limiting power target
            budgetConstraintInfo.style.display = 'block';
            budgetConstraintInfo.style.backgroundColor = '#fff3cd';
            budgetConstraintInfo.style.color = '#856404';
            budgetConstraintInfo.innerHTML = `
                <strong>Budget Limited:</strong> Your budget limits power potential.
                ${coverageInfo ? `<br>${coverageInfo}` : ''}
            `;
        } else if (state.solarPanel.isPowerConstrained) {
            // Power target met!
            budgetConstraintInfo.style.display = 'block';
            budgetConstraintInfo.style.backgroundColor = '#d4edda';
            budgetConstraintInfo.style.color = '#155724';
            budgetConstraintInfo.innerHTML = `
                <strong>Target Met:</strong> Power goal achieved.
                ${coverageInfo ? `<br>${coverageInfo}` : ''}
            `;
        } else if (state.solarPanel.isLimitedByRoof && state.solarPanel.targetPower > 0) {
            // Roof size limits power target
            budgetConstraintInfo.style.display = 'block';
            budgetConstraintInfo.style.backgroundColor = '#f8d7da';
            budgetConstraintInfo.style.color = '#721c24';
            budgetConstraintInfo.innerHTML = `
                <strong>Space Limited:</strong> Roof too small for power goal.
                ${coverageInfo ? `<br>${coverageInfo}` : ''}
            `;
        } else if (coverageInfo) {
            // Just show coverage if no constraints
            budgetConstraintInfo.style.display = 'block';
            budgetConstraintInfo.style.backgroundColor = '#e9ecef'; 
            budgetConstraintInfo.style.color = '#212529';
            budgetConstraintInfo.innerHTML = coverageInfo;
        }
    }
}

function updatePanelsBasedOnConstraints() {
    import('./solar_panel/panel_placement.js').then(module => {
        module.updatePanelsForAllSelectedRoofs();
        updateSolarCalculations();
        
        const clearPanelsBtn = document.getElementById('clear-panels-btn');
        if (clearPanelsBtn && state.solarPanel.selectedRoofIndices.length > 0) {
            clearPanelsBtn.disabled = false;
            clearPanelsBtn.classList.remove('disabled');
        }
    });
}

function deleteSolarPanel(panelId, specsSection) {
    fetch(`/solar/api/panels/${panelId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': getCsrfToken()
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        if (state.solarPanel.id === panelId) {
            fetch('/solar/api/panels/')
                .then(response => response.json())
                .then(panels => {
                    const defaultPanel = panels.find(p => p.is_default);
                    if (defaultPanel) {
                        state.solarPanel.id = defaultPanel.id;
                        state.solarPanel.name = defaultPanel.name;
                        state.solarPanel.width = defaultPanel.width;
                        state.solarPanel.height = defaultPanel.height;
                        state.solarPanel.thickness = defaultPanel.thickness;
                        state.solarPanel.power.wattage = defaultPanel.wattage;
                        state.solarPanel.power.efficiency = defaultPanel.efficiency;
                        state.solarPanel.cost = defaultPanel.cost;
                        
                        const panelDropdown = document.getElementById('panel-select');
                        if (panelDropdown) {
                            panelDropdown.value = defaultPanel.id;
                            updatePanelDisplay(defaultPanel, specsSection);
                        }
                        
                        if (state.solarPanel.selectedRoofIndices && 
                            state.solarPanel.selectedRoofIndices.length > 0) {
                            updatePanelsBasedOnConstraints();
                        }
                    }
                });
        }
        
        import('../modals.js').then(module => {
            module.showSuccessModal('Panel Deleted', 'The panel has been deleted successfully.');
        });
        
        const panelDropdown = document.getElementById('panel-select');
        if (panelDropdown && specsSection) {
            loadAvailablePanels(panelDropdown, specsSection);
        }
    })
    .catch(error => {
        console.error('Error deleting panel:', error);
        import('../modals.js').then(module => {
            module.showErrorModal('Error', 'Failed to delete the panel. Please try again.');
        });
    });
}

function getCsrfToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    return cookieValue || '';
}