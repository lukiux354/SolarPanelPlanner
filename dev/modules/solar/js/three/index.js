import { initThreeJS, getRenderer, getCamera } from './setup.js';
import { update3DView } from './buildings.js';
import { applyHeightData, saveRoofData, saveAllRoofData } from './persistence.js';
import { state } from './state.js';
import { updateWallHeightControls} from './ui.js';

export {
    // Core setup
    initThreeJS,
    getRenderer,
    getCamera,
    
    // Building management
    update3DView,
    
    // Data persistence
    applyHeightData,
    saveRoofData,
    saveAllRoofData,
    updateWallHeightControls,
    
    state
};