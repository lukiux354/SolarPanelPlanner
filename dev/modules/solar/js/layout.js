import { getMap } from './map.js';


export function switchToBothViews() {
    const appContainer = document.getElementById('app-container');
    const mapColumn = document.getElementById('map-column');
    const threeColumn = document.getElementById('three-column');
    
    appContainer.className = '';
    
    mapColumn.style.display = 'block';
    mapColumn.style.visibility = 'visible';
    mapColumn.style.flex = '1';
    
    threeColumn.style.display = 'block';
    threeColumn.style.flex = '1';
    
    void appContainer.offsetHeight;
    
    // Update active button
    document.getElementById('show-both-btn').classList.add('active');
    document.getElementById('show-map-btn').classList.remove('active');
    document.getElementById('show-3d-btn').classList.remove('active');
    
    // Force resize after a short delay to let the layout settle
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        
        // Only do a simple map resize without all the complex checks
        const map = getMap();
        if (map && window.google && window.google.maps) {
            window.google.maps.event.trigger(map, 'resize');
        }
    }, 150);
}

export function switchToMapOnly() {
    const appContainer = document.getElementById('app-container');
    const mapColumn = document.getElementById('map-column');
    const threeColumn = document.getElementById('three-column');
    
    // Reset class then set new one
    appContainer.className = 'map-only';
    
    // Set displays explicitly and reset size to full container
    mapColumn.style.cssText = 'display: block !important; flex: 1 1 100% !important;';
    threeColumn.style.display = 'none';
    
    // Update active button
    document.getElementById('show-both-btn').classList.remove('active');
    document.getElementById('show-map-btn').classList.add('active');
    document.getElementById('show-3d-btn').classList.remove('active');
    
    // Force resize for the map
    setTimeout(() => {
        const map = getMap();
        if (map) window.google.maps.event.trigger(map, 'resize');
    }, 100);
}

export function switchToThreeOnly() {
    const appContainer = document.getElementById('app-container');
    const mapColumn = document.getElementById('map-column');
    const threeColumn = document.getElementById('three-column');
    
    // Reset class then set new one
    appContainer.className = 'three-only';
    
    // Set displays explicitly and reset size to full container
    mapColumn.style.display = 'none';
    threeColumn.style.cssText = 'display: block !important; flex: 1 1 100% !important;';
    
    // Update active button
    document.getElementById('show-both-btn').classList.remove('active');
    document.getElementById('show-map-btn').classList.remove('active');
    document.getElementById('show-3d-btn').classList.add('active');
    
    // Force window resize event for three.js
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
}

export function initLayoutControls() {
    const showBothBtn = document.getElementById('show-both-btn');
    const showMapBtn = document.getElementById('show-map-btn');
    const show3DBtn = document.getElementById('show-3d-btn');
    
    // Both view
    showBothBtn.addEventListener('click', switchToBothViews);
    
    // Map-only view
    showMapBtn.addEventListener('click', switchToMapOnly);
    
    // 3D-only view
    show3DBtn.addEventListener('click', switchToThreeOnly);
}

// Get the current layout state
export function getCurrentLayoutState() {
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

// Resizable splitter functionality
export function initResizableSplitter() {
    const splitter = document.getElementById('resizable-splitter');
    const mapColumn = document.getElementById('map-column');
    const threeColumn = document.getElementById('three-column');
    const appContainer = document.getElementById('app-container');
    
    let isResizing = false;
    let initialX;
    let initialMapWidth;
    let initialThreeWidth;
    
    // Only enable splitter in "both" mode
    function updateSplitterVisibility() {
        if (!appContainer.classList.contains('map-only') && 
            !appContainer.classList.contains('three-only')) {
            splitter.style.display = 'flex';
        } else {
            splitter.style.display = 'none';
        }
    }
    
    // Initialize visibility
    updateSplitterVisibility();
    
    // Mouse events for desktop
    splitter.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    
    // Touch events for mobile
    splitter.addEventListener('touchstart', startResizeTouchHandler);
    document.addEventListener('touchmove', resizeTouchHandler);
    document.addEventListener('touchend', stopResize);
    
    function startResize(e) {
        isResizing = true;
        initialX = e.clientX;
        
        // Get the current widths using computed styles
        const mapStyle = window.getComputedStyle(mapColumn);
        const threeStyle = window.getComputedStyle(threeColumn);
        initialMapWidth = parseFloat(mapStyle.width);
        initialThreeWidth = parseFloat(threeStyle.width);
        
        // Add active class for styling
        splitter.classList.add('active');
        
        // Prevent text selection while dragging
        document.body.style.userSelect = 'none';
    }
    
    function startResizeTouchHandler(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            e.clientX = touch.clientX; // Simulate mousedown event
            startResize(e);
        }
    }
    
    function resize(e) {
        if (!isResizing) return;
    
        // Calculate the distance moved
        const deltaX = e.clientX - initialX;
    
        // Calculate new widths in pixels first
        let newMapWidthPx = initialMapWidth + deltaX;
        let newThreeWidthPx = initialThreeWidth - deltaX;
    
        // Apply minimum width constraint of 420px while preserving total width
        const MIN_WIDTH_PX = 420;
        const totalWidth = newMapWidthPx + newThreeWidthPx;
    
        if (newMapWidthPx < MIN_WIDTH_PX) {
            newMapWidthPx = MIN_WIDTH_PX;
            newThreeWidthPx = totalWidth - MIN_WIDTH_PX;
        } else if (newThreeWidthPx < MIN_WIDTH_PX) {
            newThreeWidthPx = MIN_WIDTH_PX;
            newMapWidthPx = totalWidth - MIN_WIDTH_PX;
        }
    
        // Convert back to percentages for flexible layout
        const totalPercent = 100;
        let newMapWidth = (newMapWidthPx / totalWidth) * totalPercent;
        let newThreeWidth = (newThreeWidthPx / totalWidth) * totalPercent;
    
        // Update column widths
        mapColumn.style.flex = `1 1 ${newMapWidth}%`;
        threeColumn.style.flex = `1 1 ${newThreeWidth}%`;
    
        // Trigger resize events for map and three.js
        window.dispatchEvent(new Event('resize'));
    }
    
    function resizeTouchHandler(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            e.clientX = touch.clientX; // Simulate mousemove event
            resize(e);
        }
    }
    
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            splitter.classList.remove('active');
            document.body.style.userSelect = '';
            
            // Trigger resize event for map and three.js
            window.dispatchEvent(new Event('resize'));
            const map = window.getMap && window.getMap();
            if (map && window.google && window.google.maps) {
                window.google.maps.event.trigger(map, 'resize');
            }
        }
    }
    
    // Update splitter visibility when layout changes
    document.getElementById('show-both-btn').addEventListener('click', updateSplitterVisibility);
    document.getElementById('show-map-btn').addEventListener('click', updateSplitterVisibility);
    document.getElementById('show-3d-btn').addEventListener('click', updateSplitterVisibility);
    
    window.dispatchEvent(new Event('resize'));
}