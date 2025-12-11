<?php
require_once __DIR__ . '/../../config.php';

if (!isset($_SESSION['user_id'])) {
    die('Unauthorized access');
}

header('Content-Type: application/json');

$conn = getDBConnection();
if (!$conn) {
    die(json_encode(['error' => 'Connection failed']));
}

$query = "
    SELECT 
        fq.id,
        fq.title,
        fq.module_id,
        m.title as module_title,
        COUNT(qq.id) as question_count,
        fq.created_at
    FROM final_quizzes fq
    JOIN modules m ON fq.module_id = m.id
    LEFT JOIN final_quiz_questions qq ON fq.id = qq.quiz_id
    GROUP BY fq.id
    ORDER BY fq.created_at DESC
";

$result = $conn->query($query);
$quizzes = [];

while ($row = $result->fetch_assoc()) {
    $quizzes[] = $row;
}

echo json_encode($quizzes);