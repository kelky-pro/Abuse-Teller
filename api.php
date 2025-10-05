<?php
// Configuration and Initialization
ini_set('display_errors', 1);
ini_set('error_log', 'php_errors.log');
ini_set('max_execution_time', 600);
ini_set('memory_limit', '512M');
error_reporting(E_ALL);

// multiple API Keys for load balancing and fast searching
$defaultApiKeys = [
    'key1here',
    'key2here',
    'key3here',
    'key4here'
];

// Process POST Request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Read raw input and decode JSON
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        // Fall back to $_POST for legacy support (file uploads or form data)
        if ($input === null) {
            $input = $_POST;
        }

        $action = $input['action'] ?? null;

        if ($action === 'report') {
            // Handle batch reporting
            $ips = $input['ips'] ?? [];
            $categories = $input['categories'] ?? [];
            $comment = $input['comment'] ?? '';

            if (!is_array($ips)) {
                throw new Exception('Invalid IPs format.');
            }
            if (!is_array($categories)) {
                throw new Exception('Invalid categories format.');
            }

            $apiKey = $defaultApiKeys[array_rand($defaultApiKeys)];
            $results = [];

            // Join categories into comma-separated string as AbuseIPDB expects
            $categoriesStr = implode(',', $categories);

            foreach ($ips as $ip) {
                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL => "https://api.abuseipdb.com/api/v2/report",
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => http_build_query([
                        'ip' => $ip,
                        'categories' => $categoriesStr,
                        'comment' => $comment
                    ]),
                    CURLOPT_HTTPHEADER => [
                        "Key: $apiKey",
                        "Accept: application/json"
                    ],
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 30
                ]);
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $error = curl_error($ch);
                curl_close($ch);

                if ($httpCode !== 200) {
                    error_log("Report failed for IP $ip: HTTP $httpCode, cURL error: $error");
                    $results[] = ['ip' => $ip, 'status' => 'failed', 'error' => "HTTP $httpCode: $error"];
                } else {
                    $results[] = ['ip' => $ip, 'status' => 'success'];
                }
            }

            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode(['results' => $results]);
            exit;
        }

        // Handle IP checking

        // API keys
        $apiKeys = $defaultApiKeys;
        if (empty($apiKeys)) {
            throw new Exception('No API keys configured.');
        }

        // Support file upload for legacy or form data requests
        $ips = [];
        if (isset($_FILES['ipfile']['tmp_name']) && is_uploaded_file($_FILES['ipfile']['tmp_name'])) {
            if ($_FILES['ipfile']['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('File upload error: ' . $_FILES['ipfile']['error']);
            }
            $fileContent = file_get_contents($_FILES['ipfile']['tmp_name']);
            $ips = array_filter(array_map('trim', explode("\n", $fileContent)));
        } elseif (!empty($input['ips']) && is_array($input['ips'])) {
            // IPs passed as array in JSON
            $ips = array_filter(array_map('trim', $input['ips']));
        } elseif (!empty($input['ips']) && is_string($input['ips'])) {
            // IPs passed as newline-separated string
            $ips = array_filter(array_map('trim', explode("\n", $input['ips'])));
        }

        if (empty($ips)) {
            throw new Exception('No valid IPs provided.');
        }

        // Validate and Resolve IPs
        $validIps = [];
        $internalIps = [];
        $hostnameCache = [];
        foreach ($ips as $inputVal) {
            // Validate IP
            if (preg_match('/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/', $inputVal)) {
                if (filter_var($inputVal, FILTER_VALIDATE_IP)) {
                    if (filter_var($inputVal, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                        $validIps[] = $inputVal;
                    } else {
                        $internalIps[] = $inputVal;
                    }
                } else {
                    error_log("Invalid IP format: $inputVal");
                }
            }
            // Validate Hostname
            elseif (preg_match('/^(?:www\.)?[\w.-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}$/', $inputVal)) {
                $cacheKey = strtolower($inputVal);
                if (!isset($hostnameCache[$cacheKey])) {
                    $ip = gethostbyname($inputVal);
                    $hostnameCache[$cacheKey] = $ip;
                } else {
                    $ip = $hostnameCache[$cacheKey];
                }
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                        $validIps[] = $ip;
                    } else {
                        $internalIps[] = "$inputVal ($ip)";
                    }
                } else {
                    error_log("Hostname $inputVal resolved to invalid IP: $ip");
                }
            } else {
                error_log("Invalid input format: $inputVal");
            }
        }

        $results = [];
        $apiStats = [];

        if (empty($validIps)) {
            throw new Exception('No valid public IPs found.');
        }

        // Initialize cURL Multi-Handle
        $multiHandle = curl_multi_init();
        $batchSize = 200;
        $validIps = array_unique($validIps);
        $batches = array_chunk($validIps, $batchSize);

        foreach ($batches as $batch) {
            $batchHandles = [];
            foreach ($batch as $i => $ip) {
                $apiKey = $apiKeys[$i % count($apiKeys)];
                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL => "https://api.abuseipdb.com/api/v2/check?ipAddress=" . urlencode($ip) . "&maxAgeInDays=90&verbose",
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => [
                        "Key: $apiKey",
                        "Accept: application/json"
                    ],
                    CURLOPT_HEADER => true,
                    CURLOPT_TIMEOUT => 30,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_TCP_FASTOPEN => true,
                ]);
                $batchHandles[] = ['ch' => $ch, 'ip' => $ip, 'apiKey' => $apiKey];
                curl_multi_add_handle($multiHandle, $ch);
            }

            // Execute cURL Requests
            do {
                $status = curl_multi_exec($multiHandle, $active);
                if ($status !== CURLM_OK) {
                    throw new Exception('cURL multi-exec error: ' . $status);
                }
                curl_multi_select($multiHandle);
            } while ($active);

            // Process Responses
            foreach ($batchHandles as $h) {
                $raw = curl_multi_getcontent($h['ch']);
                $headerSize = curl_getinfo($h['ch'], CURLINFO_HEADER_SIZE);
                $httpCode = curl_getinfo($h['ch'], CURLINFO_HTTP_CODE);
                $error = curl_error($h['ch']);
                $header = substr($raw, 0, $headerSize);
                $body = substr($raw, $headerSize);
                curl_multi_remove_handle($multiHandle, $h['ch']);
                curl_close($h['ch']);

                if ($httpCode !== 200) {
                    error_log("API request failed for IP {$h['ip']}: HTTP $httpCode, cURL error: $error");
                    $results[] = [
                        'input' => $h['ip'],
                        'isp' => 'N/A',
                        'reports' => 0,
                        'score' => 0,
                        'domain' => 'N/A',
                        'country' => 'N/A',
                        'categories' => ['Error'],
                        'error' => "HTTP $httpCode: $error"
                    ];
                    continue;
                }

                $response = json_decode($body, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    error_log("JSON decode error for IP {$h['ip']}: " . json_last_error_msg());
                    $results[] = [
                        'input' => $h['ip'],
                        'isp' => 'N/A',
                        'reports' => 0,
                        'score' => 0,
                        'domain' => 'N/A',
                        'country' => 'N/A',
                        'categories' => ['Error'],
                        'error' => 'JSON decode error'
                    ];
                    continue;
                }

                // Extract Rate Limit Headers
                preg_match_all('/^X-RateLimit-(\w+):\s*(\d+)/mi', $header, $matches);
                $headersAssoc = array_combine(array_map('strtolower', $matches[1]), $matches[2]);

                $suffix = substr($h['apiKey'], -4);
                if (!isset($apiStats[$suffix])) {
                    $apiStats[$suffix] = [
                        'remaining' => $headersAssoc['remaining'] ?? '?',
                        'resets' => $headersAssoc['reset'] ?? time()
                    ];
                }

                // Extract categories
                $categories = [];
                if (isset($response['data']['reports']) && is_array($response['data']['reports'])) {
                    foreach ($response['data']['reports'] as $report) {
                        if (isset($report['categories']) && is_array($report['categories'])) {
                            $categories = array_merge($categories, $report['categories']);
                        }
                    }
                    $categories = array_unique($categories);
                    $categoryNames = array_map(function($id) {
                        $categoryMap = [
                            3 => 'Fraud Orders',
                            4 => 'DDoS Attack',
                            9 => 'FTP Brute-Force',
                            11 => 'Email Spam',
                            14 => 'Port Scan',
                            18 => 'Brute-Force',
                            21 => 'SSH',
                            22 => 'IoT Targeted',
                        ];
                        return $categoryMap[$id] ?? "Category $id";
                    }, $categories);
                } else {
                    $categoryNames = ['None'];
                }

                $results[] = [
                    'input' => $h['ip'],
                    'isp' => $response['data']['isp'] ?? 'Unknown',
                    'reports' => $response['data']['totalReports'] ?? 0,
                    'score' => $response['data']['abuseConfidenceScore'] ?? 0,
                    'domain' => $response['data']['domain'] ?? 'N/A',
                    'country' => $response['data']['countryCode'] ?? 'N/A',
                    'categories' => $categoryNames
                ];
            }
        }

        curl_multi_close($multiHandle);

        // Output JSON Response
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['results' => $results, 'stats' => $apiStats, 'internalIps' => $internalIps], JSON_PRETTY_PRINT);
        exit;
    } catch (Exception $e) {
        http_response_code(400);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['error' => $e->getMessage(), 'internalIps' => $internalIps ?? []]);
        exit;
    }
}
?>
