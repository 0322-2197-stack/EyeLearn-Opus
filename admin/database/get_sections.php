<?php
// admin/database/get_sections.php - Get all unique sections from students
require_once __DIR__ . '/../../config.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Database connection
$conn = getDBConnection();
if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

try {
    // Check if section column exists
    $hasSection = false;
    $columnsResult = $conn->query("SHOW COLUMNS FROM users LIKE 'section'");
    if ($columnsResult && $columnsResult->num_rows > 0) {
        $hasSection = true;
    }
    
    $sections = [];
    
    if ($hasSection) {
        // Get all unique sections from users table where role is student
        $query = "SELECT DISTINCT section 
                  FROM users 
                  WHERE role = 'student' AND section IS NOT NULL AND section != '' 
                  ORDER BY section ASC";
        
        $result = $conn->query($query);
        
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                $sections[] = $row['section'];
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'sections' => $sections,
        'has_section_column' => $hasSection
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}

$conn->close();
?>

