// Global State
let masterData = []; // Stores the merged data ONCE
let currentData = []; // Stores the currently filtered/sorted data
let sortDirection = 1; // 1 for asc, -1 for desc
let lastSortCol = '';

async function loadData() {
    try {
        const usersResponse = await fetch('electricity_users_en.json');
        const usagesResponse = await fetch('electricity_usages_en.json');

        if (!usersResponse.ok || !usagesResponse.ok) throw new Error("Failed to load JSON files");

        const usersData = await usersResponse.json();
        const usagesTemp = await usagesResponse.json();
        const usagesData = usagesTemp.Sheet1 || usagesTemp;

        // Optimized Merge (Do this only once)
        masterData = usersData.map(user => {
            const usage = usagesData.find(u => u.province_code === user.province_code) || {};

            // Pre-calculate business total
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
        showError('Error loading data: ' + error.message + '. <br>Note: Make sure you are running this on a Local Server (localhost), not opening the file directly.');
    }
}

function updateUI() {
    displayStats(currentData);
    displayTable(currentData);
}

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

function displayTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = data.map(province => `
        <tr>
            <td><strong>${province.province_name}</strong></td>
            <td>${(province.residential_count || 0).toLocaleString()}</td>
            <td>${(province.residential_kwh || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
            <td>${(province.total_business).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
            <td>${(province.ev_charging_kwh || 0).toLocaleString()}</td>
        </tr>
    `).join('');
}

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
    // 1. Logic to determine direction
    if (lastSortCol === key) {
        sortDirection *= -1;
    } else {
        sortDirection = 1; // Default to ascending for new column
        lastSortCol = key;
    }

    // 2. Sort the data
    currentData.sort((a, b) => {
        let valA = a[key] || 0;
        let valB = b[key] || 0;

        if (typeof valA === 'string') {
            return sortDirection * valA.localeCompare(valB);
        }
        return sortDirection * (valA - valB);
    });

    // 3. Update the Arrows visually
    updateSortIcons(key, sortDirection);

    // 4. Re-render table
    displayTable(currentData);
}

function updateSortIcons(activeKey, direction) {
    const allArrows = document.querySelectorAll('.sort-arrow');
    allArrows.forEach(span => {
        span.textContent = '↕';
        span.classList.remove('active');
    });

    const activeArrow = document.getElementById('arrow-' + activeKey);
    if (activeArrow) {
        activeArrow.textContent = direction === 1 ? '↑' : '↓'; 
        activeArrow.classList.add('active');
    }
}

function resetFilters() {
    document.getElementById('provinceSelect').value = '';
    document.getElementById('searchInput').value = '';
    
    // Reset sort state
    sortDirection = 1;
    lastSortCol = '';
    
    // Reset arrows
    const allArrows = document.querySelectorAll('.sort-arrow');
    allArrows.forEach(span => {
        span.textContent = '↕';
        span.classList.remove('active');
    });

    currentData = [...masterData];
    updateUI();
}

function showError(message) {
    document.getElementById('errorMessage').innerHTML = `<div class="error">${message}</div>`;
}

// Event Listeners
document.getElementById('provinceSelect').addEventListener('change', filterData);
document.getElementById('searchInput').addEventListener('input', filterData);

// Init
loadData();