<?php
include "api.php";
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IP Abuse Checker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css" />
    <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-gray-800 text-gray-100 min-h-screen flex flex-col">
    
    <div class="container mx-auto px-6 py-10 flex-grow">
        <h1 class="text-4xl font-bold text-center mb-8 text-blue-300">IP Abuse Checker</h1>

        <!-- Form -->
        <form id="ipForm" enctype="multipart/form-data" class="bg-gray-700 p-8 rounded-xl shadow-lg mb-8">
            <div class="mb-6">
                <label for="ips" class="block text-sm font-medium text-gray-200 mb-2">Enter IPs or Hostnames</label>
                <textarea name="ips" id="ips" rows="5" class="w-full p-4 bg-gray-600 text-gray-100 rounded-lg border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Enter IPs or hostnames (one per line)"></textarea>
            </div>
            <div class="mb-6">
                <label for="ipfile" class="block text-sm font-medium text-gray-200 mb-2">Or Upload a File</label>
                <input type="file" name="ipfile" id="ipfile" accept=".txt" class="w-full p-4 bg-gray-600 text-gray-100 rounded-lg border border-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600">
            </div>
            <div class="flex space-x-4">
                <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-200">Start Checking IPs</button>
                <button type="button" id="clearForm" class="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-200">Clear</button>
            </div>
        </form>

        <!-- Advanced Filters -->
        <div class="bg-gray-700 p-6 rounded-lg shadow-lg mb-6">
            <h3 class="text-lg font-semibold text-gray-200 mb-4">Advanced Filters</h3>
            <div class="flex flex-wrap gap-4">
                <div>
                    <label for="scoreMin" class="block text-sm font-medium text-gray-200 mb-2">Min Score</label>
                    <input type="number" id="scoreMin" min="0" max="100" value="0" class="w-24 p-2 bg-gray-600 text-gray-100 rounded-lg border border-gray-500">
                </div>
                <div>
                    <label for="scoreMax" class="block text-sm font-medium text-gray-200 mb-2">Max Score</label>
                    <input type="number" id="scoreMax" min="0" max="100" value="100" class="w-24 p-2 bg-gray-600 text-gray-100 rounded-lg border border-gray-500">
                </div>
                <div>
                    <label for="reportsMin" class="block text-sm font-medium text-gray-200 mb-2">Min Reports</label>
                    <input type="number" id="reportsMin" min="0" value="0" class="w-24 p-2 bg-gray-600 text-gray-100 rounded-lg border border-gray-500">
                </div>
                <div>
                    <label for="categoryFilter" class="block text-sm font-medium text-gray-200 mb-2">Category</label>
                    <select id="categoryFilter" class="w-48 p-2 bg-gray-600 text-gray-100 rounded-lg border border-gray-500">
                        <option value="">All Categories</option>
                    </select>
                </div>
            </div>
            <button id="applyFilters" class="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">Apply Filters</button>
        </div>

        <!-- Risk Thresholds -->
        <div class="bg-gray-700 p-6 rounded-lg shadow-lg mb-6">
            <h3 class="text-lg font-semibold text-gray-200 mb-4">Risk Thresholds</h3>
            <div class="flex gap-4">
                <div>
                    <label for="lowThreshold" class="block text-sm font-medium text-gray-200 mb-2">Low Threshold</label>
                    <input type="number" id="lowThreshold" min="0" max="100" value="25" class="w-24 p-2 bg-gray-600 text-gray-100 rounded-lg border border-gray-500">
                </div>
                <div>
                    <label for="mediumThreshold" class="block text-sm font-medium text-gray-200 mb-2">Medium Threshold</label>
                    <input type="number" id="mediumThreshold" min="0" max="100" value="75" class="w-24 p-2 bg-gray-600 text-gray-100 rounded-lg border border-gray-500">
                </div>
            </div>
        </div>

        <!-- Error Message -->
        <div id="errorMessage" class="hidden bg-red-700 text-red-100 p-4 rounded-lg mb-6"></div>

        <!-- Internal IPs Message -->
        <div id="internalIpsMessage" class="hidden bg-yellow-600 text-yellow-100 p-4 rounded-lg mb-6"></div>

        <!-- Progress Indicator -->
        <div id="progress" class="text-center text-blue-300 mb-6 hidden">
            <svg class="animate-spin inline-block h-6 w-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Analyzing your IPs, please wait...
        </div>

        <!-- API Stats -->
        <div id="apiStats" class="bg-gray-700 p-6 rounded-lg shadow-lg mb-8 hidden">
            <h3 class="text-lg font-semibold text-gray-200 mb-4">API Usage Statistics</h3>
            <div id="statsList"></div>
        </div>

        <!-- Analytics and Map Container -->
        <div id="analyticsMapContainer" class="flex flex-col lg:flex-row gap-4 mb-6 hidden">
            <!-- Analytics Dashboard -->
            <div id="analyticsDashboard" class="bg-gray-700 p-4 rounded-lg shadow-lg flex-1">
                <h3 class="text-lg font-semibold text-gray-200 mb-4">Analytics Dashboard</h3>
                <div class="grid grid-cols-1 gap-4">
                    <div>
                        <h4 class="text-sm font-medium text-gray-200 mb-2">Abuse Categories</h4>
                        <canvas id="categoryChart" height="150"></canvas>
                        <p id="categoryChartPlaceholder" class="text-gray-400 text-center hidden">No categories to display</p>
                    </div>
                    <div>
                        <h4 class="text-sm font-medium text-gray-200 mb-2">Score Distribution</h4>
                        <canvas id="scoreChart" height="150"></canvas>
                    </div>
                    <div>
                        <h4 class="text-sm font-medium text-gray-200 mb-2">Country Distribution</h4>
                        <canvas id="countryChart" height="150"></canvas>
                    </div>
                </div>
            </div>

            <!-- Geolocation Map -->
            <div id="mapContainer" class="bg-gray-700 p-4 rounded-lg shadow-lg flex-1">
                <h3 class="text-lg font-semibold text-gray-200 mb-4">IP Geolocation Map</h3>
                <div id="map" style="height: 300px;"></div>
                <p id="mapError" class="text-red-400 text-sm mt-2 hidden">Some IPs could not be geolocated</p>
            </div>
        </div>

        <!-- Column Selection -->
        <div class="bg-gray-700 p-6 rounded-lg shadow-lg mb-6">
            <h3 class="text-lg font-semibold text-gray-200 mb-4">Select Columns to Display</h3>
            <div id="columnToggles" class="flex flex-wrap gap-4">
                <label class="flex items-center"><input type="checkbox" value="input" checked class="mr-2"> Input</label>
                <label class="flex items-center"><input type="checkbox" value="isp" checked class="mr-2"> ISP</label>
                <label class="flex items-center"><input type="checkbox" value="reports" checked class="mr-2"> Reports</label>
                <label class="flex items-center"><input type="checkbox" value="score" checked class="mr-2"> Score</label>
                <label class="flex items-center"><input type="checkbox" value="domain" checked class="mr-2"> Domain</label>
                <label class="flex items-center"><input type="checkbox" value="country" checked class="mr-2"> Country</label>
                <label class="flex items-center"><input type="checkbox" value="categories" checked class="mr-2"> Categories</label>
            </div>
        </div>

        <!-- Filter by ISP -->
        <div id="ispFilterContainer" class="mb-6 hidden">
            <label for="ispFilter" class="block text-sm font-medium text-gray-200 mb-2">Filter by ISP</label>
            <select id="ispFilter" class="w-full p-4 bg-gray-600 text-gray-100 rounded-lg border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">All ISPs</option>
            </select>
        </div>

        <!-- Bulk Action Buttons -->
        <div id="bulkActionContainer" class="mt-6 flex space-x-4 hidden">
            <button id="bulkRemoveISPBtn" class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-200">Remove IPs by ISP</button>
            <button id="bulkRemoveCountryBtn" class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-200">Remove IPs by Country</button>
            <button id="reportSelectedBtn" class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-200">Report Selected</button>
            <select id="exportFormat" class="p-2 bg-gray-600 text-gray-100 rounded-lg border border-gray-500">
                <option value="txt">Export to TXT</option>
                <option value="csv">Export to CSV</option>
                <option value="json">Export to JSON</option>
            </select>
            <button id="exportBtn" class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">Export</button>
        </div>

        <!-- Results Table -->
        <div class="overflow-x-auto mt-6">
            <table id="resultTable" class="w-full bg-gray-700 rounded-xl shadow-lg hidden" data-sort-column="0" data-sort-dir="asc">
                <thead>
                    <tr class="bg-gray-600 text-gray-200">
                        <th class="p-4 text-left column-row rounded-tl-xl" title="Row Number">Row</th>
                        <th class="p-4 text-left column-select" title="Select for Export"><input type="checkbox" id="selectAll" title="Select All Rows"></th>
                        <th class="p-4 text-left cursor-pointer column-input" onclick="sortTable(1)" title="Sort by IP/Hostname">Input</th>
                        <th class="p-4 text-left cursor-pointer column-isp" onclick="sortTable(2)" title="Sort by ISP">ISP</th>
                        <th class="p-4 text-left cursor-pointer column-reports" onclick="sortTable(3)" title="Sort by Number of Reports">Reports</th>
                        <th class="p-4 text-left cursor-pointer column-score" onclick="sortTable(4)" title="Sort by Abuse Confidence Score">Score</th>
                        <th class="p-4 text-left cursor-pointer column-domain" onclick="sortTable(5)" title="Sort by Domain">Domain</th>
                        <th class="p-4 text-left cursor-pointer column-country" onclick="sortTable(6)" title="Sort by Country">Country</th>
                        <th class="p-4 text-left cursor-pointer column-categories" onclick="sortTable(7)" title="Sort by First Category">Categories</th>
                        <th class="p-4 text-left column-actions rounded-tr-xl" title="Remove Individual IPs">Actions</th>
                    </tr>
                </thead>
                <tbody id="tableBody"></tbody>
            </table>
        </div>

        <!-- ISP Removal Modal -->
        <div id="bulkRemoveISPModal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden">
            <div class="bg-gray-700 p-6 rounded-lg shadow-lg max-w-md w-full">
                <h3 class="text-lg font-semibold text-gray-200 mb-4">Remove IPs by ISP</h3>
                <select id="ispSelect" class="w-full p-4 bg-gray-600 text-gray-100 rounded-lg border border-gray-500 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Select an ISP</option>
                </select>
                <div class="flex justify-end space-x-4">
                    <button id="cancelBulkRemoveISP" class="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">Cancel</button>
                    <button id="removeSelectedISP" class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">Remove Selected</button>
                </div>
            </div>
        </div>

        <!-- Country Removal Modal -->
        <div id="bulkRemoveCountryModal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden">
            <div class="bg-gray-700 p-6 rounded-lg shadow-lg max-w-md w-full">
                <h3 class="text-lg font-semibold text-gray-200 mb-4">Remove IPs by Country</h3>
                <select id="countrySelect" class="w-full p-4 bg-gray-600 text-gray-100 rounded-lg border border-gray-500 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Select a Country</option>
                </select>
                <div class="flex justify-end space-x-4">
                    <button id="cancelBulkRemoveCountry" class="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">Cancel</button>
                    <button id="confirmBulkRemoveCountry" class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">Remove</button>
                </div>
            </div>
        </div>

        <!-- Report Modal -->
        <div id="reportModal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden">
            <div class="bg-gray-700 p-6 rounded-lg shadow-lg max-w-md w-full">
                <h3 class="text-lg font-semibold text-gray-200 mb-4">Report Selected IPs</h3>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-200 mb-2">Categories</label>
                    <select id="reportCategories" multiple class="w-full p-4 bg-gray-600 text-gray-100 rounded-lg border border-gray-500">
                        <option value="3">Fraud Orders</option>
                        <option value="4">DDoS Attack</option>
                        <option value="9">FTP Brute-Force</option>
                        <option value="11">Email Spam</option>
                        <option value="14">Port Scan</option>
                        <option value="18">Brute-Force</option>
                        <option value="21">SSH</option>
                        <option value="22">IoT Targeted</option>
                    </select>
                </div>
                <div class="mb-4">
                    <label for="reportComment" class="block text-sm font-medium text-gray-200 mb-2">Comment</label>
                    <textarea id="reportComment" class="w-full p-4 bg-gray-600 text-gray-100 rounded-lg border border-gray-500" placeholder="Optional comment"></textarea>
                </div>
                <div class="flex justify-end space-x-4">
                    <button id="cancelReport" class="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">Cancel</button>
                    <button id="confirmReport" class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">Report</button>
                </div>
            </div>
        </div>
        <!-- Export Selection Modal -->
<div id="exportSelectionModal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden">
    <div class="bg-gray-700 p-6 rounded-lg shadow-lg max-w-md w-full">
        <h3 class="text-lg font-semibold text-gray-200 mb-4">Export Selected IPs</h3>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-200 mb-2">Selected IPs</label>
            <ul id="selectedIpsList" class="max-h-32 overflow-y-auto bg-gray-600 p-2 rounded-lg text-gray-100"></ul>
        </div>
        <div class="mb-4">
            <label for="exportFormatModal" class="block text-sm font-medium text-gray-200 mb-2">Export Format</label>
            <select id="exportFormatModal" class="w-full p-2 bg-gray-600 text-gray-100 rounded-lg border border-gray-500">
                <option value="txt">TXT</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
            </select>
        </div>
        <div class="mb-4">
            <label class="flex items-center">
                <input type="checkbox" id="includeTimestamp" checked class="mr-2">
                <span class="text-sm text-gray-200">Include Timestamp</span>
            </label>
        </div>
        <div class="flex justify-end space-x-4">
            <button id="cancelExportSelection" class="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">Cancel</button>
            <button id="confirmExportSelection" class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">Export</button>
        </div>
    </div>
</div>
    </div>

   <script src="scripts.js"></script>
</body>
</html>