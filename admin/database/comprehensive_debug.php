<?php
// Comprehensive database debug script
require_once '../../config.php';

ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "<h1>Database Connection and Query Debug</h1>";

echo "<h2>1. Testing Database Connection</h2>";
$testResult = testDatabaseConnection();

if ($testResult['mysqli']) {
    echo "<p style='color: green;'>✅ Database connection successful!</p>";
} else {
    echo "<p style='color: red;'>❌ Connection failed</p>";
    foreach ($testResult['errors'] as $error) {
        echo "<p style='color: red;'>- " . htmlspecialchars($error) . "</p>";
    }
    echo "<h3>Possible solutions:</h3>";
    echo "<ul>";
    echo "<li>Check if XAMPP MySQL is running</li>";
    echo "<li>Verify database name '" . DB_NAME . "' exists</li>";
    echo "<li>Check MySQL credentials in config.php</li>";
    echo "</ul>";
    exit();
}

echo "<h2>2. Database Status</h2>";
echo "<p>Database exists: " . ($testResult['database_exists'] ? '✅ Yes' : '❌ No') . "</p>";

$conn = getDBConnection();
if (!$conn) {
    echo "<p style='color: red;'>❌ Could not get database connection</p>";
    exit();
}

echo "<h2>3. Checking Users Table</h2>";
$tablesResult = $conn->query("SHOW TABLES LIKE 'users'");
if ($tablesResult->num_rows == 0) {
    echo "<p style='color: red;'>❌ Users table does not exist!</p>";
    
    $allTables = $conn->query("SHOW TABLES");
    echo "<h3>Available tables:</h3><ul>";
    while ($row = $allTables->fetch_assoc()) {
        echo "<li>" . array_values($row)[0] . "</li>";
    }
    echo "</ul>";
    exit();
}
echo "<p style='color: green;'>✅ Users table exists!</p>";

echo "<h2>4. Testing Users Table Structure</h2>";
$columnsResult = $conn->query("SHOW COLUMNS FROM users");
if (!$columnsResult) {
    echo "<p style='color: red;'>❌ Could not get table structure: " . $conn->error . "</p>";
    exit();
}

$columns = [];
echo "<table border='1' style='border-collapse: collapse;'>";
echo "<tr><th>Column</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th></tr>";
while ($row = $columnsResult->fetch_assoc()) {
    $columns[] = $row['Field'];
    echo "<tr>";
    echo "<td>" . htmlspecialchars($row['Field']) . "</td>";
    echo "<td>" . htmlspecialchars($row['Type']) . "</td>";
    echo "<td>" . ($row['Null'] == 'YES' ? 'YES' : 'NO') . "</td>";
    echo "<td>" . htmlspecialchars($row['Key']) . "</td>";
    echo "<td>" . htmlspecialchars($row['Default'] ?? 'NULL') . "</td>";
    echo "</tr>";
}
echo "</table>";

echo "<h2>5. Testing Basic Query</h2>";
$testQuery = "SELECT COUNT(*) as total FROM users";
echo "<p>Query: <code>$testQuery</code></p>";

$result = $conn->query($testQuery);
if (!$result) {
    echo "<p style='color: red;'>❌ Basic query failed: " . $conn->error . "</p>";
    exit();
}

$count = $result->fetch_assoc();
echo "<p style='color: green;'>✅ Found " . $count['total'] . " total users in database</p>";

echo "<h2>6. Final Status</h2>";
echo "<p style='color: green; font-size: 18px; font-weight: bold;'>🎉 All database tests passed!</p>";

$conn->close();
?>
