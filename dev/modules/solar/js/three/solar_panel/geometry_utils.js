import * as THREE from 'three';

export function projectVerticesToPlane(vertices3D, baseHeight, normal, xAxis, yAxis, centerPoint) {
    const projectedVertices = [];
    
    for (let i = 0; i < vertices3D.length; i++) {
        const point = new THREE.Vector3(
            vertices3D[i].x,
            baseHeight + vertices3D[i].height,
            vertices3D[i].z
        );
        
        // Calculate vector from center to this point
        const v = new THREE.Vector3().subVectors(point, centerPoint);
        
        // Project onto our axes
        const x = v.dot(xAxis);
        const y = v.dot(yAxis);
        
        projectedVertices.push({ x, y });
    }
    
    return projectedVertices;
}

export function calculateBounds(projectedVertices) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    projectedVertices.forEach(v => {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
    });
    
    return {
        minX, maxX, minY, maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

export function isPointInPolygon(point, polygonVertices) {
    let inside = false;
    
    // Handle different vertex formats safely
    let vertices;
    if (Array.isArray(polygonVertices)) {
        vertices = polygonVertices;
    } else if (polygonVertices && typeof polygonVertices === 'object') {
        // Convert object to array if needed
        vertices = Object.values(polygonVertices);
    } else {
        console.error('Invalid polygon vertices format:', polygonVertices);
        return false;
    }
    
    // Ray casting algorithm
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const vi = vertices[i];
        const vj = vertices[j];
        
        // Make sure we have valid x,y coordinates
        const xi = vi.x !== undefined ? vi.x : vi[0];
        const yi = vi.y !== undefined ? vi.y : vi[1];
        const xj = vj.x !== undefined ? vj.x : vj[0];
        const yj = vj.y !== undefined ? vj.y : vj[1];
        
        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        
        if (intersect) inside = !inside;
    }
    
    return inside;
}

export function getParentRoofIndex(object) {
    let current = object;
    
    // Traverse up to find parent with polygonIndex
    while (current) {
        // Check if this node or its parent has the polygonIndex
        if (current.userData && current.userData.polygonIndex !== undefined) {
            return current.userData.polygonIndex;
        }
        
        if (current.parent && current.parent.userData && 
            current.parent.userData.polygonIndex !== undefined) {
            return current.parent.userData.polygonIndex;
        }
        
        // Move up the hierarchy
        current = current.parent;
    }
    
    return undefined;
}