import { map } from './map.js';

export function setupSearchBox() {
    const input = document.getElementById("search-box");
    const searchBox = new window.google.maps.places.SearchBox(input);

    searchBox.addListener("places_changed", () => {
        const places = searchBox.getPlaces();
        if (places.length === 0) return;

        const place = places[0];
        if (!place.geometry) return;

        map.setCenter(place.geometry.location);
        map.setZoom(20);
    });
}