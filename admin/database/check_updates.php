<?php
require_once __DIR__ . '/../../config.php';
header('Content-Type: application/json');

// Database connection
$conn = getDBConnection();
if (!$conn) {
    die(json_encode(['error' => "Connection failed"]));
}

// Get the most recent timestamp from key tables
// Check each table individually to handle missing tables gracefully
$timestamps = [];

// Check users table
$result = $conn->query("SELECT MAX(created_at) as max_time FROM users");
if ($result && $row = $result->fetch_assoc()) {
    if ($row['max_time']) $timestamps[] = $row['max_time'];
}

// Check user_progress table
$result = $conn->query("SELECT MAX(updated_at) as max_time FROM user_progress");
if ($result && $row = $result->fetch_assoc()) {
    if ($row['max_time']) $timestamps[] = $row['max_time'];
}

// Check quiz_results table
$result = $conn->query("SELECT MAX(created_at) as max_time FROM quiz_results");
if ($result && $row = $result->fetch_assoc()) {
    if ($row['max_time']) $timestamps[] = $row['max_time'];
}

// Check eye_tracking_sessions table
$result = $conn->query("SELECT MAX(session_end_time) as max_time FROM eye_tracking_sessions");
if ($result && $row = $result->fetch_assoc()) {
    if ($row['max_time']) $timestamps[] = $row['max_time'];
}

// Also check checkpoint_quiz_results table
$result = $conn->query("SELECT MAX(completion_date) as max_time FROM checkpoint_quiz_results");
if ($result && $row = $result->fetch_assoc()) {
    if ($row['max_time']) $timestamps[] = $row['max_time'];
}

// Get the latest timestamp
if (!empty($timestamps)) {
    $latestTimestamp = max($timestamps);
    echo json_encode(['last_update' => $latestTimestamp]);
} else {
    // If no timestamps found, return current timestamp
    echo json_encode(['last_update' => date('Y-m-d H:i:s')]);
}

$conn->close();
?>

