// --- Global State ---
let masterData = []; 
let currentData = [];
let sortDirection = 1; 
let lastSortCol = '';
let barChartInstance = null;
let pieChartInstance = null;

// --- Load Data ---
async function loadData() {
    try {
        const usersResponse = await fetch('electricity_users_en.json');
        const usagesResponse = await fetch('electricity_usages_en.json');

        if (!usersResponse.ok || !usagesResponse.ok) throw new Error("Failed to load JSON files");

        const usersData = await usersResponse.json();
        const usagesTemp = await usagesResponse.json();
        const usagesData = usagesTemp.Sheet1 || usagesTemp;

        // Merge Data
        masterData = usersData.map(user => {
            const usage = usagesData.find(u => u.province_code === user.province_code) || {};
            
            const totalBusiness = (usage.small_business_kwh || 0) + 
                                  (usage.medium_business_kwh || 0) + 
                                  (usage.large_business_kwh || 0);

            return { ...user, ...usage, total_business: totalBusiness };
        });

        // Initialize
        currentData = [...masterData];
        populateProvinceSelect();
        updateUI();

    } catch (error) {
        showError('Error loading data: ' + error.message + '. <br>Note: Use Live Server!');
    }
}

// --- Main UI Updater ---
function updateUI() {
    displayStats(currentData);
    renderCharts(currentData);
    displayTable(currentData);
}

// --- Render Stats ---
function displayStats(data) {
    const stats = {
        totalUsers: data.reduce((sum, p) => sum + (p.residential_count || 0), 0),
        totalUsage: data.reduce((sum, p) => sum + (p.residential_kwh || 0), 0),
        totalEVStations: data.reduce((sum, p) => sum + (p.ev_charging_count || 0), 0),
        totalProvinces: data.length
    };

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card">
            <h3>Total Provinces</h3>
            <div class="value">${stats.totalProvinces}</div>
        </div>
        <div class="stat-card">
            <h3>Total Users</h3>
            <div class="value">${stats.totalUsers.toLocaleString()}</div>
        </div>
        <div class="stat-card">
            <h3>Total Res. Usage (kWh)</h3>
            <div class="value">${(stats.totalUsage / 1e6).toFixed(2)}M</div> 
        </div>
        <div class="stat-card">
            <h3>EV Stations</h3>
            <div class="value">${stats.totalEVStations.toLocaleString()}</div>
        </div>
    `;
}

// --- Render Table ---
function displayTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = data.map(province => `
        <tr>
            <td><strong>${province.province_name}</strong></td>
            <td>${(province.residential_count || 0).toLocaleString()}</td>
            <td>${(province.residential_kwh || 0).toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
            <td>${(province.total_business).toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
            <td>${(province.ev_charging_kwh || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}

// --- Render Charts ---
function renderCharts(data) {
    // 1. Data Prep for Bar Chart
    const topProvinces = [...data]
        .sort((a, b) => {
            const totalA = (a.residential_kwh || 0) + a.total_business + (a.ev_charging_kwh || 0);
            const totalB = (b.residential_kwh || 0) + b.total_business + (b.ev_charging_kwh || 0);
            return totalB - totalA;
        })
        .slice(0, 10);

    const barLabels = topProvinces.map(p => p.province_name);
    const barData = topProvinces.map(p => (
        (p.residential_kwh || 0) + p.total_business + (p.ev_charging_kwh || 0)
    ));

    // 2. Data Prep for Pie Chart
    const totalRes = data.reduce((sum, p) => sum + (p.residential_kwh || 0), 0);
    const totalBus = data.reduce((sum, p) => sum + p.total_business, 0);
    const totalEV = data.reduce((sum, p) => sum + (p.ev_charging_kwh || 0), 0);

    // Render Bar
    const ctxBar = document.getElementById('topProvincesChart').getContext('2d');
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: barLabels,
            datasets: [{
                label: 'Total Usage (kWh)',
                data: barData,
                backgroundColor: '#667eea',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Top 10 Provinces by Usage', font: {size: 16} }, legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { callback: function(val) { return (val / 1e6).toFixed(0) + 'M'; } } } }
        }
    });

    // Render Pie
    const ctxPie = document.getElementById('usageDistributionChart').getContext('2d');
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Residential', 'Business', 'EV Charging'],
            datasets: [{
                data: [totalRes, totalBus, totalEV],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Usage Distribution (kWh)', font: {size: 16} }, legend: { position: 'bottom' } }
        }
    });
}

// --- Helpers ---
function populateProvinceSelect() {
    const select = document.getElementById('provinceSelect');
    const provinces = [...new Set(masterData.map(p => p.province_name))].sort();
    provinces.forEach(province => {
        const option = document.createElement('option');
        option.value = province;
        option.textContent = province;
        select.appendChild(option);
    });
}

function filterData() {
    const province = document.getElementById('provinceSelect').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    currentData = masterData.filter(p => {
        const matchesProvince = province ? p.province_name === province : true;
        const matchesSearch = p.province_name.toLowerCase().includes(search);
        return matchesProvince && matchesSearch;
    });
    updateUI();
}

function sortTable(key) {
    if (lastSortCol === key) {
        sortDirection *= -1;
    } else {
        sortDirection = 1;
        lastSortCol = key;
    }

    currentData.sort((a, b) => {
        let valA = a[key] || 0;
        let valB = b[key] || 0;
        if (typeof valA === 'string') return sortDirection * valA.localeCompare(valB);
        return sortDirection * (valA - valB);
    });

    updateSortIcons(key, sortDirection);
    displayTable(currentData);
}

function updateSortIcons(activeKey, direction) {
    const allArrows = document.querySelectorAll('.sort-arrow');
    allArrows.forEach(span => { span.textContent = '↕'; span.classList.remove('active'); });
    const activeArrow = document.getElementById('arrow-' + activeKey);
    if (activeArrow) { activeArrow.textContent = direction === 1 ? '↑' : '↓'; activeArrow.classList.add('active'); }
}

function resetFilters() {
    document.getElementById('provinceSelect').value = '';
    document.getElementById('searchInput').value = '';
    sortDirection = 1;
    lastSortCol = '';
    const allArrows = document.querySelectorAll('.sort-arrow');
    allArrows.forEach(span => { span.textContent = '↕'; span.classList.remove('active'); });
    currentData = [...masterData];
    updateUI();
}

function showError(message) { document.getElementById('errorMessage').innerHTML = `<div class="error">${message}</div>`; }

// --- Theme Toggle Logic ---
const themeToggleBtn = document.getElementById('themeToggle');
const htmlElement = document.documentElement;

// Check LocalStorage
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    htmlElement.setAttribute('data-theme', savedTheme);
    updateIcon(savedTheme);
}

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateIcon(newTheme);
});

function updateIcon(theme) {
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Event Listeners & Init
document.getElementById('provinceSelect').addEventListener('change', filterData);
document.getElementById('searchInput').addEventListener('input', filterData);
loadData();