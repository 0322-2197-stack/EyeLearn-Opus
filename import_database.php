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
$conn->query("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO'");

// Use multi_query to execute all statements at once
if ($conn->multi_query($sql)) {
    $count = 0;
    do {
        $count++;
        if ($result = $conn->store_result()) {
            $result->free();
        }
    } while ($conn->more_results() && $conn->next_result());
    
    echo "✓ Executed $count SQL statements\n";
    
    // Check for errors in the last query
    if ($conn->error) {
        echo "⚠ Last error: " . $conn->error . "\n";
    }
} else {
    echo "✗ Error: " . $conn->error . "\n";
}

// Re-enable foreign key checks
$conn->close();
$conn = getDBConnection(); // Reconnect after multi_query
$conn->query("SET FOREIGN_KEY_CHECKS = 1");

echo "\n=== Import Complete ===\n";

// Show tables
echo "\n=== Tables in Database ===\n";
$result = $conn->query("SHOW TABLES");
if ($result) {
    while ($row = $result->fetch_array()) {
        $tableName = $row[0];
        $countResult = $conn->query("SELECT COUNT(*) as cnt FROM `$tableName`");
        if ($countResult) {
            $count = $countResult->fetch_assoc()['cnt'];
            echo "  - $tableName ($count rows)\n";
        } else {
            echo "  - $tableName (count error)\n";
        }
    }
} else {
    echo "Could not list tables\n";
}

echo "\n⚠️ DELETE THIS FILE (import_database.php) AFTER SUCCESSFUL IMPORT!\n";
echo "</pre>";
?>
