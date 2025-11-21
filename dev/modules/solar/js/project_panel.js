import { getCSRFToken, loadExistingShapes } from './api.js';
import { showDeleteConfirmationModal, showSuccessModal } from './modals.js';

let projectPanel;
let panelHeader;
let panelContent;
let projectList;
let headerTitle;
let collapseIcon;
let createProjectBtn;

//state
let isExpanded = false;
let currentProjectId = null;
let projects = [];


export function initProjectPanel() {
    projectPanel = document.querySelector('.project-selection-panel');
    panelHeader = projectPanel.querySelector('.panel-header');
    panelContent = projectPanel.querySelector('.panel-content');
    projectList = projectPanel.querySelector('.project-list');
    headerTitle = panelHeader.querySelector('h4');
    collapseIcon = panelHeader.querySelector('.collapse-icon');
    createProjectBtn = projectPanel.querySelector('.create-project-btn');

    headerTitle.innerHTML = '<i class="fas fa-folder-open"></i> Select a Project';

    panelHeader.addEventListener('click', togglePanel);
    createProjectBtn.addEventListener('click', handleCreateProject);
    
    collapseContent();
    
    loadProjects();

    document.addEventListener('click', (event) => {
        if (isExpanded && !projectPanel.contains(event.target)) {
            collapseContent();
        }
    });
}


function togglePanel() {
    if (isExpanded) {
        collapseContent();
    } else {
        expandContent();
    }
}


function expandContent() {
    isExpanded = true;
    
    const headerHeight = document.querySelector('header').offsetHeight;

    panelContent.style.display = 'block';
    panelContent.style.top = `${headerHeight}px`;
    
    collapseIcon.classList.remove('collapsed');
    projectPanel.classList.add('expanded');
    
    panelContent.style.zIndex = '1000';
    
    document.body.classList.add('project-panel-expanded');
}


function collapseContent() {
    isExpanded = false;
    panelContent.style.display = 'none';
    collapseIcon.classList.add('collapsed');
    projectPanel.classList.remove('expanded');
    
    document.body.classList.remove('project-panel-expanded');
}


function loadProjects() {
    fetch('/solar/api/projects/')
        .then(response => response.json())
        .then(data => {
            projects = data;
            renderProjects(data);

            for (const project of projects) {
                updateAddressForProject(project.id);
            }
        })
        .catch(error => {
            console.error('Error loading projects:', error);
        });
}


function renderProjects(projects) {
    projectList.innerHTML = '';
    
    if (projects.length === 0) {
        projectList.innerHTML = '<li class="no-projects" style="color: #333;">No projects available</li>';
        headerTitle.innerHTML = '<i class="fas fa-folder-open"></i> No Projects Available';
        return;
    }
    
    projects.forEach(project => {
        const li = document.createElement('li');
        li.dataset.id = project.id;
        
        if (project.id === currentProjectId) {
            li.classList.add('selected');
            if (currentProjectId) {
                headerTitle.textContent = project.name;
            }
        }
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'project-delete-btn';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.title = 'Delete project';
        
        // handle delete button click
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeleteConfirmationModal(project.id, project.name, (projectId) => {
                deleteProject(projectId);
            });
        });
        
        const projectInfo = document.createElement('div');
        projectInfo.className = 'project-info';
        
        const projectName = document.createElement('span');
        projectName.className = 'project-name';
        projectName.textContent = project.name;
        
        const projectAddress = document.createElement('span');
        projectAddress.className = 'project-address';
        
        // set address text or placeholder
        if (project.address) {
            projectAddress.textContent = project.address;
        } else {
            projectAddress.textContent = 'No location data available';
            projectAddress.classList.add('address-placeholder');
        }
        
        projectInfo.appendChild(projectName);
        projectInfo.appendChild(projectAddress);
        
        li.appendChild(projectInfo);
        li.appendChild(deleteButton);
        
        li.addEventListener('click', () => selectProject(project));
        
        projectList.appendChild(li);
    });
}


function selectProject(project) {
    currentProjectId = project.id;
    
    headerTitle.innerHTML = '<i class="fas fa-folder-open"></i> ' + project.name;
    
    const items = projectList.querySelectorAll('li');
    items.forEach(item => {
        if (item.dataset.id === project.id.toString()) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    loadExistingShapes(project.id);
    
    updateDeleteButtonState();
    
    if (!project.address) {
        updateAddressForProject(project.id);
    }
    
    collapseContent();
}


const addressLookupsInProgress = new Set();
function updateAddressForProject(projectId) {
    if (addressLookupsInProgress.has(projectId)) {
        return;
    }
    
    addressLookupsInProgress.add(projectId);
    
    import('./project.js').then(module => {
        module.calculateProjectCenter(projectId).then(center => {
            if (center) {
                module.getAddressFromCoordinates(center.lat, center.lng).then(address => {
                    if (address) {
                        updateProjectInfo(projectId, { address: address }, true);
                    }
                    addressLookupsInProgress.delete(projectId);
                }).catch(() => {
                    addressLookupsInProgress.delete(projectId);
                });
            } else {
                addressLookupsInProgress.delete(projectId);
            }
        }).catch(() => {
            addressLookupsInProgress.delete(projectId);
        });
    });
}


function updateDeleteButtonState() {
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
        if (currentProjectId) {
            deleteBtn.classList.remove('disabled');
            deleteBtn.removeAttribute('disabled');
            deleteBtn.title = 'Delete roof';
        } else {
            deleteBtn.classList.add('disabled');
            deleteBtn.setAttribute('disabled', 'disabled');
            deleteBtn.title = 'Select a project first';
        }
    }
}


function handleCreateProject() {
    collapseContent();
    
    const createProjectBtn = document.getElementById('create-project-btn');
    if (createProjectBtn) {
        createProjectBtn.click();
    }
}


export function projectCreated(projectData) {
    projects.push(projectData);
    
    renderProjects(projects);
    
    selectProject(projectData);
}


export function deleteProject(projectId) {
    const csrfToken = getCSRFToken();
    
    fetch(`/solar/api/projects/${projectId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': csrfToken
        }
    })
    .then(response => {
        if (response.ok) {
            showSuccessModal('Project Deleted', 'The project has been deleted successfully.');
            
            projects = projects.filter(p => p.id !== projectId);
            
            if (projectId === currentProjectId) {
                currentProjectId = null;
                headerTitle.innerHTML = '<i class="fas fa-folder-open"></i> Select a Project';
            }
            
            renderProjects(projects);

        } else {
            console.error('Failed to delete project');
        }
    })
    .catch(error => {
        console.error('Error deleting project:', error);
    });
}

export function updateProjectInfo(projectId, newData, saveToServer = false) {
    const project = projects.find(p => p.id === projectId);
    if (project) {
        Object.assign(project, newData);
        renderProjects(projects);
        
        if (saveToServer && newData.address) {
            console.log(`Address for project ${projectId} updated locally: ${newData.address}`);
        }
    }
}

export function getCurrentProjectId() {
    return currentProjectId;
}