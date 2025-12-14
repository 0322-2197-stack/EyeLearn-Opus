<?php
require_once __DIR__ . '/../../config.php';
header('Content-Type: application/json');

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'User not authenticated']);
    exit();
}

$conn = getDBConnection();
if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit();
}

$user_id = $_SESSION['user_id'];

try {
    // Check if eye_tracking_sessions table exists
    $table_check = $conn->query("SHOW TABLES LIKE 'eye_tracking_sessions'");
    if (!$table_check || $table_check->num_rows === 0) {
        // Table doesn't exist - return empty data
        echo json_encode([
            'success' => true,
            'data' => [
                'overall_stats' => [
                    'modules_studied' => 0,
                    'total_study_time_hours' => 0,
                    'total_sessions' => 0,
                    'avg_session_minutes' => 0,
                    'longest_session_minutes' => 0,
                    'focus_efficiency_percent' => 0,
                    'first_session' => null,
                    'last_session' => null
                ],
                'recent_analytics' => [],
                'module_performance' => [],
                'focus_trends' => [],
                'current_session' => null,
                'insights' => [
                    'best_study_day' => null,
                    'improvement_suggestion' => 'Start studying a module to see your analytics!',
                    'streak_info' => null
                ],
                'realtime_data' => [
                    'last_updated' => date('Y-m-d H:i:s'),
                    'is_currently_studying' => false,
                    'active_module' => null
                ]
            ]
        ]);
        exit();
    }

    // Check if modules table exists
    $modules_check = $conn->query("SHOW TABLES LIKE 'modules'");
    $has_modules_table = $modules_check && $modules_check->num_rows > 0;

    // Check which columns exist in eye_tracking_sessions
    $cols_result = $conn->query("SHOW COLUMNS FROM eye_tracking_sessions");
    $existing_cols = [];
    while ($col = $cols_result->fetch_assoc()) {
        $existing_cols[] = $col['Field'];
    }
    $has_last_updated = in_array('last_updated', $existing_cols);
    $has_total_time = in_array('total_time_seconds', $existing_cols);
    
    // Use appropriate column names based on what exists
    $time_col = $has_total_time ? 'ets.total_time_seconds' : '0';
    $last_update_col = $has_last_updated ? 'MAX(ets.last_updated)' : 'MAX(ets.created_at)';

    // Get real-time overall user statistics from current sessions
    $stats_query = "
        SELECT 
            COUNT(DISTINCT COALESCE(ets.module_id, 0)) as modules_studied,
            COALESCE(SUM($time_col), 0) as total_study_time,
            COUNT(ets.id) as total_sessions,
            COALESCE(AVG($time_col), 0) as avg_session_time,
            COALESCE(MAX($time_col), 0) as longest_session,
            MIN(ets.created_at) as first_session_date,
            $last_update_col as last_session_date
        FROM eye_tracking_sessions ets 
        WHERE ets.user_id = ?
    ";
    
    $stmt = $conn->prepare($stats_query);
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $stats_result = $stmt->get_result();
    $overall_stats = $stats_result->fetch_assoc();

    // If no data exists, create default values
    if ($overall_stats['total_sessions'] == 0) {
        $overall_stats = [
            'modules_studied' => 0,
            'total_study_time' => 0,
            'total_sessions' => 0,
            'avg_session_time' => 0,
            'longest_session' => 0,
            'first_session_date' => null,
            'last_session_date' => null
        ];
    }

    // Get recent session data for trends (real sessions from database)
    $recent_sessions_query = "
        SELECT 
            DATE(ets.created_at) as session_date,
            SUM($time_col) as daily_study_time,
            COUNT(ets.id) as daily_sessions,
            AVG($time_col) as avg_session_duration,
            " . ($has_modules_table ? "m.title" : "'Module'") . " as module_title
        FROM eye_tracking_sessions ets
        " . ($has_modules_table ? "LEFT JOIN modules m ON ets.module_id = m.id" : "") . "
        WHERE ets.user_id = ?
        AND ets.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(ets.created_at)" . ($has_modules_table ? ", m.title" : "") . "
        ORDER BY session_date DESC, daily_study_time DESC
        LIMIT 30
    ";
    
    $stmt = $conn->prepare($recent_sessions_query);
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $sessions_result = $stmt->get_result();
    
    $analytics_data = [];
    while ($row = $sessions_result->fetch_assoc()) {
        $analytics_data[] = [
            'date' => $row['session_date'],
            'total_focus_time' => $row['daily_study_time'], // Using actual study time
            'session_count' => $row['daily_sessions'],
            'average_session_time' => round($row['avg_session_duration']),
            'max_continuous_time' => $row['daily_study_time'], // Simplified for now
            'module_title' => $row['module_title'] ?: 'Module Study'
        ];
    }

    // Get module-specific performance (only if modules table exists)
    $module_performance = [];
    if ($has_modules_table) {
        $module_performance_query = "
            SELECT 
                m.title as module_title,
                m.id as module_id,
                SUM($time_col) as total_time,
                COUNT(ets.id) as session_count,
                AVG($time_col) as avg_session_time,
                MAX($time_col) as best_session,
                " . ($has_last_updated ? "MAX(ets.last_updated)" : "MAX(ets.created_at)") . " as last_studied
            FROM eye_tracking_sessions ets
            JOIN modules m ON ets.module_id = m.id
            WHERE ets.user_id = ?
            GROUP BY ets.module_id, m.title, m.id
            ORDER BY total_time DESC
        ";
        
        $stmt = $conn->prepare($module_performance_query);
        $stmt->bind_param('i', $user_id);
        $stmt->execute();
        $module_result = $stmt->get_result();
        
        while ($row = $module_result->fetch_assoc()) {
            $module_performance[] = $row;
        }
    }

    // Get focus trends (last 7 days) from real session data
    $focus_trends_query = "
        SELECT 
            DATE(ets.created_at) as study_date,
            SUM($time_col) as daily_focus_time,
            COUNT(ets.id) as daily_sessions,
            AVG($time_col) as avg_session_duration
        FROM eye_tracking_sessions ets
        WHERE ets.user_id = ? 
        AND ets.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(ets.created_at)
        ORDER BY study_date ASC
    ";
    
    $stmt = $conn->prepare($focus_trends_query);
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $trends_result = $stmt->get_result();
    
    $focus_trends = [];
    while ($row = $trends_result->fetch_assoc()) {
        $focus_trends[] = $row;
    }

    // Get current active session data if available
    $last_updated_col_name = $has_last_updated ? "ets.last_updated" : "ets.created_at";
    $current_session_query = "
        SELECT 
            ets.module_id,
            " . (in_array('section_id', $existing_cols) ? "ets.section_id" : "NULL as section_id") . ",
            $time_col as total_time_seconds,
            ets.created_at,
            " . ($has_modules_table ? "m.title" : "'Module'") . " as module_title
        FROM eye_tracking_sessions ets
        " . ($has_modules_table ? "LEFT JOIN modules m ON ets.module_id = m.id" : "") . "
        WHERE ets.user_id = ?
        AND $last_updated_col_name > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ORDER BY $last_updated_col_name DESC
        LIMIT 1
    ";
    
    $stmt = $conn->prepare($current_session_query);
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $current_result = $stmt->get_result();
    $current_session = $current_result->fetch_assoc();

    // Calculate derived metrics from real data
    $total_hours = round(($overall_stats['total_study_time'] ?? 0) / 3600, 1);
    $avg_session_minutes = round(($overall_stats['avg_session_time'] ?? 0) / 60, 1);
    $longest_session_minutes = round(($overall_stats['longest_session'] ?? 0) / 60, 1);
    
    // Calculate focus efficiency from real session data (simplified calculation)
    $focus_efficiency = 0;
    if ($overall_stats['total_sessions'] > 0 && $overall_stats['avg_session_time'] > 0) {
        // Simple efficiency calculation: longer sessions indicate better focus
        // You can enhance this with actual focus/unfocus data from the CV service
        if ($avg_session_minutes >= 20) {
            $focus_efficiency = min(85 + ($avg_session_minutes - 20) * 0.5, 95);
        } else if ($avg_session_minutes >= 10) {
            $focus_efficiency = 60 + ($avg_session_minutes - 10) * 2.5;
        } else {
            $focus_efficiency = max(30, $avg_session_minutes * 6);
        }
        $focus_efficiency = round($focus_efficiency, 1);
    }

    // Prepare response with real data
    $response = [
        'success' => true,
        'data' => [
            'overall_stats' => [
                'modules_studied' => $overall_stats['modules_studied'] ?? 0,
                'total_study_time_hours' => $total_hours,
                'total_sessions' => $overall_stats['total_sessions'] ?? 0,
                'avg_session_minutes' => $avg_session_minutes,
                'longest_session_minutes' => $longest_session_minutes,
                'focus_efficiency_percent' => $focus_efficiency,
                'first_session' => $overall_stats['first_session_date'],
                'last_session' => $overall_stats['last_session_date']
            ],
            'recent_analytics' => $analytics_data,
            'module_performance' => $module_performance,
            'focus_trends' => $focus_trends,
            'current_session' => $current_session,
            'insights' => [
                'best_study_day' => null,
                'improvement_suggestion' => null,
                'streak_info' => null
            ],
            'realtime_data' => [
                'last_updated' => date('Y-m-d H:i:s'),
                'is_currently_studying' => !empty($current_session),
                'active_module' => $current_session['module_title'] ?? null
            ]
        ]
    ];

    // Calculate insights
    if (count($focus_trends) > 0) {
        // Find best study day
        $best_day = array_reduce($focus_trends, function($carry, $item) {
            return ($carry === null || $item['daily_focus_time'] > $carry['daily_focus_time']) ? $item : $carry;
        });
        $response['data']['insights']['best_study_day'] = $best_day;
        
        // Simple improvement suggestion
        if ($focus_efficiency < 60) {
            $response['data']['insights']['improvement_suggestion'] = "Try shorter, more focused study sessions to improve concentration.";
        } else if ($focus_efficiency > 80) {
            $response['data']['insights']['improvement_suggestion'] = "Excellent focus! Consider challenging yourself with more complex modules.";
        } else {
            $response['data']['insights']['improvement_suggestion'] = "Good focus levels. Regular breaks might help maintain concentration.";
        }
    }

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to fetch analytics data: ' . $e->getMessage()]);
}

$conn->close();
?>
