<?php
/**
 * Health Check Endpoint for Railway/Cloud Deployments
 */

header('Content-Type: application/json');

// Check database connection
require_once 'config.php';

$health = [
    'status' => 'healthy',
    'timestamp' => date('Y-m-d H:i:s'),
    'checks' => []
];

// Test database connection
try {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
    
    if ($conn->connect_error) {
        $health['status'] = 'unhealthy';
        $health['checks']['database'] = 'failed: ' . $conn->connect_error;
        http_response_code(503);
    } else {
        $health['checks']['database'] = 'connected';
        $conn->close();
    }
} catch (Exception $e) {
    $health['status'] = 'unhealthy';
    $health['checks']['database'] = 'error: ' . $e->getMessage();
    http_response_code(503);
}

// Check if uploads directory is writable
$health['checks']['uploads'] = is_writable(__DIR__ . '/uploads') ? 'writable' : 'read-only';

echo json_encode($health, JSON_PRETTY_PRINT);
exit();
