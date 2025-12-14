<?php
/**
 * Simple test endpoint - no database required
 */
header('Content-Type: application/json');

$response = [
    'status' => 'ok',
    'server' => 'PHP ' . PHP_VERSION,
    'time' => date('Y-m-d H:i:s'),
    'environment' => [
        'RAILWAY_ENVIRONMENT' => getenv('RAILWAY_ENVIRONMENT') ?: 'not set',
        'PORT' => getenv('PORT') ?: 'not set',
        'DB_HOST' => getenv('MYSQL_URL') ? 'MYSQL_URL is set' : 'MYSQL_URL not set'
    ]
];

echo json_encode($response, JSON_PRETTY_PRINT);
