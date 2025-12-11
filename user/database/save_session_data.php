<?php
header('Content-Type: application/json');
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'User not authenticated']);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Database connection - Railway compatible with environment variables
$db_host = getenv('MYSQL_HOST') ?: getenv('DB_HOST') ?: 'localhost';
$db_user = getenv('MYSQL_USER') ?: getenv('DB_USER') ?: 'root';
$db_pass = getenv('MYSQL_PASSWORD') ?: getenv('DB_PASS') ?: '';
$db_name = getenv('MYSQL_DATABASE') ?: getenv('DB_NAME') ?: 'elearn_db';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit();
}
$conn->set_charset("utf8mb4");

$user_id = $_SESSION['user_id'];

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON input']);
    exit();
}

try {
    $module_id = $input['module_id'] ?? null;
    $section_id = $input['section_id'] ?? null;
    $session_time = $input['session_time'] ?? 0;
    $focus_data = $input['focus_data'] ?? [];
    
    // Extract focus data
    $focused_time = intval($focus_data['focused_time'] ?? 0);
    $unfocused_time = intval($focus_data['unfocused_time'] ?? 0);
    $focus_percentage = floatval($focus_data['focus_percentage'] ?? 0);

    if (!$module_id) {
        throw new Exception('Module ID is required');
    }

    // Insert or update session data with focus tracking
    $session_sql = "
        INSERT INTO eye_tracking_sessions 
        (user_id, module_id, section_id, total_time_seconds, focused_time_seconds, unfocused_time_seconds, session_type, created_at, last_updated) 
        VALUES (?, ?, ?, ?, ?, ?, 'viewing', NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
        total_time_seconds = VALUES(total_time_seconds),
        focused_time_seconds = VALUES(focused_time_seconds),
        unfocused_time_seconds = VALUES(unfocused_time_seconds),
        last_updated = NOW()
    ";

    $stmt = $conn->prepare($session_sql);
    $stmt->bind_param('iiiiii', $user_id, $module_id, $section_id, $session_time, $focused_time, $unfocused_time);
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to save session data: ' . $stmt->error);
    }

    // Save to eye_tracking_analytics with focus data
    if (!empty($focus_data)) {
        $analytics_sql = "
            INSERT INTO eye_tracking_analytics 
            (user_id, module_id, section_id, date, total_focus_time, total_focused_time, total_unfocused_time, focus_percentage, session_count, average_session_time, max_continuous_time, created_at, updated_at) 
            VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, 1, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
            total_focus_time = total_focus_time + VALUES(total_focus_time),
            total_focused_time = total_focused_time + VALUES(total_focused_time),
            total_unfocused_time = total_unfocused_time + VALUES(total_unfocused_time),
            focus_percentage = (total_focused_time / GREATEST(total_focused_time + total_unfocused_time, 1)) * 100,
            session_count = session_count + 1,
            average_session_time = (average_session_time + VALUES(average_session_time)) / 2,
            max_continuous_time = GREATEST(max_continuous_time, VALUES(max_continuous_time)),
            updated_at = NOW()
        ";

        $stmt = $conn->prepare($analytics_sql);
        $stmt->bind_param('iiiiiidii', 
            $user_id, 
            $module_id, 
            $section_id, 
            $focused_time,      // total_focus_time
            $focused_time,      // total_focused_time
            $unfocused_time,    // total_unfocused_time
            $focus_percentage,  // focus_percentage
            $session_time,      // average_session_time
            $session_time       // max_continuous_time
        );
        
        $stmt->execute(); // Don't fail if analytics insert fails
    }
    
    // Update daily_analytics table for dashboard
    $daily_sql = "
        INSERT INTO daily_analytics 
        (user_id, date, total_study_time_seconds, total_focused_time_seconds, total_unfocused_time_seconds, session_count, average_focus_percentage, longest_session_seconds, modules_studied, created_at, updated_at) 
        VALUES (?, CURDATE(), ?, ?, ?, 1, ?, ?, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
        total_study_time_seconds = total_study_time_seconds + VALUES(total_study_time_seconds),
        total_focused_time_seconds = total_focused_time_seconds + VALUES(total_focused_time_seconds),
        total_unfocused_time_seconds = total_unfocused_time_seconds + VALUES(total_unfocused_time_seconds),
        session_count = session_count + 1,
        average_focus_percentage = (total_focused_time_seconds / GREATEST(total_focused_time_seconds + total_unfocused_time_seconds, 1)) * 100,
        longest_session_seconds = GREATEST(longest_session_seconds, VALUES(longest_session_seconds)),
        updated_at = NOW()
    ";

    $stmt = $conn->prepare($daily_sql);
    $stmt->bind_param('iiiiidi', 
        $user_id, 
        $session_time,      // total_study_time_seconds
        $focused_time,      // total_focused_time_seconds
        $unfocused_time,    // total_unfocused_time_seconds
        $focus_percentage,  // average_focus_percentage
        $session_time       // longest_session_seconds
    );
    $stmt->execute(); // Don't fail if daily analytics insert fails
    
    // Update user_progress if module_id provided
    if ($module_id) {
        $completion_percentage = isset($input['completion_percentage'])
            ? floatval($input['completion_percentage'])
            : 0;

        $progress_sql = "
            INSERT INTO user_progress 
            (user_id, module_id, completion_percentage, last_accessed)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                completion_percentage = GREATEST(completion_percentage, VALUES(completion_percentage)),
                last_accessed = NOW()
        ";

        $stmt = $conn->prepare($progress_sql);
        $stmt->bind_param('iid', $user_id, $module_id, $completion_percentage);
        $stmt->execute();
    }

    echo json_encode([
        'success' => true,
        'message' => 'Session data saved successfully',
        'data' => [
            'session_time' => $session_time,
            'focused_time' => $focused_time,
            'unfocused_time' => $unfocused_time,
            'focus_percentage' => $focus_percentage
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save session data: ' . $e->getMessage()]);
}

$conn->close();
?>
