
// Global array to track Chart.js instances
let charts = [];
let mapInstance = null;

// Static country coordinates and names for fallback
const countryData = {
    'US': { name: 'United States', coords: [37.0902, -95.7129] },
    'CN': { name: 'China', coords: [35.8617, 104.1954] },
    'GB': { name: 'United Kingdom', coords: [55.3781, -3.4360] },
    'DE': { name: 'Germany', coords: [51.1657, 10.4515] },
    'FR': { name: 'France', coords: [46.2276, 2.2137] },
    'JP': { name: 'Japan', coords: [36.2048, 138.2529] },
    'BR': { name: 'Brazil', coords: [-14.2350, -51.9253] },
    'IN': { name: 'India', coords: [20.5937, 78.9629] },
    'RU': { name: 'Russia', coords: [61.5240, 105.3188] },
    'CA': { name: 'Canada', coords: [56.1304, -106.3468] },
    'AU': { name: 'Australia', coords: [-25.2744, 133.7751] },
    'N/A': { name: 'Unknown', coords: [0, 0] }
};

// Function to get flag emoji from country code
function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode === 'N/A') return '';
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

// Geolocation API configurations
const geoApis = [
    {
        name: 'ipapi.co',
        url: ip => `https://ipapi.co/${ip}/json/`,
        headers: {},
        parse: data => ({
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city || 'Unknown',
            country: data.country_code || 'N/A',
            countryName: data.country_name || 'Unknown'
        })
    },
    {
        name: 'ipstack',
        url: ip => `http://api.ipstack.com/${ip}?access_key=26720b35a18d4f3de66e53651125f850`,
        headers: {},
        parse: data => ({
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city || 'Unknown',
            country: data.country_code || 'N/A',
            countryName: data.country_name || 'Unknown'
        })
    },
    {
        name: 'ipinfo.io',
        url: ip => `https://ipinfo.io/${ip}/json?token=1bd077b7fbb2a4`,
        headers: {},
        parse: data => {
            const [latitude, longitude] = data.loc ? data.loc.split(',').map(Number) : [null, null];
            return {
                latitude,
                longitude,
                city: data.city || 'Unknown',
                country: data.country || 'N/A',
                countryName: data.country || 'Unknown'
            };
        }
    }
];

document.addEventListener("DOMContentLoaded", function () {
    const ipForm = document.getElementById("ipForm");
    const ipsTextarea = document.getElementById("ips");
    const ipfile = document.getElementById("ipfile");
    const clearBtn = document.getElementById("clearForm");
    const selectAllCheckbox = document.getElementById("selectAll");

    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    }

    // Load saved thresholds
    const lowThreshold = localStorage.getItem('lowThreshold') || 25;
    const mediumThreshold = localStorage.getItem('mediumThreshold') || 75;
    document.getElementById('lowThreshold').value = lowThreshold;
    document.getElementById('mediumThreshold').value = mediumThreshold;

    // Replace [.] with . in textarea
    ipsTextarea.addEventListener("input", function () {
        this.value = this.value.replace(/\[\.\]/g, ".");
        validateIPs();
    });

    // Handle file input
    ipfile.addEventListener("change", function () {
        const file = ipfile.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            let content = e.target.result;
            content = content.replace(/\[\.\]/g, ".");
            ipsTextarea.value = content;
            validateIPs();
        };
        reader.readAsText(file);
    });

    // Clear form
    clearBtn.addEventListener("click", function () {
        ipsTextarea.value = "";
        ipfile.value = "";
        document.getElementById("ispFilter").value = "";
        document.getElementById("scoreMin").value = "0";
        document.getElementById("scoreMax").value = "100";
        document.getElementById("reportsMin").value = "0";
        document.getElementById("categoryFilter").value = "";
        tableData = [...fullTableData];
        document.getElementById("ips").classList.remove('invalid-line');
        document.getElementById("errorMessage").classList.add('hidden');
        updateTable();
    });

    // Column Toggles
    document.querySelectorAll('#columnToggles input').forEach(checkbox => {
        checkbox.addEventListener('change', updateTable);
    });

    // Select All Checkbox
    selectAllCheckbox.addEventListener('change', function () {
        document.querySelectorAll('#tableBody input[type="checkbox"]').forEach(cb => {
            cb.checked = this.checked;
        });
    });

    
    // Threshold Changes
    document.getElementById('lowThreshold').addEventListener('change', function() {
        localStorage.setItem('lowThreshold', this.value);
        updateTable();
    });
    document.getElementById('mediumThreshold').addEventListener('change', function() {
        localStorage.setItem('mediumThreshold', this.value);
        updateTable();
    });

    // Apply Filters
    document.getElementById('applyFilters').addEventListener('click', function() {
        const scoreMin = parseInt(document.getElementById('scoreMin').value) || 0;
        const scoreMax = parseInt(document.getElementById('scoreMax').value) || 100;
        const reportsMin = parseInt(document.getElementById('reportsMin').value) || 0;
        const selectedCategory = document.getElementById('categoryFilter').value;
        const selectedISP = document.getElementById('ispFilter').value;

        tableData = fullTableData.filter(r => {
            const score = parseInt(r.score) || 0;
            const reports = parseInt(r.reports) || 0;
            return score >= scoreMin &&
                   score <= scoreMax &&
                   reports >= reportsMin &&
                   (!selectedCategory || r.categories.includes(selectedCategory)) &&
                   (!selectedISP || r.isp === selectedISP);
        });
        updateTable();
    });
});

let tableData = [];
let fullTableData = [];

// Validate IPs
function validateIPs() {
    const lines = document.getElementById('ips').value.split('\n').map(line => line.trim());
    const errorMessage = document.getElementById('errorMessage');
    const textarea = document.getElementById('ips');
    const invalidLines = [];

    if (lines.every(line => line === '')) {
        textarea.classList.remove('invalid-line');
        errorMessage.classList.add('hidden');
        return true;
    }

    lines.forEach((line, index) => {
        if (line && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(line) && !/^(?:www\.)?[\w.-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}$/.test(line)) {
            invalidLines.push(index + 1);
        }
    });

   if (invalidLines.length > 0) {
    errorMessage.innerText = `Invalid IPs/hostnames on lines: ${invalidLines.join(', ')}`;
    errorMessage.classList.remove('hidden');
    textarea.classList.add('invalid-line');
    return false;
} 


    textarea.classList.remove('invalid-line');
    errorMessage.classList.add('hidden');
    return true;
}

// Convert IP to number for sorting
function ipToNumber(ip) {
    const parts = ip.split('.').map(Number);
    return parts[0] * 256 ** 3 + parts[1] * 256 ** 2 + parts[2] * 256 + parts[3];
}

// Table Sorting
function sortTable(column) {
    const table = document.getElementById("resultTable");
    const dir = table.getAttribute('data-sort-dir') === 'asc' ? 'desc' : 'asc';
    table.setAttribute('data-sort-column', column);
    table.setAttribute('data-sort-dir', dir);
    tableData.sort((a, b) => {
        let x = a[Object.keys(a)[column - 1]];
        let y = b[Object.keys(b)[column - 1]];
        if (column === 1) {
            x = ipToNumber(x);
            y = ipToNumber(y);
            return dir === 'asc' ? x - y : y - x;
        }
        if (column === 3 || column === 4) {
            x = parseFloat(x) || 0;
            y = parseFloat(y) || 0;
            return dir === 'asc' ? x - y : y - x;
        }
        if (column === 6) {
            x = a.countryName || x;
            y = b.countryName || y;
        }
        if (column === 7) {
            x = Array.isArray(x) && x.length > 0 ? x[0] : '';
            y = Array.isArray(y) && y.length > 0 ? y[0] : '';
        }
        return dir === 'asc' ? x.localeCompare(y) : y.localeCompare(x);
    });
    updateTable();
}

// Populate Category Filter
function populateCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    const categories = [...new Set(fullTableData.flatMap(r => r.categories))].sort();
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
}

// Generate dynamic colors for pie chart
function generateColors(count) {
    const colors = [
        '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40',
        '#ff4444', '#00c4b4', '#c837ab', '#ffcd38', '#6b48ff', '#48c774'
    ];
    if (count <= colors.length) return colors.slice(0, count);
    const generated = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * 360 / count) % 360;
        generated.push(`hsl(${hue}, 70%, 50%)`);
    }
    return generated;
}

// Delay helper for rate limiting
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch geolocation for an IP with multiple APIs and caching
async function fetchGeoLocation(ip) {
    const cacheKey = `geo_${ip}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (data.latitude && data.longitude && data.expires > Date.now()) {
                console.log(`Using cached geolocation for IP ${ip}`);
                return data;
            }
        } catch (e) {
            console.warn(`Invalid cache for IP ${ip}:`, e);
        }
    }

    for (let i = 0; i < geoApis.length; i++) {
        const api = geoApis[i];
        if (api.url.includes('YOUR_')) {
            console.warn(`Skipping ${api.name} due to missing API key`);
            continue;
        }
        try {
            await delay(i * 200); // Rate limit: 200ms delay between APIs
            const response = await fetch(api.url(ip), { headers: api.headers });
            if (!response.ok) {
                console.warn(`Geolocation fetch failed for IP ${ip} on ${api.name}: HTTP ${response.status}`);
                continue;
            }
            const data = await response.json();
            if (data.error || !api.parse(data).latitude || !api.parse(data).longitude) {
                console.warn(`Invalid geolocation data for IP ${ip} on ${api.name}:`, data);
                continue;
            }
            const geoData = api.parse(data);
            // Cache for 24 hours
            const cacheData = { ...geoData, expires: Date.now() + 24 * 60 * 60 * 1000 };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log(`Geolocation fetched for IP ${ip} from ${api.name}`);
            return cacheData;
        } catch (error) {
            console.warn(`Error fetching geolocation for IP ${ip} from ${api.name}:`, error);
        }
    }

    // Fallback to static coordinates
    console.warn(`All geolocation APIs failed for IP ${ip}, using static coordinates`);
    const countryCode = tableData.find(r => r.input === ip)?.country || 'N/A';
    return {
        latitude: countryData[countryCode]?.coords[0] || 0,
        longitude: countryData[countryCode]?.coords[1] || 0,
        city: 'Unknown',
        country: countryCode,
        countryName: countryData[countryCode]?.name || 'Unknown'
    };
}

// Render Charts
function renderCharts() {
    // Destroy existing charts
    charts.forEach(chart => chart.destroy());
    charts = [];

    // Category Pie Chart
    const categoryCanvas = document.getElementById('categoryChart');
    const categoryPlaceholder = document.getElementById('categoryChartPlaceholder');
    const categories = tableData.flatMap(r => Array.isArray(r.categories) ? r.categories : []).filter(cat => cat && cat !== 'None');
    const categoryCounts = categories.reduce((acc, cat) => {
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});
    console.log('Category Counts:', categoryCounts);

    if (Object.keys(categoryCounts).length > 0 && categoryCanvas) {
        categoryPlaceholder.classList.add('hidden');
        categoryCanvas.classList.remove('hidden');
        charts.push(new Chart(categoryCanvas, {
            type: 'pie',
            data: {
                labels: Object.keys(categoryCounts),
                datasets: [{
                    data: Object.values(categoryCounts),
                    backgroundColor: generateColors(Object.keys(categoryCounts).length)
                }]
            },
            options: {
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: false }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        }));
    } else {
        categoryCanvas.classList.add('hidden');
        categoryPlaceholder.classList.remove('hidden');
    }

    // Score Histogram
    const scoreBins = Array(10).fill(0);
    tableData.forEach(r => {
        const score = Math.min(Math.floor((parseInt(r.score) || 0) / 10), 9);
        scoreBins[score]++;
    });
    const scoreCanvas = document.getElementById('scoreChart');
    if (scoreCanvas) {
        charts.push(new Chart(scoreCanvas, {
            type: 'bar',
            data: {
                labels: ['0-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90', '91-100'],
                datasets: [{
                    label: 'IPs',
                    data: scoreBins,
                    backgroundColor: '#36a2eb'
                }]
            },
            options: {
                scales: { y: { beginAtZero: true } },
                responsive: true,
                maintainAspectRatio: false
            }
        }));
    }

    // Country Bar Chart
    const countries = tableData.reduce((acc, r) => {
        const countryName = r.countryName || 'Unknown';
        acc[countryName] = (acc[countryName] || 0) + 1;
        return acc;
    }, {});
    const countryCanvas = document.getElementById('countryChart');
    if (countryCanvas) {
        charts.push(new Chart(countryCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(countries),
                datasets: [{
                    label: 'IPs',
                    data: Object.values(countries),
                    backgroundColor: '#ffce56'
                }]
            },
            options: {
                scales: { y: { beginAtZero: true } },
                responsive: true,
                maintainAspectRatio: false
            }
        }));
    }

    document.getElementById('analyticsDashboard').classList.remove('hidden');
}

// Render Map
async function renderMap() {
    const mapContainer = document.getElementById('mapContainer');
    const mapElement = document.getElementById('map');
    const mapError = document.getElementById('mapError');
    mapContainer.classList.remove('hidden');

    // Clear existing map
    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }
    mapElement.innerHTML = '';

    // Initialize map
    mapInstance = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18
    }).addTo(mapInstance);

    const bounds = [];
    let failedGeoLocations = false;

    // Fetch geolocation for all IPs
    const geoPromises = tableData.map(async r => {
        const geo = await fetchGeoLocation(r.input);
        if (geo.latitude && geo.longitude && geo.latitude !== 0 && geo.longitude !== 0) {
            return { ...r, latitude: geo.latitude, longitude: geo.longitude, city: geo.city };
        } else {
            return { ...r, latitude: null, longitude: null, city: 'Unknown' };
        }
    });

    const geoData = await Promise.all(geoPromises);
    console.log('GeoData:', geoData); // Debug log

    geoData.forEach(r => {
        if (r.latitude && r.longitude) {
            const score = parseInt(r.score) || 0;
            const color = score >= parseInt(document.getElementById('mediumThreshold').value) ? 'red' :
                          score >= parseInt(document.getElementById('lowThreshold').value) ? 'orange' : 'green';
            L.circleMarker([r.latitude, r.longitude], {
                radius: 6,
                color: color,
                fillOpacity: 0.6,
                weight: 2
            }).addTo(mapInstance).bindPopup(
                `${r.input} (${r.city}, ${r.countryName || r.country}): ${r.score}%`
            );
            bounds.push([r.latitude, r.longitude]);
        } else {
            failedGeoLocations = true;
            console.warn(`No valid coordinates for IP ${r.input}`);
        }
    });

    // Adjust map view to fit all markers
    if (bounds.length > 0) {
        mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    } else {
        mapInstance.setView([0, 0], 2);
        failedGeoLocations = true;
    }

    // Show error if some IPs couldn't be geolocated
    mapError.classList.toggle('hidden', !failedGeoLocations);
    if (failedGeoLocations) {
        mapError.innerText = 'Some IPs could not be geolocated. Check console for details.';
    }
}

// Update Table
function updateTable() {
    const lowThreshold = parseInt(document.getElementById('lowThreshold').value) || 25;
    const mediumThreshold = parseInt(document.getElementById('mediumThreshold').value) || 75;
    const tbody = document.getElementById("tableBody");
    const visibleColumns = Array.from(document.querySelectorAll('#columnToggles input:checked')).map(input => input.value);
    const headers = document.querySelectorAll('#resultTable th');
    headers.forEach((th, index) => {
        const column = th.className.match(/column-(\w+)/)?.[1];
        if (column && column !== 'row' && column !== 'select' && column !== 'actions') {
            th.classList.toggle('hidden', !visibleColumns.includes(column));
        }
    });

    tbody.innerHTML = '';
    tableData.forEach((r, index) => {
        const categories = Array.isArray(r.categories) ? r.categories : ['None'];
        const row = tbody.insertRow();
        const score = parseInt(r.score) || 0;
        let rowClass = score >= mediumThreshold ? 'malicious-high' : score >= lowThreshold ? 'malicious-medium' : 'malicious-low';
        row.className = `${rowClass} highlight fade-in`;
        const countryDisplay = r.country === 'N/A' ? 'Unknown' : `${getFlagEmoji(r.country)} ${r.countryName || r.country}`;
        row.innerHTML = `
            <td class="p-4 column-row">${index + 1}</td>
            <td class="p-4 column-select"><input type="checkbox" class="row-select" title="Select for Export"></td>
            <td class="p-4 column-input ${visibleColumns.includes('input') ? '' : 'hidden'}">${r.input}</td>
            <td class="p-4 column-isp ${visibleColumns.includes('isp') ? '' : 'hidden'}">${r.isp}</td>
            <td class="p-4 column-reports ${visibleColumns.includes('reports') ? '' : 'hidden'}">${r.reports}</td>
            <td class="p-4 column-score ${visibleColumns.includes('score') ? '' : 'hidden'}">${r.score}</td>
            <td class="p-4 column-domain ${visibleColumns.includes('domain') ? '' : 'hidden'}">${r.domain}</td>
            <td class="p-4 column-country ${visibleColumns.includes('country') ? '' : 'hidden'}">${countryDisplay}</td>
            <td class="p-4 column-categories ${visibleColumns.includes('categories') ? '' : 'hidden'}">${categories.join(', ')}</td>
            <td class="p-4 column-actions">
                <button onclick="removeRow(this)" class="text-red-400 hover:text-red-500" title="Remove this IP">❌</button>
            </td>`;
        row.setAttribute('data-isp', r.isp);
        row.setAttribute('data-country', r.country);
    });
    document.getElementById("selectAll").checked = false;
    updateBulkRemoveOptions();
    document.getElementById("bulkActionContainer").classList.toggle('hidden', tableData.length === 0);
    document.getElementById("ispFilterContainer").classList.toggle('hidden', tableData.length === 0);
    document.getElementById("resultTable").classList.toggle('hidden', tableData.length === 0);
    document.getElementById("analyticsMapContainer").classList.toggle('hidden', tableData.length === 0);
    if (tableData.length > 0) {
        populateCategoryFilter();
        renderCharts();
        renderMap();
    } else {
        document.getElementById('analyticsMapContainer').classList.add('hidden');
        charts.forEach(chart => chart.destroy());
        charts = [];
        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
        }
        document.getElementById('categoryChartPlaceholder').classList.add('hidden');
        document.getElementById('mapError').classList.add('hidden');
    }
}

// Remove Single Row
function removeRow(btn) {
    const row = btn.parentElement.parentElement;
    const index = Array.from(row.parentElement.children).indexOf(row);
    tableData.splice(index, 1);
    fullTableData = tableData;
    updateTable();
}

// Update Bulk Remove and Filter Options
function updateBulkRemoveOptions() {
    const ispSelect = document.getElementById("ispSelect");
    const ispFilter = document.getElementById("ispFilter");
    const isps = [...new Set(fullTableData.map(r => r.isp))].filter(isp => isp !== 'Unknown').sort();
    ispSelect.innerHTML = '<option value="">Select an ISP</option>';
    ispFilter.innerHTML = '<option value="">All ISPs</option>';
    isps.forEach(isp => {
        const option = document.createElement('option');
        option.value = isp;
        option.textContent = isp;
        ispSelect.appendChild(option);
        ispFilter.appendChild(option.cloneNode(true));
    });

    const countrySelect = document.getElementById("countrySelect");
    const countries = [...new Set(fullTableData.map(r => ({
        code: r.country,
        name: r.countryName || countryData[r.country]?.name || r.country
    })))].filter(c => c.code !== 'N/A').sort((a, b) => a.name.localeCompare(b.name));
    countrySelect.innerHTML = '<option value="">Select a Country</option>';
    countries.forEach(c => {
        const option = document.createElement('option');
        option.value = c.code;
        option.textContent = `${getFlagEmoji(c.code)} ${c.name}`;
        countrySelect.appendChild(option);
    });
}

// ISP Filter
document.getElementById("ispFilter").addEventListener('change', function() {
    const selectedISP = this.value;
    if (selectedISP === '') {
        tableData = [...fullTableData];
    } else {
        tableData = fullTableData.filter(r => r.isp === selectedISP);
    }
    updateTable();
});

// ISP Removal Modal
document.getElementById("bulkRemoveISPBtn").addEventListener('click', function() {
    document.getElementById("bulkRemoveISPModal").classList.remove('hidden');
});

document.getElementById("cancelBulkRemoveISP").addEventListener('click', function() {
    document.getElementById("bulkRemoveISPModal").classList.add('hidden');
});

document.getElementById("removeSelectedISP").addEventListener('click', function() {
    const isp = document.getElementById("ispSelect").value;
    if (isp) {
        tableData = tableData.filter(r => r.isp !== isp);
        fullTableData = fullTableData.filter(r => r.isp !== isp);
        updateTable();
    }
    document.getElementById("bulkRemoveISPModal").classList.add('hidden');
});

// Country Removal Modal
document.getElementById("bulkRemoveCountryBtn").addEventListener('click', function() {
    document.getElementById("bulkRemoveCountryModal").classList.remove('hidden');
});

document.getElementById("cancelBulkRemoveCountry").addEventListener('click', function() {
    document.getElementById("bulkRemoveCountryModal").classList.add('hidden');
});

document.getElementById("confirmBulkRemoveCountry").addEventListener('click', function() {
    const country = document.getElementById("countrySelect").value;
    if (country) {
        tableData = tableData.filter(r => r.country !== country);
        fullTableData = fullTableData.filter(r => r.country !== country);
        updateTable();
    }
    document.getElementById("bulkRemoveCountryModal").classList.add('hidden');
});

// Report Modal
document.getElementById("reportSelectedBtn").addEventListener('click', function() {
    const selectedRows = Array.from(document.querySelectorAll('#tableBody input.row-select:checked'));
    if (selectedRows.length === 0) {
        alert('Please select at least one IP to report.');
        return;
    }
    document.getElementById("reportModal").classList.remove('hidden');
});

document.getElementById("cancelReport").addEventListener('click', function() {
    document.getElementById("reportModal").classList.add('hidden');
});

document.getElementById("confirmReport").addEventListener('click', async function() {
    const selectedRows = Array.from(document.querySelectorAll('#tableBody input.row-select:checked'));
    if (selectedRows.length === 0) {
        alert('Please select at least one IP to report.');
        return;
    }
    const ips = selectedRows.map(cb => {
        const rowIndex = Array.from(cb.parentElement.parentElement.parentElement.children).indexOf(cb.parentElement.parentElement);
        return tableData[rowIndex].input;
    });
    const categories = Array.from(document.getElementById("reportCategories").selectedOptions).map(opt => opt.value);
    const comment = document.getElementById("reportComment").value;

    if (categories.length === 0) {
        alert('Please select at least one category.');
        return;
    }

    try {
        const res = await fetch("", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'report', ips, categories, comment })
        });
        const data = await res.json();
        const results = data.results || [];
        const successes = results.filter(r => r.status === 'success').map(r => r.ip);
        const failures = results.filter(r => r.status === 'failed').map(r => `${r.ip} (${r.error})`);

        let message = '';
        if (successes.length > 0) {
            message += `Successfully reported: ${successes.join(', ')}\n`;
        }
        if (failures.length > 0) {
            message += `Failed to report: ${failures.join(', ')}`;
        }
        alert(message);
    } catch (error) {
        console.error('Report error:', error);
        alert(`Error reporting IPs: ${error.message}`);
    }

    document.getElementById("reportModal").classList.add('hidden');
});

// Export Results
document.getElementById("exportBtn").addEventListener('click', function() {
    exportResults();
});

function exportResults() {
    
    if (!tableData || tableData.length === 0) {
        alert('No data to export.');
        return;
    }
    try {
        const format = document.getElementById('exportFormat').value;
        const visibleColumns = Array.from(document.querySelectorAll('#columnToggles input:checked')).map(input => input.value);
        const headers = visibleColumns.filter(col => col !== 'row' && col !== 'select' && col !== 'actions');
        const table = document.getElementById('resultTable');
        const sortColumn = parseInt(table.getAttribute('data-sort-column'));
        const sortDir = table.getAttribute('data-sort-dir');
        const columnKeys = ['input', 'isp', 'reports', 'score', 'domain', 'country', 'categories'];
        const sortKey = columnKeys[Math.max(0, Math.min(sortColumn - 1, columnKeys.length - 1))] || 'input';

        const selectedRows = Array.from(document.querySelectorAll('#tableBody input.row-select:checked')).map(cb => {
            const rowIndex = Array.from(cb.parentElement.parentElement.parentElement.children).indexOf(cb.parentElement.parentElement);
            return tableData[rowIndex] || null;
        }).filter(row => row !== null);
        const exportData = selectedRows.length > 0 ? selectedRows : tableData;

        const sortedData = [...exportData].sort((a, b) => {
            let x = String(a[sortKey] ?? '');
            let y = String(b[sortKey] ?? '');
            if (sortKey === 'input') {
                x = ipToNumber(x);
                y = ipToNumber(y);
                return sortDir === 'asc' ? x - y : y - x;
            }
            if (sortKey === 'reports' || sortKey === 'score') {
                x = parseFloat(x) || 0;
                y = parseFloat(y) || 0;
                return dir === 'asc' ? x - y : y - x;
            }
            if (sortKey === 'country') {
                x = a.countryName || x;
                y = b.countryName || y;
            }
            if (sortKey === 'categories') {
                x = Array.isArray(x) && x.length > 0 ? x[0] : '';
                y = Array.isArray(y) && y.length > 0 ? y[0] : '';
            }
            return sortDir === 'asc' ? x.localeCompare(y) : y.localeCompare(x);
        });

        let blob, filename;
        if (format === 'csv') {
            const colWidths = headers.reduce((widths, col) => {
                widths[col] = Math.max(col.length, ...sortedData.map(row => {
                    if (col === 'country') {
                        return (row.countryName || row[col] || 'N/A').length;
                    }
                    return String(col === 'categories' ? (Array.isArray(row[col]) ? row[col].join(';') : 'None') : (row[col] ?? 'N/A')).length;
                }));
                return widths;
            }, {});
            const csv = [
                headers.map(col => `"${col}"`).join(','),
                ...sortedData.map(row => headers.map(col => {
                    let value = col === 'country' ? (row.countryName || row[col] || 'N/A') :
                                col === 'categories' ? (Array.isArray(row[col]) ? row[col].join(';') : 'None') :
                                (row[col] ?? 'N/A');
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(','))
            ].join('\n');
            blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            filename = 'ip_abuse_results.csv';
        } else if (format === 'json') {
            const jsonData = sortedData.map(row => {
                const obj = {};
                headers.forEach(col => {
                    obj[col] = col === 'country' ? (row.countryName || row[col] || 'N/A') :
                               col === 'categories' ? (Array.isArray(row[col]) ? row[col] : ['None']) :
                               (row[col] ?? 'N/A');
                });
                return obj;
            });
            blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json;charset=utf-8' });
            filename = 'ip_abuse_results.json';
        } else {
            const colWidths = headers.reduce((widths, col) => {
                widths[col] = Math.max(col.length, ...sortedData.map(row => {
                    if (col === 'country') {
                        return (row.countryName || row[col] || 'N/A').length;
                    }
                    return String(col === 'categories' ? (Array.isArray(row[col]) ? row[col].join(';') : 'None') : (row[col] ?? 'N/A')).length;
                }));
                return widths;
            }, {});
            const txt = [
                headers.map(col => col.padEnd(colWidths[col])).join('  '),
                headers.map(col => '-'.repeat(colWidths[col])).join('  '),
                ...sortedData.map(row => headers.map(col => {
                    let value = col === 'country' ? (row.countryName || row[col] || 'N/A') :
                                col === 'categories' ? (Array.isArray(row[col]) ? row[col].join(';') : 'None') :
                                (row[col] ?? 'N/A');
                    return String(value).padEnd(colWidths[col]);
                }).join('  '))
            ].join('\n');
            blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
            filename = 'ip_abuse_results.txt';
        }

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export. Please check the console for details.');
    }
}

// Form Submission
document.getElementById("ipForm").addEventListener('submit', async function(e) {
    e.preventDefault();
    const errorMessage = document.getElementById("errorMessage");
    const internalIpsMessage = document.getElementById("internalIpsMessage");
    const textarea = document.getElementById("ips");

    errorMessage.classList.add('hidden');
    internalIpsMessage.classList.add('hidden');

    if (!validateIPs()) return;

    const lines = textarea.value.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length === 0 && !ipForm.querySelector('#ipfile').files.length) {
        errorMessage.innerText = 'Please enter at least one IP/hostname or upload a file.';
        errorMessage.classList.remove('hidden');
        return;
    }

    document.getElementById("progress").classList.remove('hidden');

    try {
        const form = new FormData(this);
        const res = await fetch("", { method: 'POST', body: form });
        const data = await res.json();

        if (data.error) {
            throw new Error(data.error);
        }

        fullTableData = data.results.filter(r => !r.error);
        tableData = [...fullTableData];
        updateTable();

        // Display error rows if any
        const errorRows = data.results.filter(r => r.error);
        if (errorRows.length > 0) {
            errorMessage.innerText = `Errors for some IPs: ${errorRows.map(r => `${r.input} (${r.error})`).join(', ')}`;
            errorMessage.classList.remove('hidden');
        }

        if (data.internalIps && data.internalIps.length > 0) {
            internalIpsMessage.innerText = `Excluded internal/private IPs: ${data.internalIps.join(', ')}`;
            internalIpsMessage.classList.remove('hidden');
        }

        let totalRemaining = 0;
        let totalLimit = 0;
        const defaultLimitPerKey = 1000;
        const zeroRemainingKeys = [];
        const keyCount = Object.keys(data.stats).length;

        for (const [suffix, s] of Object.entries(data.stats)) {
            const remainingNum = Number(s.remaining);
            const limitNum = defaultLimitPerKey;
            totalRemaining += remainingNum;
            totalLimit += limitNum;
            if (remainingNum <= 0) {
                zeroRemainingKeys.push(suffix);
            }
        }

        const summary = document.createElement('p');
        summary.id = 'summary';
        summary.style.fontWeight = 'bold';
        summary.style.marginBottom = '1em';
        summary.textContent = `Remaining requests: ${totalRemaining} out of ${totalLimit} (${totalRemaining}/${totalLimit}) across ${keyCount} API key(s).`;

        if (zeroRemainingKeys.length > 0) {
            const keysStr = zeroRemainingKeys.map(s => `...${s}`).join(', ');
            const warning = document.createElement('p');
            warning.style.color = 'red';
            warning.style.fontWeight = 'bold';
            warning.textContent = `⚠️ Warning: The following API key(s) have run out of requests: ${keysStr}`;
            summary.appendChild(document.createElement('br'));
            summary.appendChild(warning);
        }

        const apiStatsContainer = document.getElementById("apiStats");
        apiStatsContainer.innerHTML = '';
        apiStatsContainer.appendChild(summary);
        apiStatsContainer.classList.remove('hidden');

    } catch (error) {
        console.error('Form submission error:', error);
        errorMessage.innerText = `Error: ${error.message}`;
        errorMessage.classList.remove('hidden');
    } finally {
        document.getElementById("progress").classList.add('hidden');
    }
});
