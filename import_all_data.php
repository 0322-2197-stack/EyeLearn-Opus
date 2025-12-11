<?php
/**
 * Complete Data Import Script for Railway
 * Imports ALL users and their related data from local database
 * Run once, then DELETE this file!
 */

require_once 'config.php';

// Security check
if (!isset($_GET['confirm']) || $_GET['confirm'] !== 'import_all_data_2025') {
    die('Access denied. Add ?confirm=import_all_data_2025 to URL');
}

header('Content-Type: text/plain');
echo "=== Complete Data Import for Railway ===\n\n";

$conn = getDBConnection();

// First, let's drop and recreate the users table to match exactly
echo "=== Dropping and recreating users table ===\n";
$conn->query("DROP TABLE IF EXISTS `camera_agreements`");
$conn->query("DROP TABLE IF EXISTS `user_study_sessions`");
$conn->query("DROP TABLE IF EXISTS `user_sessions`");
$conn->query("DROP TABLE IF EXISTS `user_progress`");
$conn->query("DROP TABLE IF EXISTS `user_module_progress`");
$conn->query("DROP TABLE IF EXISTS `quiz_results`");
$conn->query("DROP TABLE IF EXISTS `retake_results`");
$conn->query("DROP TABLE IF EXISTS `ai_recommendations`");
$conn->query("DROP TABLE IF EXISTS `eye_tracking_data`");
$conn->query("SET FOREIGN_KEY_CHECKS = 0");
$conn->query("DROP TABLE IF EXISTS `users`");

// Create users table with exact structure
$sql = "CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `gender` enum('Male','Female','Other') NOT NULL,
  `section` varchar(50) DEFAULT NULL,
  `role` enum('admin','student') NOT NULL,
  `profile_img` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `camera_agreement_accepted` tinyint(1) DEFAULT 0,
  `camera_agreement_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";
if ($conn->query($sql)) echo "✓ Created users table\n";
else echo "✗ Users table: " . $conn->error . "\n";

// Insert ALL users
echo "\n=== Inserting ALL users ===\n";
$users_sql = "INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password`, `gender`, `section`, `role`, `profile_img`, `created_at`, `updated_at`, `camera_agreement_accepted`, `camera_agreement_date`) VALUES
(1, 'Super', 'Admin', 'admin@admin.eyelearn', '\$2y\$10\$5eql26ue0JmbvS6AAIQr/.pL8njF47sQ/.lDScg9/Gb..M.iZG1Ty', 'Other', NULL, 'admin', 'default.png', '2025-04-21 15:01:17', '2025-04-21 16:07:51', 0, NULL),
(31, 'Mark Aljerick', 'De Castro', '0322-2068@lspu.edu.ph', '\$2y\$10\$7O.GmiH3CE9/4Rb9qOKtcutk7FWSfyTOq9X03r5sOb24Q2ltz86qW', 'Male', 'BSINFO-1A', 'student', NULL, '2025-11-23 14:28:37', '2025-11-29 08:39:58', 1, '2025-11-29 16:39:58'),
(32, 'Vonn Annilov', 'Cabajes', '0322-2197@lspu.edu.ph', '\$2y\$10\$pNlcZOVSctPbzmIudYe3geVGl1aK7CcYGBVnAcFkdsWHXmCus4td2', 'Female', 'BSINFO-1A', 'student', NULL, '2025-11-24 06:22:55', '2025-12-11 08:42:27', 1, '2025-12-11 16:42:27'),
(33, 'Ian Theodore', 'Maloles', '0322-1939@lspu.edu.ph', '\$2y\$10\$ceBm3nPEKL65KLZMVSLTiux.5ghOtDsMT3prXYqSzxxBxX2qCOkU6', 'Male', 'BSINFO-1C', 'student', NULL, '2025-11-27 17:59:10', '2025-12-01 03:51:34', 1, '2025-12-01 11:51:34'),
(34, 'Justine', 'Baroro', '0325-1179@lspu.edu.ph', '\$2y\$10\$IfJqsNE86UHMOziC.3zDSeWrTPf0UWgxIfpSCbZcCM4GJM6oz74/i', 'Male', 'BSINFO-1C', 'student', NULL, '2025-12-01 04:11:09', '2025-12-01 04:12:19', 1, '2025-12-01 12:12:19'),
(35, 'matthew', 'manalang', '0325-1232@lspu.edu.ph', '\$2y\$10\$53PZtgQBCBPt/JYbX81BqOYaGdW7AKbVFDu1sZD9YdD23h8ETQl2e', 'Male', 'BSINFO-1B', 'student', NULL, '2025-12-01 04:14:34', '2025-12-01 04:15:05', 1, '2025-12-01 12:15:05'),
(36, 'Althea Uamie', 'Valenzuela', '0325-1274@lspu.edu.ph', '\$2y\$10\$m5f2DQRjmOSaFc6CLD36u.xgmBXYhwY9NzFgcw1LsF01uj43GhkmO', 'Female', 'BSINFO-1B', 'student', NULL, '2025-12-01 04:19:17', '2025-12-01 04:19:55', 1, '2025-12-01 12:19:55'),
(37, 'Dave Lorenz', 'Ignacio', '0325-1223@lspu.edu.ph', '\$2y\$10\$SXebuONMvAifRBX.yFMIQuCa4mJV/lfJfza5MJlnC.fghtWwff.oq', 'Male', 'BSINFO-1B', 'student', NULL, '2025-12-01 04:27:17', '2025-12-01 04:28:08', 1, '2025-12-01 12:28:08'),
(38, 'Nash Marco', 'Devanadera', '0325-1204@lspu.edu.ph', '\$2y\$10\$egXq7tuj32LB2ekVPyymUu2f68ZDs./KYq7m7Dd6IUwbWlP5irPtm', 'Male', 'BSINFO-1B', 'student', NULL, '2025-12-01 04:28:25', '2025-12-01 04:29:23', 1, '2025-12-01 12:29:23'),
(39, 'Rochelle', 'Alvarez', '0325-1960@lspu.edu.ph', '\$2y\$10\$xrTXWuuJnwHyiz1cJ11TKeSrFoAvCSH9wu8.QjjiHEMMihdlWPxzC', 'Female', 'BSINFO-1A', 'student', NULL, '2025-12-01 04:45:06', '2025-12-01 04:45:31', 1, '2025-12-01 12:45:31'),
(40, 'Ryza', 'Garcia', '0325-2188@lspu.edu.ph', '\$2y\$10\$jMoKr/58j9lS4Mjia.ULjONG/SJrNo7W0wu9AhA5V3yK.VExl3fl2', 'Female', 'BSINFO-1A', 'student', NULL, '2025-12-01 04:45:33', '2025-12-01 04:45:46', 1, '2025-12-01 12:45:46'),
(41, 'Jacqueline', 'Gamido', '0325-1931@lspu.edu.ph', '\$2y\$10\$AFV/w49o8brsOyqOfMMMEObHGTrIeZ7DHVkEum17c2nLvuwJjp02K', 'Female', 'BSINFO-1A', 'student', NULL, '2025-12-01 04:56:25', '2025-12-01 04:56:47', 1, '2025-12-01 12:56:47'),
(43, 'Rochelle', 'Alvarez', '0325-1842@lspu.edu.ph', '\$2y\$10\$fb29LuNYAfZyKNfnJie8eOmR5.d7mcDC.BAkiRTFaE5h4ua.Qss2.', 'Female', 'BSINFO-1A', 'student', NULL, '2025-12-01 05:11:59', '2025-12-01 05:12:19', 1, '2025-12-01 13:12:19'),
(44, 'Psalams', 'Althea', '0325-1956@lspu.edu.ph', '\$2y\$10\$eNyJ6LX7O/e98aI.dhRPX.Q9xuzNeYQL16yDY9v8XfcxT2Ai7NsEu', 'Female', 'BSINFO-1A', 'student', NULL, '2025-12-01 05:22:20', '2025-12-01 05:23:31', 1, '2025-12-01 13:23:31'),
(46, 'Jeremiah', 'Rivera', '0322-2199@lspu.edu.ph', '\$2y\$10\$LRfRv8uLDQXCqxqsudynueDtTgOywzhkIGsGsJniAw0MuIJvbIlJS', 'Female', 'BSINFO-1A', 'student', NULL, '2025-12-01 12:55:32', '2025-12-01 13:00:47', 1, '2025-12-01 21:00:47')";
if ($conn->query($users_sql)) echo "✓ Inserted " . $conn->affected_rows . " users\n";
else echo "✗ Users insert: " . $conn->error . "\n";

// Set auto_increment
$conn->query("ALTER TABLE `users` AUTO_INCREMENT = 47");

// Recreate user_module_progress
echo "\n=== Creating user_module_progress ===\n";
$sql = "CREATE TABLE IF NOT EXISTS `user_module_progress` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `completed_sections` longtext DEFAULT NULL,
  `last_accessed` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_checkpoint_quizzes` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_module` (`user_id`,`module_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";
if ($conn->query($sql)) echo "✓ Created user_module_progress table\n";
else echo "✗ " . $conn->error . "\n";

// Insert user_module_progress data
$sql = "INSERT IGNORE INTO `user_module_progress` (`id`, `user_id`, `module_id`, `completed_sections`, `last_accessed`, `completed_checkpoint_quizzes`) VALUES
(44, 31, 22, '[\"checkpoint_1\",\"77\",\"78\",\"79\",\"80\",\"81\",\"82\",\"83\",\"84\"]', '2025-11-24 05:29:25', '[]'),
(46, 32, 22, '[77,\"78\",\"79\",\"80\",\"81\",\"82\",\"83\",\"84\",\"checkpoint_1\"]', '2025-11-24 06:25:23', '[]'),
(48, 33, 22, '[77,\"78\",\"79\",\"checkpoint_1\"]', '2025-11-27 19:34:36', '[]'),
(50, 34, 22, '[77,78,79,80,81,82,83]', '2025-12-01 04:17:38', '[]'),
(51, 35, 22, '[77,78,79,80,81,82,83]', '2025-12-01 04:18:53', '[]'),
(52, 36, 22, '[77,78,79,80,81,82,83]', '2025-12-01 04:26:20', '[]'),
(53, 37, 22, '[77,78,79,80,81,82,83]', '2025-12-01 04:30:58', '[]'),
(54, 38, 22, '[77,78,79,80,81,82,83]', '2025-12-01 04:31:12', '[]'),
(55, 39, 22, '[77,78,79,80,81,82,83]', '2025-12-01 04:48:23', '[]'),
(56, 40, 22, '[77,78,79,80,81,82,83]', '2025-12-01 04:50:49', '[]'),
(57, 41, 22, '[77,78,79,80,81,82,83]', '2025-12-01 04:57:37', '[]'),
(58, 43, 22, '[77,78,79,80,81,82,83,84]', '2025-12-01 05:36:21', '[]'),
(59, 44, 22, '[77,78,79,80,81,82,83,84]', '2025-12-01 05:40:43', '[]'),
(60, 46, 22, '[77,78,79,80,81,82,83]', '2025-12-01 12:56:03', '[]')";
if ($conn->query($sql)) echo "✓ Inserted user_module_progress data\n";
else echo "✗ " . $conn->error . "\n";

// Recreate user_progress
echo "\n=== Creating user_progress ===\n";
$sql = "CREATE TABLE IF NOT EXISTS `user_progress` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `module_id` int(11) DEFAULT NULL,
  `completion_percentage` decimal(5,2) DEFAULT 0.00,
  `last_accessed` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_module_unique` (`user_id`,`module_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";
if ($conn->query($sql)) echo "✓ Created user_progress table\n";
else echo "✗ " . $conn->error . "\n";

$sql = "INSERT IGNORE INTO `user_progress` (`id`, `user_id`, `module_id`, `completion_percentage`, `last_accessed`) VALUES
(110, 32, 22, 13.00, '2025-11-24 06:24:37'),
(111, 33, 22, 38.00, '2025-11-27 19:12:46')";
if ($conn->query($sql)) echo "✓ Inserted user_progress data\n";
else echo "✗ " . $conn->error . "\n";

// Recreate user_sessions
echo "\n=== Creating user_sessions ===\n";
$sql = "CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `module_id` int(11) DEFAULT NULL,
  `session_start` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `session_end` timestamp NULL DEFAULT NULL,
  `total_duration_seconds` int(11) DEFAULT 0,
  `focused_duration_seconds` int(11) DEFAULT 0,
  `unfocused_duration_seconds` int(11) DEFAULT 0,
  `focus_percentage` decimal(5,2) DEFAULT 0.00,
  `session_type` enum('study','quiz','review') DEFAULT 'study',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
if ($conn->query($sql)) echo "✓ Created user_sessions table\n";
else echo "✗ " . $conn->error . "\n";

// Recreate user_study_sessions
echo "\n=== Creating user_study_sessions ===\n";
$sql = "CREATE TABLE IF NOT EXISTS `user_study_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `focus_score` float NOT NULL,
  `duration` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";
if ($conn->query($sql)) echo "✓ Created user_study_sessions table\n";
else echo "✗ " . $conn->error . "\n";

// Recreate retake_results
echo "\n=== Creating retake_results ===\n";
$sql = "CREATE TABLE IF NOT EXISTS `retake_results` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `score` int(11) NOT NULL,
  `percentage` decimal(5,2) DEFAULT 0.00,
  `completion_date` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_retake_results_user` (`user_id`,`module_id`,`quiz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";
if ($conn->query($sql)) echo "✓ Created retake_results table\n";
else echo "✗ " . $conn->error . "\n";

// Recreate section_quiz_questions
echo "\n=== Creating section_quiz_questions ===\n";
$sql = "CREATE TABLE IF NOT EXISTS `section_quiz_questions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `section_id` int(11) NOT NULL,
  `question_text` text NOT NULL,
  `option1` varchar(255) NOT NULL,
  `option2` varchar(255) NOT NULL,
  `option3` varchar(255) NOT NULL,
  `option4` varchar(255) NOT NULL,
  `correct_answer` char(1) NOT NULL,
  `question_order` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `section_id` (`section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";
if ($conn->query($sql)) echo "✓ Created section_quiz_questions table\n";
else echo "✗ " . $conn->error . "\n";

// Recreate camera_agreements
echo "\n=== Creating camera_agreements ===\n";
$sql = "CREATE TABLE IF NOT EXISTS `camera_agreements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `agreed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";
if ($conn->query($sql)) echo "✓ Created camera_agreements table\n";
else echo "✗ " . $conn->error . "\n";

$conn->query("SET FOREIGN_KEY_CHECKS = 1");

// Show all tables with row counts
echo "\n=== Final Table Summary ===\n";
$result = $conn->query("SHOW TABLES");
while ($row = $result->fetch_row()) {
    $table = $row[0];
    $countResult = $conn->query("SELECT COUNT(*) as cnt FROM `$table`");
    if ($countResult) {
        $count = $countResult->fetch_assoc()['cnt'];
        echo "- $table ($count rows)\n";
    } else {
        echo "- $table (error counting)\n";
    }
}

echo "\n⚠️ DELETE THIS FILE AFTER USE!\n";
echo "Run: git rm import_all_data.php; git commit -m 'Remove import script'; git push\n";

$conn->close();
?>
