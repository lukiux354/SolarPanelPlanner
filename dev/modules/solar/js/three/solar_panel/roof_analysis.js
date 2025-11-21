import * as THREE from 'three';
import { state } from '../state.js';

export function calculateRoofNormal(vertices3D, baseHeight) {
    // We need at least 3 points to define a plane
    if (vertices3D.length < 3) return new THREE.Vector3(0, 1, 0);
    
    // Best fit plane normal calculation using all vertices
    const points = vertices3D.map(v => new THREE.Vector3(
        v.x,
        baseHeight + v.height,
        v.z
    ));
    
    // Calculate centroid
    const centroid = new THREE.Vector3();
    points.forEach(p => centroid.add(p));
    centroid.divideScalar(points.length);
    
    // Pick corners to form a good triangle (not collinear points)
    const corners = selectNonCollinearPoints(points);
    const v1 = new THREE.Vector3().subVectors(corners[1], corners[0]);
    const v2 = new THREE.Vector3().subVectors(corners[2], corners[0]);
    
    const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
    
    // Make sure normal points upward for consistency
    if (normal.y < 0) normal.multiplyScalar(-1);
    
    return normal;
}

export function selectNonCollinearPoints(points) {
    // Try to find points that form a non-collinear triangle
    const result = [points[0]];
    
    // Find point furthest from first point
    let maxDist = 0;
    let furthestIdx = 0;
    
    for (let i = 1; i < points.length; i++) {
        const dist = points[0].distanceTo(points[i]);
        if (dist > maxDist) {
            maxDist = dist;
            furthestIdx = i;
        }
    }
    result.push(points[furthestIdx]);
    
    // Find point that forms largest area triangle with first two points
    maxDist = 0;
    furthestIdx = 0;
    const v1 = new THREE.Vector3().subVectors(result[1], result[0]);
    
    for (let i = 1; i < points.length; i++) {
        if (i === result[1]) continue;
        const v2 = new THREE.Vector3().subVectors(points[i], result[0]);
        const area = new THREE.Vector3().crossVectors(v1, v2).length();
        if (area > maxDist) {
            maxDist = area;
            furthestIdx = i;
        }
    }
    result.push(points[furthestIdx]);
    
    return result;
}

export function calculateRoofArea(vertices3D, baseHeight) {
    let area = 0;
    if (vertices3D.length < 3) return area;
    
    // Origin point for the fan triangulation
    const origin = new THREE.Vector3(
        vertices3D[0].x,
        baseHeight + vertices3D[0].height,
        vertices3D[0].z
    );
    
    // Calculate area using fan triangulation
    for (let i = 1; i < vertices3D.length - 1; i++) {
        const p1 = new THREE.Vector3(
            vertices3D[i].x,
            baseHeight + vertices3D[i].height,
            vertices3D[i].z
        );
        
        const p2 = new THREE.Vector3(
            vertices3D[i+1].x,
            baseHeight + vertices3D[i+1].height,
            vertices3D[i+1].z
        );
        
        const v1 = new THREE.Vector3().subVectors(p1, origin);
        const v2 = new THREE.Vector3().subVectors(p2, origin);
        
        // Area of this triangle is half the cross product magnitude
        area += new THREE.Vector3().crossVectors(v1, v2).length() / 2;
    }
    
    return area;
}

export function calculateRoofCenter(vertices3D, baseHeight) {
    let sumX = 0, sumY = 0, sumZ = 0;
    
    for (let i = 0; i < vertices3D.length; i++) {
        sumX += vertices3D[i].x;
        sumY += baseHeight + vertices3D[i].height;
        sumZ += vertices3D[i].z;
    }
    
    return new THREE.Vector3(
        sumX / vertices3D.length,
        sumY / vertices3D.length,
        sumZ / vertices3D.length
    );
}

// Calculate axes for panel alignment
export function calculateRoofAxes(normal) {
    const up = new THREE.Vector3(0, 1, 0);
    let xAxis;
    
    if (Math.abs(normal.dot(up)) > 0.99) {
        // Roof is nearly horizontal, use a default axis
        xAxis = new THREE.Vector3(1, 0, 0);
    } else {
        // Roof is sloped, create an axis along the roof's "horizontal" direction
        xAxis = new THREE.Vector3().crossVectors(normal, up).normalize();
    }
    
    // Y axis is perpendicular to both the normal and x axis
    const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
    
    return { xAxis, yAxis };
}

export function calculateAverageRoofNormal(roofMesh) {
    // Start with the main roof mesh's normal
    let vertices3D = roofMesh.userData.vertices3D;
    let baseHeight = state.baseHeights[roofMesh.userData.polygonIndex] || 0;
    
    // Calculate main roof normal
    const mainNormal = calculateRoofNormal(vertices3D, baseHeight);
    
    // Create an array to hold all normals
    const normals = [mainNormal];
    
    // Check if this roof has child meshes
    if (roofMesh.children && roofMesh.children.length > 0) {
        for (const childMesh of roofMesh.children) {
            // Skip vertical surfaces (walls)
            if (isVerticalMesh(childMesh)) continue;
            
            // If the child mesh has its own vertices data, calculate its normal
            if (childMesh.userData && childMesh.userData.vertices3D) {
                const childVertices = childMesh.userData.vertices3D;
                const childNormal = calculateRoofNormal(childVertices, baseHeight);
                normals.push(childNormal);
            } 
            // For meshes without vertices3D, try to extract normal from geometry
            else if (childMesh.geometry && childMesh.geometry.attributes && childMesh.geometry.attributes.normal) {
                const normalAttr = childMesh.geometry.attributes.normal;
                const normalSum = new THREE.Vector3();
                
                // Sample some normals from the geometry
                const sampleCount = Math.min(10, normalAttr.count);
                for (let i = 0; i < sampleCount; i++) {
                    const idx = Math.floor(i * normalAttr.count / sampleCount);
                    normalSum.add(new THREE.Vector3(
                        normalAttr.array[idx * 3],
                        normalAttr.array[idx * 3 + 1],
                        normalAttr.array[idx * 3 + 2]
                    ));
                }
                
                if (sampleCount > 0) {
                    normalSum.divideScalar(sampleCount);
                    normalSum.normalize();
                    // If this normal is pointing downward, flip it
                    if (normalSum.y < 0) normalSum.multiplyScalar(-1);
                    normals.push(normalSum);
                }
            }
        }
    }
    
    // Calculate average normal by adding all normals and normalizing
    const averageNormal = new THREE.Vector3();
    normals.forEach(normal => {
        averageNormal.add(normal);
    });
    averageNormal.normalize();
    
    // Make sure it points upward
    if (averageNormal.y < 0) averageNormal.multiplyScalar(-1);
    
    return averageNormal;
}


export function isVerticalMesh(mesh) {
    if (!mesh.geometry) return false;
    
    // Get the mesh's normal vector if available
    if (mesh.userData && mesh.userData.normal) {
        const normal = mesh.userData.normal;
        const upDot = Math.abs(normal.y);
        return upDot < 0.3;
    }
    
    if (mesh.geometry.attributes && mesh.geometry.attributes.normal) {
        const normals = mesh.geometry.attributes.normal.array;
        let verticalFaceCount = 0;
        let totalFaces = normals.length / 9;
        
        for (let i = 0; i < normals.length; i += 9) {
            // Average the 3 vertex normals for this face
            const avgY = (normals[i + 1] + normals[i + 4] + normals[i + 7]) / 3;
            if (Math.abs(avgY) < 0.3) verticalFaceCount++;
        }
        
        // If more than 70% of faces are vertical, consider this a wall
        return verticalFaceCount > totalFaces * 0.7;
    }
    
    // If we can't determine, assume it's not a wall
    return false;
}