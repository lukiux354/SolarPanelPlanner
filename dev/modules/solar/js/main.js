import { loadGoogleMaps } from './map.js';
import { setupDrawing } from './drawing.js';
import { setupSearchBox } from './search.js';
import { loadProjects } from './project.js';
import { initThreeJS } from './threejs.js';
import { initLayoutControls, initResizableSplitter } from './layout.js';
import { fetchOSMBuildingHeight } from './three/osm_data.js';
import { initAuthUI } from './auth.js';
import { showWelcomeModal } from './modals.js';
import { initProjectPanel } from './project_panel.js';

// init
function initializeApp() {
    loadGoogleMaps().then(() => {
        setupSearchBox();
        setupDrawing();
        loadProjects();
        initThreeJS();
        initLayoutControls();
        initResizableSplitter();
        initAuthUI();

        const helpButton = document.getElementById('show-help-btn');
        if (helpButton) {
            helpButton.addEventListener('click', () => {
                showWelcomeModal();
            });
        }

        if (localStorage.getItem('hideWelcomeModal') !== 'true') {
            showWelcomeModal();
        }

        initProjectPanel();
    });
}

window.addEventListener('DOMContentLoaded', initializeApp);
window.fetchOSMBuildingHeight = fetchOSMBuildingHeight;

