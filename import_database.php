<?php
/**
 * Database Import Script for Railway
 * Access this file once to import your database schema and data
 * DELETE THIS FILE AFTER USE FOR SECURITY
 */

require_once 'config.php';

// Security check - only allow if a specific parameter is passed
if (!isset($_GET['confirm']) || $_GET['confirm'] !== 'import_elearn_db_2025') {
    die('Access denied. Add ?confirm=import_elearn_db_2025 to the URL to proceed.');
}

$conn = getDBConnection();
if (!$conn) {
    die("Database connection failed");
}

echo "<pre>";
echo "=== EyeLearn Database Import ===\n\n";

// Read the SQL file
$sqlFile = __DIR__ . '/database/elearn_db (1).sql';
if (!file_exists($sqlFile)) {
    die("SQL file not found: $sqlFile");
}

$sql = file_get_contents($sqlFile);

// Disable foreign key checks
$conn->query("SET FOREIGN_KEY_CHECKS = 0");

// Split by semicolons (basic split - may need adjustment for complex queries)
$queries = array_filter(array_map('trim', explode(';', $sql)));

$success = 0;
$failed = 0;
$errors = [];

foreach ($queries as $query) {
    if (empty($query) || strpos($query, '--') === 0 || strpos($query, '/*') === 0) {
        continue;
    }
    
    // Skip certain statements
    if (stripos($query, 'CREATE DATABASE') !== false || 
        stripos($query, 'USE ') === 0 ||
        stripos($query, 'SET SQL_MODE') !== false ||
        stripos($query, 'SET time_zone') !== false ||
        stripos($query, 'START TRANSACTION') !== false ||
        stripos($query, 'COMMIT') !== false) {
        continue;
    }
    
    if ($conn->query($query)) {
        $success++;
        // Show progress for CREATE and INSERT
        if (stripos($query, 'CREATE TABLE') !== false) {
            preg_match('/CREATE TABLE[^`]*`([^`]+)`/i', $query, $matches);
            echo "✓ Created table: " . ($matches[1] ?? 'unknown') . "\n";
        } elseif (stripos($query, 'INSERT INTO') !== false) {
            preg_match('/INSERT INTO[^`]*`([^`]+)`/i', $query, $matches);
            echo "✓ Inserted into: " . ($matches[1] ?? 'unknown') . "\n";
        }
    } else {
        $failed++;
        $error = $conn->error;
        // Ignore "table already exists" errors
        if (strpos($error, 'already exists') === false) {
            $errors[] = substr($query, 0, 100) . "... => " . $error;
        }
    }
}

// Re-enable foreign key checks
$conn->query("SET FOREIGN_KEY_CHECKS = 1");

echo "\n=== Import Complete ===\n";
echo "Successful queries: $success\n";
echo "Failed queries: $failed\n";

if (!empty($errors)) {
    echo "\nErrors (first 10):\n";
    foreach (array_slice($errors, 0, 10) as $err) {
        echo "  - $err\n";
    }
}

// Show tables
echo "\n=== Tables in Database ===\n";
$result = $conn->query("SHOW TABLES");
while ($row = $result->fetch_array()) {
    $tableName = $row[0];
    $countResult = $conn->query("SELECT COUNT(*) as cnt FROM `$tableName`");
    $count = $countResult->fetch_assoc()['cnt'];
    echo "  - $tableName ($count rows)\n";
}

echo "\n⚠️ DELETE THIS FILE (import_database.php) AFTER SUCCESSFUL IMPORT!\n";
echo "</pre>";
?>
