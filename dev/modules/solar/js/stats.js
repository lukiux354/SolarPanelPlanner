import { state as threeState } from './three/state.js';

// tab switching function
export function setupTabSwitching(modal) {
    const tabButtons = modal.querySelectorAll('.tab-btn');
    const tabContents = modal.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            
            const tabId = button.dataset.tab;
            document.getElementById(tabId).classList.add('active');
        });
    });
}


export function createMonthlyChart() {
    const ctx = document.getElementById('monthly-power-chart').getContext('2d');
    if (!ctx) {
        console.error('Could not find chart canvas element');
        return;
    }
    
    const monthlyData = calculateMonthlyProduction();
    const tabElement = document.getElementById('monthly-generation');
    
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is required but not found");
        tabElement.innerHTML = `
            <div class="empty-state-container">
                <div class="empty-state-icon">
                    <i class="fas fa-chart-bar"></i>
                </div>
                <p class="no-data-message">Chart library not loaded.</p>
                <p class="empty-state-hint">Please refresh the page to try again.</p>
            </div>
        `;
        return;
    }
    
    if (!threeState.solarPanel.panels.length) {
        tabElement.innerHTML = `
            <div class="empty-state-container">
                <div class="empty-state-icon">
                    <i class="fas fa-solar-panel"></i>
                </div>
                <p class="no-data-message">No solar panels have been placed yet.</p>
                <p class="empty-state-hint">Add panels to see monthly power generation data.</p>
            </div>
        `;
        return;
    }
    
    tabElement.innerHTML = `
        <!-- Chart with 90% width and centered -->
        <div class="chart-container" style="height: 300px; width: 90%; margin: 0 auto;">
            <canvas id="monthly-power-chart-new"></canvas>
        </div>
        
        <!-- Cards with 90% width, centered, and slightly smaller gap -->
        <div class="summary-cards-container" style="display: flex; flex-direction: row; justify-content: space-between; flex-wrap: nowrap; width: 90%; gap: 6px; margin: 15px auto 0 auto;">
            <div class="metric-card" style="flex: 1; min-width: 0;">
                <div class="metric-icon"><i class="fas fa-calendar-alt"></i></div>
                <div class="metric-value">${monthlyData.annualProduction.toLocaleString()}</div>
                <div class="metric-label">Annual kWh</div>
            </div>
            
            <div class="metric-card" style="flex: 1; min-width: 0;">
                <div class="metric-icon"><i class="fas fa-sun"></i></div>
                <div class="metric-value">${monthlyData.peakMonth}</div>
                <div class="metric-label">Peak Month</div>
            </div>
            
            <div class="metric-card" style="flex: 1; min-width: 0;">
                <div class="metric-icon"><i class="fas fa-bolt"></i></div>
                <div class="metric-value">${monthlyData.avgMonthlyProduction.toLocaleString()}</div>
                <div class="metric-label">Monthly Avg. kWh</div>
            </div>
            
            <div class="metric-card" style="flex: 1; min-width: 0;">
                <div class="metric-icon"><i class="fas fa-plug"></i></div>
                <div class="metric-value">${Math.round(monthlyData.annualProduction/365).toLocaleString()}</div>
                <div class="metric-label">Daily Avg. kWh</div>
            </div>
        </div>
        
        <!-- Note with 90% width and centered -->
        <div class="stats-note" style="width: 90%; margin: 15px auto 0 auto;">
            <p><i class="fas fa-info-circle"></i> <strong>Note:</strong> These estimates are based on average sunshine hours and account for seasonal variations.</p>
        </div>
    `;

    const newCanvas = document.getElementById('monthly-power-chart-new');
    if (newCanvas) {
        const ctx = newCanvas.getContext('2d');
        
        new window.Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Monthly Power (kWh)',
                    data: monthlyData.values,
                    backgroundColor: 'rgba(56, 142, 60, 0.7)',
                    borderColor: 'rgba(56, 142, 60, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Power (kWh)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    }
                }
            }
        });
    }
}

export function calculateMonthlyProduction() {
    const monthlyEfficiency = [
        0.55,  // January - low winter sun
        0.65,  // February
        0.75,  // March - increasing sun angle
        0.85,  // April - spring
        0.95,  // May - approaching summer
        1.0,   // June - peak summer
        1.0,   // July - peak summer
        0.95,  // August - late summer
        0.85,  // September - fall beginning
        0.75,  // October - fall
        0.6,   // November - early winter
        0.5    // December - lowest sun angle
    ];
    
    const panels = threeState.solarPanel.panels;
    const panelWattage = threeState.solarPanel.power?.wattage || 0;
    
    let totalPower = 0;
    
    for (const panel of panels) {
        const efficiency = panel.userData.roofEfficiency || 100;
        const panelPower = panelWattage * (efficiency / 100);
        totalPower += panelPower;
    }
    
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    // average daily sunshine hours by month (approximate for northern hemisphere)
    const avgSunshineHours = [3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 3, 2.5];
    
    const monthlyValues = monthlyEfficiency.map((efficiency, index) => {
        // kWh = kW * hours * days * efficiency
        const monthlyKwh = (totalPower / 1000) * avgSunshineHours[index] * daysInMonth[index] * efficiency;
        return Math.round(monthlyKwh);
    });
    
    const peakIndex = monthlyValues.indexOf(Math.max(...monthlyValues));
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    const annualProduction = monthlyValues.reduce((sum, val) => sum + val, 0);
    
    const avgMonthlyProduction = Math.round(annualProduction / 12);
    
    return {
        values: monthlyValues,
        peakMonth: months[peakIndex],
        annualProduction: annualProduction,
        avgMonthlyProduction: avgMonthlyProduction
    };
}

export function updateSummaryStats() {
    return;
}