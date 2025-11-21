import * as THREE from 'three';
import { state } from '../state.js';
import { isPointInPolygon, getParentRoofIndex, projectVerticesToPlane, calculateBounds } from './geometry_utils.js';
import { createSolarPanelMesh, clearExistingPanels } from './panel_model.js';
import { calculateRoofNormal, calculateAverageRoofNormal, calculateRoofCenter, calculateRoofAxes, isVerticalMesh } from './roof_analysis.js';
import { calculateRoofSolarEfficiency } from './sun_efficiency.js';

// Calculate grid of panels
export function calculatePanelGrid(bounds, panelSpec) {
    const { width, height, spacing } = panelSpec;
    
    // Use a larger margin to stay away from edges (20cm buffer)
    const margin = 0.2;
    const effectiveWidth = bounds.width - (margin * 2);
    const effectiveHeight = bounds.height - (margin * 2);
    
    // Ensure we have positive dimensions after margins
    if (effectiveWidth <= 0 || effectiveHeight <= 0) {
        return { panelCount: 0, positions: [] };
    }
    
    // Calculate how many panels we can fit
    const rows = Math.floor(effectiveHeight / (height + spacing));
    const cols = Math.floor(effectiveWidth / (width + spacing));
    
    if (rows <= 0 || cols <= 0) {
        console.log("Cannot fit any panels on this roof");
        return { panelCount: 0, positions: [] };
    }
    
    // Center the panels on the roof
    const startX = bounds.minX + margin + (effectiveWidth - (cols * width + (cols-1) * spacing)) / 2;
    const startY = bounds.minY + margin + (effectiveHeight - (rows * height + (rows-1) * spacing)) / 2;
    
    const positions = [];
    
    // Generate positions with simple centering
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            positions.push({
                x: startX + c * (width + spacing) + width / 2,
                y: startY + r * (height + spacing) + height / 2
            });
        }
    }
    
    // Store ALL positions before applying constraints
    const allPositions = [...positions];
    
    // Apply constraints automatically based on input values
    let constrainedPositions = positions;
    let isBudgetConstrained = false;
    let isPowerConstrained = false;
    let isLimitedByRoof = false;
    
    // Special case handling: treat 0 as "unlimited"
    const maxPanelsFromBudget = state.solarPanel.maxBudget <= 0 ? 
        Infinity : Math.floor(state.solarPanel.maxBudget / state.solarPanel.cost);
    
    const targetPower = state.solarPanel.targetPower;
    const maxPanelsForPower = targetPower <= 0 ? 
        Infinity : Math.ceil(targetPower / state.solarPanel.power.wattage);
    
    // IMPORTANT: Always try to meet power target first, then check if budget allows it
    if (targetPower > 0) {
        if (positions.length >= maxPanelsForPower) {
            // Enough roof space to meet power target
            
            if (maxPanelsFromBudget >= maxPanelsForPower) {
                // Budget is sufficient for power goal
                constrainedPositions = getCenterWeightedPositions(positions, rows, cols, maxPanelsForPower);
                isPowerConstrained = true;
            } else {
                // Budget limits us from meeting power goal
                constrainedPositions = getCenterWeightedPositions(positions, rows, cols, maxPanelsFromBudget);
                isBudgetConstrained = true;
            }
        } else {
            // Roof size itself limits us
            isLimitedByRoof = true;
            
            // Check if budget limits us even further
            if (maxPanelsFromBudget < positions.length) {
                constrainedPositions = getCenterWeightedPositions(positions, rows, cols, maxPanelsFromBudget);
                isBudgetConstrained = true;
            }
        }
    } else if (state.solarPanel.maxBudget > 0) {
        // No power target, just budget constraint
        if (positions.length > maxPanelsFromBudget) {
            constrainedPositions = getCenterWeightedPositions(positions, rows, cols, maxPanelsFromBudget);
            isBudgetConstrained = true;
        }
    }
    // If neither power nor budget is specified, use all positions
    
    // Save constraint state
    state.solarPanel.isBudgetConstrained = isBudgetConstrained;
    state.solarPanel.isPowerConstrained = isPowerConstrained;
    state.solarPanel.isLimitedByRoof = isLimitedByRoof;
    
    return { 
        panelCount: constrainedPositions.length, 
        positions: constrainedPositions,
        allPositions: allPositions,
        isBudgetConstrained: isBudgetConstrained,
        isPowerConstrained: isPowerConstrained,
        isLimitedByRoof: isLimitedByRoof
    };
}


function getCenterWeightedPositions(positions, rows, cols, maxCount) {
    // Calculate center point of the grid
    const centerRow = (rows - 1) / 2;
    const centerCol = (cols - 1) / 2;
    
    // Assign a "distance from center" score to each position
    const scoredPositions = positions.map((pos, index) => {
        const r = Math.floor(index / cols);
        const c = index % cols;
        
        // Calculate distance from center (squared for simplicity)
        const distanceFromCenter = Math.pow(r - centerRow, 2) + Math.pow(c - centerCol, 2);
        
        return {
            position: pos,
            score: distanceFromCenter
        };
    });
    
    // Sort by score (closest to center first)
    scoredPositions.sort((a, b) => a.score - b.score);
    
    // Take first maxCount positions
    return scoredPositions.slice(0, maxCount).map(item => item.position);
}

function getCenterWeightedValidPositions(positions, maxCount) {
    // First calculate the 2D center of all positionss
    let centerX = 0;
    let centerY = 0;
    
    for (const pos of positions) {
        centerX += pos.x;
        centerY += pos.y;
    }
    
    centerX /= positions.length;
    centerY /= positions.length;
    
    // Calculate distance from center for each position
    const scoredPositions = positions.map(pos => {
        const dx = pos.x - centerX;
        const dy = pos.y - centerY;
        const distanceSquared = dx * dx + dy * dy;
        
        return {
            position: pos,
            score: distanceSquared
        };
    });
    
    // Sort by distance from center (closest first)
    scoredPositions.sort((a, b) => a.score - b.score);
    
    // Take first maxCount positions
    return scoredPositions.slice(0, maxCount).map(item => item.position);
}

// Place panels at calculated positions
export function placePanels(positions, normal, xAxis, yAxis, centerPoint, roofIndex, projectedVertices, allPositions = null) {
    const offset = 0.15; // 15cm offset above the roof
    const validPanels = [];
    
    // First determine ALL valid positions (regardless of constraints)
    const validPositions = [];
    
    // Check which positions are valid (actually fit on the roof)
    for (const pos of (allPositions || positions)) {
        // Create a temporary panel to check validity
        const tempPanel = createSolarPanelMesh();
        
        // Position the panel
        const worldPos = new THREE.Vector3(
            centerPoint.x + pos.x * xAxis.x + pos.y * yAxis.x,
            centerPoint.y + pos.x * xAxis.y + pos.y * yAxis.y + offset,
            centerPoint.z + pos.x * xAxis.z + pos.y * yAxis.z
        );
        tempPanel.position.copy(worldPos);
        
        // Align with the roof
        tempPanel.lookAt(worldPos.clone().add(normal));
        tempPanel.rotateX(Math.PI / 2);
        
        // Check if this position is valid
        if (isPanelWithinRoofBoundary(tempPanel, projectedVertices, centerPoint, xAxis, yAxis)) {
            validPositions.push(pos);
        }
        
        // Dispose the temporary panel
        tempPanel.geometry.dispose();
        if (Array.isArray(tempPanel.material)) {
            tempPanel.material.forEach(mat => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
            });
        } else {
            if (tempPanel.material.map) tempPanel.material.map.dispose();
            tempPanel.material.dispose();
        }
    }
    
    // Store the true maximum number of panels that can fit
    state.solarPanel.totalMaxPanelsFit = validPositions.length;
    
    // IMPORTANT: Use only the valid positions that correspond to the requested positions
    let constrainedPositions = [];
    
    // Get the indices of the requested positions in allPositions
    const requestedIndices = new Set(
        positions.map(pos => allPositions ? allPositions.findIndex(
            p => p.x === pos.x && p.y === pos.y
        ) : -1).filter(idx => idx >= 0)
    );
    
    // Only keep valid positions that were in the requested positions
    for (let i = 0; i < validPositions.length; i++) {
        const pos = validPositions[i];
        const originalIndex = allPositions ? 
            allPositions.findIndex(p => p.x === pos.x && p.y === pos.y) : i;
            
        if (requestedIndices.has(originalIndex)) {
            constrainedPositions.push(pos);
        }
    }
    
    // Set constraint flags based on what updatePanelsForAllSelectedRoofs has calculated
    let isPowerConstrained = false;
    let isBudgetConstrained = false;
    let isLimitedByRoof = false;
    
    // The roof's capacity can still limit us if we can't fit all requested panels
    if (constrainedPositions.length < positions.length) {
        isLimitedByRoof = true;
    }
    
    // Update constraint flags
    state.solarPanel.isBudgetConstrained = isBudgetConstrained;
    state.solarPanel.isPowerConstrained = isPowerConstrained;
    state.solarPanel.isLimitedByRoof = isLimitedByRoof;
    
    // Get the roof efficiency (from the roof mesh or recalculate)
    // Find the roof mesh to get its stored efficiency
    const roofMesh = state.currentMeshes.find(mesh => mesh.userData.polygonIndex === roofIndex);
    let roofEfficiency = 100; // Default to 100% if we can't find it
    
    if (roofMesh && roofMesh.userData.solarEfficiency !== undefined) {
        // Use the pre-calculated efficiency
        roofEfficiency = roofMesh.userData.solarEfficiency;
    } else {
        // Calculate it if not already done
        const vertices3D = roofMesh?.userData.vertices3D;
        const baseHeight = state.baseHeights[roofIndex] || 0;
        if (vertices3D) {
            const normal = calculateRoofNormal(vertices3D, baseHeight);
            const efficiency = calculateRoofSolarEfficiency(normal);
            roofEfficiency = efficiency.efficiency;
        }
    }
    
    // Now actually place the panels for the final selected positions
    for (const pos of constrainedPositions) {
        const panel = createSolarPanelMesh();
        
        // Position the panel
        const worldPos = new THREE.Vector3(
            centerPoint.x + pos.x * xAxis.x + pos.y * yAxis.x,
            centerPoint.y + pos.x * xAxis.y + pos.y * yAxis.y + offset,
            centerPoint.z + pos.x * xAxis.z + pos.y * yAxis.z
        );
        panel.position.copy(worldPos);
        
        // Align with the roof
        panel.lookAt(worldPos.clone().add(normal));
        panel.rotateX(Math.PI / 2);
        
        // Store roof index and efficiency in userData
        panel.userData.roofIndex = roofIndex;
        panel.userData.roofEfficiency = roofEfficiency;
        
        // Add to scene
        state.scene.add(panel);
        state.solarPanel.panels.push(panel);
        validPanels.push(panel);
    }
    
    // Number of panels actually placed on the roof
    state.solarPanel.totalPanelsFit = validPanels.length;
    
    return validPanels.length;
}

// Check if a panel would collide with building elements
export function checkPanelCollision(position, normal, panel, roofIndex) {
    // If we're not given a specific roof index, don't do collision checks
    if (roofIndex === undefined) return true;
    
    // Create a raycaster pointing in the opposite direction of the normal
    const raycaster = new THREE.Raycaster();
    const downVector = normal.clone().multiplyScalar(-1);
    
    // Start ray slightly above the panel position
    const rayStart = position.clone().addScaledVector(normal, 0.1); 
    raycaster.set(rayStart, downVector);
    
    // Check for collisions with all meshes
    const allMeshes = state.currentMeshes.flatMap(mesh => mesh.children);
    const intersects = raycaster.intersectObjects(allMeshes, true);
    
    // If we don't hit anything, this is fine
    if (intersects.length === 0) return true;
    
    // We hit something - check if it's the roof we're trying to place panels on
    const hitRoofIndex = getParentRoofIndex(intersects[0].object);
    
    // If we hit our own roof, that's fine - otherwise it's a collision
    return hitRoofIndex === roofIndex;
}


export function isPanelWithinRoofBoundary(panel, projectedVertices, centerPoint, xAxis, yAxis) {
    // Get panel dimensions from state
    const { width, height } = state.solarPanel;
    
    // Calculate the panel corners in 3D space
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    // Define the four corners relative to the panel's center
    const localCorners = [
        new THREE.Vector3(-halfWidth, 0, -halfHeight),
        new THREE.Vector3(halfWidth, 0, -halfHeight),
        new THREE.Vector3(halfWidth, 0, halfHeight),
        new THREE.Vector3(-halfWidth, 0, halfHeight),

        new THREE.Vector3(-halfWidth, 0, 0), // Bottom-midpoint
        new THREE.Vector3(halfWidth, 0, 0),  // right-midpoint
        new THREE.Vector3(0, 0, halfHeight),   // Top-midpoint
        new THREE.Vector3(0, 0, -halfHeight),  // left-midpoint
    ];
    
    // Transform corners to world space
    const worldCorners = localCorners.map(corner => {
        const worldCorner = corner.clone().applyMatrix4(panel.matrixWorld);
        return worldCorner;
    });
    
    // Project corners onto the roof plane
    const projectedCorners = worldCorners.map(worldPos => {
        // Get the vector from center point to world position
        const relativePos = worldPos.clone().sub(centerPoint);
        
        // Project onto the plane defined by xAxis and yAxis
        const projX = relativePos.dot(xAxis);
        const projY = relativePos.dot(yAxis);
        
        return { x: projX, y: projY };
    });
    
    // Check if all projected corners are inside the polygon
    for (const corner of projectedCorners) {
        if (!isPointInPolygon(corner, projectedVertices)) {
            return false; // Corner is outside the polygon
        }
    }

    // NEW: Check for collisions with walls
    // We'll cast rays downward from each corner of the panel
    const raycaster = new THREE.Raycaster();
    
    for (const worldCorner of worldCorners) {
        // Cast ray downward from the panel corner
        const rayDirection = new THREE.Vector3(0, -1, 0);
        raycaster.set(worldCorner, rayDirection);
        
        // Get all wall meshes (filter for brown walls)
        const wallMeshes = state.currentMeshes.flatMap(mesh => {
            // Get all children that are vertical walls
            if (mesh.children && mesh.children.length > 0) {
                return mesh.children.filter(childMesh => isVerticalMesh(childMesh));
            }
            return [];
        });
        
        // Check for intersections
        const intersects = raycaster.intersectObjects(wallMeshes, true);
        if (intersects.length > 0) {
            // We hit a wall - don't allow placing panel here
            return false;
        }
    }
    
    // Additional check: cast ray from panel center
    const panelCenter = panel.position.clone();
    raycaster.set(panelCenter, new THREE.Vector3(0, -1, 0));
    
    const wallMeshes = state.currentMeshes.flatMap(mesh => {
        if (mesh.children && mesh.children.length > 0) {
            return mesh.children.filter(childMesh => isVerticalMesh(childMesh));
        }
        return [];
    });
    
    const centerIntersects = raycaster.intersectObjects(wallMeshes, true);
    if (centerIntersects.length > 0) {
        return false;
    }
    
    return true;
}


export function updatePanelsForAllSelectedRoofs() {
    // Clear all existing panels first
    clearExistingPanels();
    
    // If no roofs are selected, just return
    if (state.solarPanel.selectedRoofIndices.length === 0) {
        return 0;
    }
    
    // Standard budget and power calculations
    const totalBudget = state.solarPanel.maxBudget;
    const targetPower = state.solarPanel.targetPower;
    const panelWattage = state.solarPanel.power.wattage;
    const panelCost = state.solarPanel.cost;
    
    // Calculate how many panels we need in total (budget limit)
    // Treat 0, null, undefined or empty string as "unlimited"
    const maxPanelsFromBudget = (!totalBudget || totalBudget <= 0) ? 
        Infinity : Math.floor(totalBudget / panelCost);
    
    // Calculate efficiency for each roof
    const roofEfficiencies = [];
    
    // First, calculate efficiency for each selected roof
    for (const roofIndex of state.solarPanel.selectedRoofIndices) {
        const roofMesh = state.currentMeshes.find(mesh => mesh.userData.polygonIndex === roofIndex);
        if (!roofMesh) continue;
        
        // Use average normal calculation instead of normal for just the main mesh
        const normal = calculateAverageRoofNormal(roofMesh);
        
        // Get solar efficiency based on the average normal
        const efficiency = calculateRoofSolarEfficiency(normal);
        
        roofEfficiencies.push({
            roofIndex,
            efficiency: efficiency.efficiency
        });
        
        // Store efficiency and normal in userData for reference
        roofMesh.userData.solarEfficiency = efficiency.efficiency;
        roofMesh.userData.averageNormal = normal; // Store the average normal
    }
    
    // Sort by efficiency (highest to lowest)
    roofEfficiencies.sort((a, b) => b.efficiency - a.efficiency);
    
    // Extract the sorted indices
    const sortedRoofIndices = roofEfficiencies.map(item => item.roofIndex);
    
    // FIRST: Calculate the capacity and analyze each roof
    let totalMaxPanelsFit = 0;
    const roofInfos = [];
    
    // Get all roof meshes for collision detection - do this once
    const roofMeshes = state.currentMeshes.filter(mesh => 
        mesh.userData.polygonIndex !== undefined && !isVerticalMesh(mesh)
    );
    
    // Analyze ALL roofs first to calculate capacity and get layouts
    for (const roofIndex of sortedRoofIndices) {
        const roofMesh = state.currentMeshes.find(mesh => mesh.userData.polygonIndex === roofIndex);
        if (!roofMesh) continue;
        
        const vertices3D = roofMesh.userData.vertices3D;
        const baseHeight = state.baseHeights[roofIndex] || 0;
        
        // Use average normal if available, otherwise calculate it
        const normal = roofMesh.userData.averageNormal || calculateAverageRoofNormal(roofMesh);
        
        // Calculate roof center
        const centerPoint = calculateRoofCenter(vertices3D, baseHeight);
        
        // Calculate roof axes based on the average normal
        const { xAxis, yAxis } = calculateRoofAxes(normal);
        
        // Project vertices using the average normal orientation
        const projectedVertices = projectVerticesToPlane(vertices3D, baseHeight, normal, xAxis, yAxis, centerPoint);
        
        // Get all potential positions
        const bounds = calculateBounds(projectedVertices);
        const { allPositions } = calculatePanelGrid(bounds, state.solarPanel);
        
        // Ensure allPositions is defined and iterable
        if (!allPositions || !Array.isArray(allPositions)) {
            console.error(`Invalid allPositions for roof ${roofIndex}. Skipping this roof.`);
            continue;
        }

        // Determine which positions are actually valid
        const validPositions = [];
        const offset = 0.15; // 15cm offset above roof
        const raycaster = new THREE.Raycaster();
        const collisionDistance = 30; // 3 meters for collision detection
        raycaster.far = collisionDistance;
        
        // Get other roof meshes for collision detection
        const otherRoofs = roofMeshes.filter(mesh => 
            mesh.userData.polygonIndex !== roofIndex
        );
        
        for (const pos of allPositions) {
            const tempPanel = createSolarPanelMesh();

            const worldPos = new THREE.Vector3(
                centerPoint.x + pos.x * xAxis.x + pos.y * yAxis.x,
                centerPoint.y + pos.x * xAxis.y + pos.y * yAxis.y + offset,
                centerPoint.z + pos.x * xAxis.z + pos.y * yAxis.z
            );
            tempPanel.position.copy(worldPos);

            tempPanel.lookAt(worldPos.clone().add(normal));
            tempPanel.rotateX(Math.PI / 2);
            
            // First check: Is panel within the roof boundary?
            const isWithinBoundary = isPanelWithinRoofBoundary(tempPanel, projectedVertices, centerPoint, xAxis, yAxis);
            
            // Second check: Does panel collide with other roofs?
            let hasCollision = false;
            
            if (isWithinBoundary) {
                // Get panel dimensions from state
                const { width, height } = state.solarPanel;
                const halfWidth = width / 2;
                const halfHeight = height / 2;
                
                // Define the corners in local space
                const localCorners = [
                    new THREE.Vector3(-halfWidth, 0, -halfHeight), // Bottom-left
                    new THREE.Vector3(halfWidth, 0, -halfHeight),  // Bottom-right
                    new THREE.Vector3(halfWidth, 0, halfHeight),   // Top-right
                    new THREE.Vector3(-halfWidth, 0, halfHeight),  // Top-left
                    new THREE.Vector3(0, 0, 0),  // Center

                    new THREE.Vector3(-halfWidth, 0, 0), // Bottom-midpoint
                    new THREE.Vector3(halfWidth, 0, 0),  // right-midpoint
                    new THREE.Vector3(0, 0, halfHeight),   // Top-midpoint
                    new THREE.Vector3(0, 0, -halfHeight),  // left-midpoint
                ];
                
                // Transform to world coordinates 
                const worldCorners = localCorners.map(corner => {
                    const worldCorner = corner.clone().applyMatrix4(tempPanel.matrixWorld);
                    return worldCorner;
                });
                
                // Check collision from each corner
                cornerLoop:
                for (const corner of worldCorners) {
                    // Cast ray upward
                    const direction = new THREE.Vector3(0, 1, 0);
                    raycaster.set(corner, direction);
                    
                    // Check for intersections with other roofs
                    const intersects = raycaster.intersectObjects(otherRoofs, true);
                    
                    if (intersects.length > 0 && intersects[0].distance < collisionDistance) {
                        hasCollision = true;
                        break cornerLoop;
                    }
                }
                
                // Only add position if it's within boundary and has no collisions
                if (!hasCollision) {
                    validPositions.push(pos);
                }
            }

            // Clean up temporary panel
            tempPanel.geometry.dispose();
            if (Array.isArray(tempPanel.material)) {
                tempPanel.material.forEach(mat => {
                    if (mat.map) mat.map.dispose();
                    mat.dispose();
                });
            } else {
                if (tempPanel.material.map) tempPanel.material.map.dispose();
                tempPanel.material.dispose();
            }
        }

        const roofCapacity = validPositions.length;
        if (roofCapacity === 0) {
            continue; // Skip this roof if it cannot fit any panels
        }

        totalMaxPanelsFit += roofCapacity;

        const roofEfficiency = roofMesh.userData.solarEfficiency || 100;
        const effectiveWattagePerPanel = panelWattage * (roofEfficiency / 100);
        const panelsNeededForTargetOnThisRoof = 
            targetPower > 0 ? Math.ceil(targetPower / effectiveWattagePerPanel) : Infinity;

        roofInfos.push({
            roofIndex,
            normal,
            centerPoint,
            xAxis,
            yAxis,
            projectedVertices,
            validPositions,
            roofCapacity,
            efficiency: roofEfficiency,
            effectiveWattagePerPanel,
            panelsNeededForTarget: panelsNeededForTargetOnThisRoof
        });
    }
    
    // Function to place panels with compensation for collisions
    function placePanelsWithCompensation() {
        // SECOND: Calculate panels to place based on target power or budget
        // Track our power targets and budget constraints
        let remainingPowerTarget = targetPower;
        let remainingPanelsForBudget = maxPanelsFromBudget;
        
        // Track constraints
        let globalIsBudgetConstrained = false;
        let globalIsPowerConstrained = false;
        let globalIsLimitedByRoof = false;
        
        // Store a map of panels placed on each roof (for recalculation after collision detection)
        const panelsPlacedByRoof = new Map();
        let totalPanelsPlaced = 0;
        
        // Array to track how many panels to place on each roof
        const panelsToPlace = [];
        
        // Process roofs in order of efficiency to place panels optimally
        for (const roofInfo of roofInfos) {
            // If we've already met our power target or used our budget, we're done
            // Only check power target if it was set to begin with
            if ((targetPower && targetPower > 0 && remainingPowerTarget <= 0) || remainingPanelsForBudget <= 0) break;
            
            const { roofIndex, roofCapacity, effectiveWattagePerPanel } = roofInfo;
            
            // Calculate how many panels we need on this roof to meet our remaining power goal
            // This accounts for the efficiency of this specific roof
            const panelsNeededForPower = (remainingPowerTarget && remainingPowerTarget > 0) ? 
                Math.ceil(remainingPowerTarget / effectiveWattagePerPanel) : Infinity;

            
            // We can place at most:
            // 1. As many panels as fit on the roof
            // 2. As many panels as needed for our power target (or all possible if no target)
            // 3. As many panels as our remaining budget allows
            const panelsForThisRoof = Math.min(
                roofCapacity,
                panelsNeededForPower,
                remainingPanelsForBudget
            );
            
            // Power this roof will generate with the panels we're placing
            const powerGenerated = panelsForThisRoof * effectiveWattagePerPanel;
            
            // Track constraints
            if (panelsForThisRoof === roofCapacity && panelsForThisRoof < panelsNeededForPower) {
                // We filled the roof but still need more power - roof is limiting
                globalIsLimitedByRoof = true;
            }
            
            if (panelsForThisRoof === remainingPanelsForBudget && 
                remainingPanelsForBudget < panelsNeededForPower) {
                // We used all our budget but still need more power - budget is limiting
                globalIsBudgetConstrained = true;
            }
            
            // Update our remaining targets
            remainingPowerTarget -= powerGenerated;
            remainingPanelsForBudget -= panelsForThisRoof;
            
            // Store info about this roof for power recalculation after collision detection
            panelsPlacedByRoof.set(roofIndex, {
                count: panelsForThisRoof,
                effectiveWattagePerPanel: effectiveWattagePerPanel
            });
            
            // Store how many panels to place on this roof
            panelsToPlace.push({
                roofInfo,
                count: panelsForThisRoof,
                used: 0, // Track how many positions from this roof have been used
                effectiveWattagePerPanel
            }); 
        }
        
        // Check if we managed to meet our power target
        if (targetPower > 0 && remainingPowerTarget <= 0) {
            globalIsPowerConstrained = true; // We met our power goal
        }
        
        // THIRD: Actually place the panels on each roof
        for (const placement of panelsToPlace) {
            const { roofInfo, count } = placement;
            
            if (count <= 0) continue;
            
            const { 
                roofIndex, normal, centerPoint, xAxis, yAxis, 
                projectedVertices, validPositions
            } = roofInfo;
            
            // Get center-weighted positions
            const positions = getCenterWeightedValidPositions(validPositions, count, centerPoint);
            
            // Place the panels
            const actualPanels = placePanels(
                positions,
                normal,
                xAxis,
                yAxis,
                centerPoint,
                roofIndex,
                projectedVertices,
                validPositions
            );
            
            // Update placement tracking
            placement.used = actualPanels;
            
            // Update total count
            totalPanelsPlaced += actualPanels;
        }
        
        return {
            totalPanelsPlaced,
            globalIsPowerConstrained,
            globalIsBudgetConstrained,
            globalIsLimitedByRoof,
            actualPowerGenerated: targetPower // No collisions, so target was met
        };
    }
    
    // First round of panel placement
    let result = placePanelsWithCompensation();

    // Update state with constraints
    state.solarPanel.isBudgetConstrained = result.globalIsBudgetConstrained;
    state.solarPanel.isPowerConstrained = result.globalIsPowerConstrained;
    state.solarPanel.isLimitedByRoof = result.globalIsLimitedByRoof;

    // Update panel fit numbers - these drive the coverage calculation
    state.solarPanel.totalMaxPanelsFit = totalMaxPanelsFit;
    state.solarPanel.totalPanelsFit = result.totalPanelsPlaced;

    return result.totalPanelsPlaced;
}


// Map efficiency value (0-100%) to a color
function getEfficiencyColor(efficiency) {
    // Normalize to 0-1
    const normalizedValue = efficiency / 100;
    
    // Create a color gradient: bright green -> orange -> deep red
    let color = new THREE.Color();
    
    if (normalizedValue >= 0.7) {
        // Bright green to yellow-green (100-70%)
        const brightGreen = new THREE.Color(0x00ff00);
        const yellowGreen = new THREE.Color(0x99dd00);
        // Calculate alpha: 0 at norm=1.0, 1.0 at norm=0.7
        const alpha = (1.0 - normalizedValue) / 0.3;
        color.copy(brightGreen).lerp(yellowGreen, alpha);
    } else if (normalizedValue >= 0.4) {
        // Yellow-green to orange (70-40%)
        const yellowGreen = new THREE.Color(0x99dd00);
        const orange = new THREE.Color(0xff8800);
        // Calculate alpha: 0 at norm=0.7, 1.0 at norm=0.4
        const alpha = (0.7 - normalizedValue) / 0.3;
        color.copy(yellowGreen).lerp(orange, alpha);
    } else {
        // Orange to red (40-0%)
        const orange = new THREE.Color(0xff8800);
        const deepRed = new THREE.Color(0xcc0000);
        // Calculate alpha: 0 at norm=0.4, 1.0 at norm=0.0
        const alpha = (0.4 - normalizedValue) / 0.4;
        color.copy(orange).lerp(deepRed, alpha);
    }
    
    return color;
}


//////////////////////////////////////////////////////////////////////////////////
export function visualizeAllRoofEfficiencies() {
    // Process all roof meshes
    for (const roofMesh of state.currentMeshes) {
        if (!roofMesh || !roofMesh.userData || !roofMesh.userData.vertices3D) continue;
        
        const roofIndex = roofMesh.userData.polygonIndex;
        const vertices3D = roofMesh.userData.vertices3D;
        const baseHeight = state.baseHeights[roofIndex] || 0;
        
        // Calculate roof normal
        const normal = calculateRoofNormal(vertices3D, baseHeight);
        
        // Get solar efficiency
        const efficiency = calculateRoofSolarEfficiency(normal);
        
        // Apply efficiency-based color
        const efficiencyColor = getEfficiencyColor(efficiency.efficiency);
                
        // Store efficiency in userData
        roofMesh.userData.solarEfficiency = efficiency.efficiency;
        roofMesh.userData.solarFacing = efficiency.facing;
        
        // Find only appropriate meshes to color (roof surfaces but not walls)
        const meshesToColor = [];
        
        // Add the main roof mesh
        if (roofMesh) {
            meshesToColor.push(roofMesh);
        }
        
        // Check children, but only include non-vertical surfaces
        if (roofMesh.children && roofMesh.children.length > 0) {
            for (const child of roofMesh.children) {
                const isVertical = isVerticalMesh(child);
                if (!isVertical) {
                    meshesToColor.push(child);
                }
            }
        }
        
        // Apply color to all relevant meshes
        for (const mesh of meshesToColor) {
            if (!mesh.material) continue;
            
            // Store original color if not already stored
            if (!mesh.userData.originalColor) {
                mesh.userData.originalColor = mesh.material.color ? 
                    mesh.material.color.getHex() : 0xffffff;
            }
            
            // Apply to ALL materials
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(mat => {
                    if (mat.color) {
                        mat.color.copy(efficiencyColor);
                    }
                    mat.needsUpdate = true;
                });
            } else if (mesh.material.color) {
                mesh.material.color.copy(efficiencyColor);
                mesh.material.needsUpdate = true;
            }
        }
    }
    setupRoofHoverEfficiencyInfo();
}



export function resetAllRoofColors() {
    // Process all roof meshes
    for (const roofMesh of state.currentMeshes) {
        if (!roofMesh) continue;
        
        // Find only appropriate meshes to reset (roof surfaces but not walls)
        const meshesToReset = [];
        
        // Add the main roof mesh if it's not vertical
        if (roofMesh && !isVerticalMesh(roofMesh)) {
            meshesToReset.push(roofMesh);
        }
        
        // Add children that aren't vertical
        if (roofMesh.children && roofMesh.children.length > 0) {
            for (const child of roofMesh.children) {
                // Only reset non-vertical surfaces (actual roof parts)
                if (!isVerticalMesh(child)) {
                    meshesToReset.push(child);
                }
            }
        }
        
        // Reset color for each identified mesh
        for (const mesh of meshesToReset) {
            // Skip meshes without materials
            if (!mesh.material) continue;
            
            // Handle material arrays
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(mat => {
                    if (mat.color) {
                        mat.color.setHex(0x2194ce);
                        
                        // Reset emissive glow
                        if (mat.emissive) {
                            mat.emissive.setHex(0x000000);
                        }
                    }
                    mat.needsUpdate = true;
                });
            } 
            // Handle single materials
            else if (mesh.material.color) {
                mesh.material.color.setHex(0x2194ce);
                
                // Reset emissive glow
                if (mesh.material.emissive) {
                    mesh.material.emissive.setHex(0x000000);
                }
                
                mesh.material.needsUpdate = true;
            }
        }

        // Remove the hover listener if it exists
        if (state.roofHoverListener) {
            state.renderer.domElement.removeEventListener('mousemove', state.roofHoverListener);
            state.roofHoverListener = null;
        }
        
        // Remove the tooltip
        const tooltip = document.getElementById('roof-efficiency-tooltip');
        if (tooltip) {
            document.body.removeChild(tooltip);
        }
    }
}


// Add this function to show efficiency info on hover
export function setupRoofHoverEfficiencyInfo() {
    // Create a tooltip element for displaying efficiency
    let tooltip = document.getElementById('roof-efficiency-tooltip');
    
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'roof-efficiency-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '5px 10px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '14px';
        tooltip.style.pointerEvents = 'none'; // Ignore mouse events
        tooltip.style.zIndex = '1000';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
    }
    
    // Create/update a raycaster for the hover detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Event listener for mouse movement
    const onMouseMove = (event) => {
        if (!state.showingEfficiencyColors) {
            tooltip.style.display = 'none';
            return;
        }
        
        // Calculate mouse position in normalized device coordinates
        const rect = state.renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the raycaster
        raycaster.setFromCamera(mouse, state.camera);
        
        // Find intersected objects
        const intersects = raycaster.intersectObjects(state.currentMeshes, true);
        
        if (intersects.length > 0) {
            // Find the parent roof mesh
            let roofMesh = intersects[0].object;
            while (roofMesh.parent && !roofMesh.userData.polygonIndex) {
                roofMesh = roofMesh.parent;
            }
            
            if (roofMesh && roofMesh.userData.solarEfficiency !== undefined) {
                // Get efficiency data
                const efficiency = roofMesh.userData.solarEfficiency;
                const efficiencyDisplay = efficiency === 1 ? '<1' : efficiency.toFixed(1);
                const facing = roofMesh.userData.solarFacing || 'Unknown';
                
                // Show tooltip
                tooltip.style.display = 'block';
                tooltip.style.left = `${event.clientX + 15}px`;
                tooltip.style.top = `${event.clientY + 15}px`;
                tooltip.innerHTML = `
                    <div><strong>Roof Efficiency:</strong> ${efficiencyDisplay}%</div>
                    <div><strong>Facing:</strong> ${facing}</div>
                `;
            } else {
                tooltip.style.display = 'none';
            }
        } else {
            tooltip.style.display = 'none';
        }
    };
    
    // Add event listener for mousemove
    state.renderer.domElement.addEventListener('mousemove', onMouseMove);
    
    // Store the listener reference to remove it later if needed
    state.roofHoverListener = onMouseMove;
    
    return () => {
        // Cleanup function
        if (tooltip) document.body.removeChild(tooltip);
        if (state.roofHoverListener) {
            state.renderer.domElement.removeEventListener('mousemove', state.roofHoverListener);
            state.roofHoverListener = null;
        }
    };
}

// Add this new function to filter out panels that collide with walls

export function filterPlacedPanelsForCollisions() {
    // If no panels are placed, nothing to do
    if (!state.solarPanel.panels || state.solarPanel.panels.length === 0) {
        return 0;
    }

    const panelsToRemove = [];
    
    // Get all roof meshes
    const roofMeshes = state.currentMeshes.filter(mesh => 
        mesh.userData.polygonIndex !== undefined && !isVerticalMesh(mesh)
    );
    
    // Create raycaster for collision detection
    const raycaster = new THREE.Raycaster();
    
    // Set a reasonable distance for collision detection
    const collisionDistance = 30; // 3 meters
    raycaster.far = collisionDistance;
    
    // Check each panel
    for (const panel of state.solarPanel.panels) {
        // Get the panel's roof index
        const panelRoofIndex = panel.userData.roofIndex;
        if (panelRoofIndex === undefined) continue;
        
        // Get panel dimensions from state
        const { width, height } = state.solarPanel;
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        // Define the corners in local space
        const localCorners = [
            new THREE.Vector3(-halfWidth, 0, -halfHeight), // Bottom-left
            new THREE.Vector3(halfWidth, 0, -halfHeight),  // Bottom-right
            new THREE.Vector3(halfWidth, 0, halfHeight),   // Top-right
            new THREE.Vector3(-halfWidth, 0, halfHeight),  // Top-left

            new THREE.Vector3(-halfWidth, 0, 0), // Bottom-midpoint
            new THREE.Vector3(halfWidth, 0, 0),  // right-midpoint
            new THREE.Vector3(0, 0, halfHeight),   // Top-midpoint
            new THREE.Vector3(0, 0, -halfHeight),  // left-midpoint

            new THREE.Vector3(0, 0, 0)  // Center
        ];
        
        // Transform to world coordinates using the panel's matrix world
        // This correctly accounts for panel orientation including tilt
        const worldCorners = localCorners.map(corner => {
            const worldPos = corner.clone();
            worldPos.applyMatrix4(panel.matrixWorld);
            return worldPos;
        });
        
        // We'll cast rays in different directions, not just up
        const checkDirections = [
            //worldNormal, // Normal to panel surface
            new THREE.Vector3(0, 1, 0) // World up direction
        ];
        
        
        // Get the other roof meshes to check for collisions
        const otherRoofs = roofMeshes.filter(mesh => 
            mesh.userData.polygonIndex !== panelRoofIndex
        );
        
        // Check if this panel has any collisions
        let hasCollision = false;
        
        cornerLoop:
        for (const corner of worldCorners) {
            // Check each direction
            for (const direction of checkDirections) {
                raycaster.set(corner, direction);
                
                // Check for intersections with other roofs
                const intersects = raycaster.intersectObjects(otherRoofs, true);
                
                if (intersects.length > 0 && intersects[0].distance < collisionDistance) {
                    // Get hit object and find its root parent with polygonIndex
                    let hitObj = intersects[0].object;
                    let hitRoofIndex;
                    
                    while (hitObj && !hitRoofIndex) {
                        hitRoofIndex = hitObj.userData.polygonIndex;
                        hitObj = hitObj.parent;
                    }
                    
                    // If we hit another roof and it's close
                    if (hitRoofIndex !== undefined && 
                        hitRoofIndex !== panelRoofIndex) {
                        
                        hasCollision = true;
                        break cornerLoop;
                    }
                }
            }
        }
        
        // If any collision found, mark panel for removal
        if (hasCollision) {
            panelsToRemove.push(panel);
        }
    }
    
    // Remove panels that collide with other roofs
    if (panelsToRemove.length > 0) {   
        // Remove each panel from the scene and the array
        for (const panel of panelsToRemove) {
            // Remove from scene
            state.scene.remove(panel);
            
            // Clean up geometry and materials
            panel.geometry.dispose();
            if (Array.isArray(panel.material)) {
                panel.material.forEach(mat => {
                    if (mat.map) mat.map.dispose();
                    mat.dispose();
                });
            } else {
                if (panel.material.map) panel.material.map.dispose();
                panel.material.dispose();
            }
            
            // Remove from panels array
            const index = state.solarPanel.panels.indexOf(panel);
            if (index !== -1) {
                state.solarPanel.panels.splice(index, 1);
            }
        }
        
        // Update the count in state
        state.solarPanel.totalPanelsFit = state.solarPanel.panels.length;
    }
    
    return panelsToRemove.length;
}