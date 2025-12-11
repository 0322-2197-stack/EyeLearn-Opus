<?php
/**
 * Fix Missing Tables Script for Railway
 * Creates missing tables and imports critical user data
 */

require_once 'config.php';

if (!isset($_GET['confirm']) || $_GET['confirm'] !== 'fix_tables_2025') {
    die('Access denied. Add ?confirm=fix_tables_2025 to the URL to proceed.');
}

$conn = getDBConnection();
if (!$conn) {
    die("Database connection failed");
}

mysqli_report(MYSQLI_REPORT_OFF);

echo "<pre>";
echo "=== Creating Missing Tables ===\n\n";

// Create users table
$sql = "CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `gender` enum('Male','Female','Other') NOT NULL,
  `section` varchar(50) DEFAULT NULL,
  `role` enum('admin','student') NOT NULL DEFAULT 'student',
  `profile_img` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `camera_agreement_accepted` tinyint(1) DEFAULT 0,
  `camera_agreement_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if ($conn->query($sql)) echo "✓ Created users table\n";
else echo "✗ users: " . $conn->error . "\n";

// Create user_module_progress table
$sql = "CREATE TABLE IF NOT EXISTS `user_module_progress` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `completed_sections` longtext DEFAULT NULL,
  `last_accessed` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_checkpoint_quizzes` longtext DEFAULT '[]',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_module_unique` (`user_id`, `module_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if ($conn->query($sql)) echo "✓ Created user_module_progress table\n";
else echo "✗ user_module_progress: " . $conn->error . "\n";

// Create user_progress table
$sql = "CREATE TABLE IF NOT EXISTS `user_progress` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `module_id` int(11) DEFAULT NULL,
  `completion_percentage` decimal(5,2) DEFAULT 0.00,
  `last_accessed` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if ($conn->query($sql)) echo "✓ Created user_progress table\n";
else echo "✗ user_progress: " . $conn->error . "\n";

// Create user_sessions table
$sql = "CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if ($conn->query($sql)) echo "✓ Created user_sessions table\n";
else echo "✗ user_sessions: " . $conn->error . "\n";

// Create user_study_sessions table
$sql = "CREATE TABLE IF NOT EXISTS `user_study_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `module_id` int(11) DEFAULT NULL,
  `section_id` int(11) DEFAULT NULL,
  `start_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `end_time` timestamp NULL DEFAULT NULL,
  `duration_seconds` int(11) DEFAULT 0,
  `focus_percentage` decimal(5,2) DEFAULT 0.00,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if ($conn->query($sql)) echo "✓ Created user_study_sessions table\n";
else echo "✗ user_study_sessions: " . $conn->error . "\n";

// Create retake_results table
$sql = "CREATE TABLE IF NOT EXISTS `retake_results` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `score` decimal(5,2) DEFAULT 0,
  `total_questions` int(11) DEFAULT 0,
  `correct_answers` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if ($conn->query($sql)) echo "✓ Created retake_results table\n";
else echo "✗ retake_results: " . $conn->error . "\n";

// Create section_quiz_questions table
$sql = "CREATE TABLE IF NOT EXISTS `section_quiz_questions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `section_id` int(11) NOT NULL,
  `question_text` text NOT NULL,
  `option1` varchar(255) DEFAULT NULL,
  `option2` varchar(255) DEFAULT NULL,
  `option3` varchar(255) DEFAULT NULL,
  `option4` varchar(255) DEFAULT NULL,
  `correct_answer` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if ($conn->query($sql)) echo "✓ Created section_quiz_questions table\n";
else echo "✗ section_quiz_questions: " . $conn->error . "\n";

// Create camera_agreements table
$sql = "CREATE TABLE IF NOT EXISTS `camera_agreements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `agreed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if ($conn->query($sql)) echo "✓ Created camera_agreements table\n";
else echo "✗ camera_agreements: " . $conn->error . "\n";

echo "\n=== Inserting Admin User ===\n";

// Insert admin user
$sql = "INSERT IGNORE INTO `users` (`id`, `first_name`, `last_name`, `email`, `password`, `gender`, `section`, `role`, `profile_img`, `created_at`, `updated_at`, `camera_agreement_accepted`, `camera_agreement_date`) VALUES
(1, 'Super', 'Admin', 'admin@admin.eyelearn', '\$2y\$10\$5eql26ue0JmbvS6AAIQr/.pL8njF47sQ/.lDScg9/Gb..M.iZG1Ty', '', NULL, 'admin', 'default.png', NOW(), NOW(), 0, NULL)";
if ($conn->query($sql)) echo "✓ Inserted admin user\n";
else echo "✗ Admin: " . $conn->error . "\n";

// Insert sample student users
$sql = "INSERT IGNORE INTO `users` (`id`, `first_name`, `last_name`, `email`, `password`, `gender`, `section`, `role`, `created_at`, `camera_agreement_accepted`) VALUES
(32, 'Vonn Annilov', 'Cabajes', '0322-2197@lspu.edu.ph', '\$2y\$10\$pNlcZOVSctPbzmIudYe3geVGl1aK7CcYGBVnAcFkdsWHXmCus4td2', 'Female', 'BSINFO-1A', 'student', NOW(), 1),
(31, 'Mark Aljerick', 'De Castro', '0322-2068@lspu.edu.ph', '\$2y\$10\$7O.GmiH3CE9/4Rb9qOKtcutk7FWSfyTOq9X03r5sOb24Q2ltz86qW', 'Male', 'BSINFO-1A', 'student', NOW(), 1),
(33, 'Ian Theodore', 'Maloles', '0322-1939@lspu.edu.ph', '\$2y\$10\$ceBm3nPEKL65KLZMVSLTiux.5ghOtDsMT3prXYqSzxxBxX2qCOkU6', 'Male', 'BSINFO-1C', 'student', NOW(), 1)";
if ($conn->query($sql)) echo "✓ Inserted student users\n";
else echo "✗ Students: " . $conn->error . "\n";

echo "\n=== Showing All Tables ===\n";
$result = $conn->query("SHOW TABLES");
if ($result) {
    while ($row = $result->fetch_array()) {
        $tableName = $row[0];
        $countResult = $conn->query("SELECT COUNT(*) as cnt FROM `$tableName`");
        if ($countResult) {
            $count = $countResult->fetch_assoc()['cnt'];
            echo "  - $tableName ($count rows)\n";
        }
    }
}

echo "\n⚠️ DELETE THIS FILE AFTER USE!\n";
echo "</pre>";
?>
