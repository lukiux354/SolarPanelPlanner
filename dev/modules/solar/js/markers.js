import { map } from './map.js';
import { state } from './state.js';

export function createVertexMarkers(polygon, permanent = false) {
    const path = polygon.getPath();
    const markers = [];

    path.getArray().forEach((vertex, index) => {
        const marker = new window.google.maps.Marker({
            position: vertex,
            map: map,
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 7, 
                fillColor: "#4055de",
                fillOpacity: 0, // Start fully transparent
                strokeWeight: 1,
                strokeOpacity: 0 
            },
            title: `Vertex ${index + 1}`,
            zIndex: 999,
            optimized: false, 
            clickable: !state.deleteMode // Make markers non-clickable
        });

        // Show marker on hover - only if not in delete mode
        marker.addListener("mouseover", () => {
            if (!state.deleteMode) {
                marker.setIcon({
                    ...marker.getIcon(),
                    fillOpacity: 1.0, // Make marker fully visible
                    strokeOpacity: 1.0 // Make stroke visible
                });
            }
        });

        // Hide marker on mouseout
        marker.addListener("mouseout", () => {
            if (!permanent) {
                marker.setIcon({
                    ...marker.getIcon(),
                    fillOpacity: 0, // Make marker transparent
                    strokeOpacity: 0 // Make stroke transparent
                });
            }
        });

        // Add explicit click handler
        marker.addListener("click", function(event) {
            // Only handle click if not in delete mode
            if (!state.deleteMode) {
                // Import drawing module and handle the click
                import('./drawing.js').then(module => {
                    module.handleVertexClick(vertex);
                    // Stop event propagation to prevent map click
                    event.stop();
                });
            }
        });

        markers.push(marker);
    });

    // For permanent markers, make them always visible
    if (permanent) {
        markers.forEach(m => {
            m.setIcon({
                ...m.getIcon(),
                fillOpacity: 1.0, // Make marker fully visible
                strokeOpacity: 1.0 
            });
        });
    }

    return markers;
}


export function updateMarkersClickability(markers) {
    if (!markers) return;
    
    markers.forEach(marker => {
        if (marker && marker.setClickable) {
            // Set clickable to false when in delete mode, true otherwise
            marker.setClickable(!state.deleteMode);
        }
    });
}

export function removeVertexMarkers(markers) {
    markers.forEach(marker => marker.setMap(null));
}