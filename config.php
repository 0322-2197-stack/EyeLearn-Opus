<?php
/**
 * EyeLearn Database Configuration
 * Centralized database connection settings
 */

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Prevent multiple inclusions
if (defined('DB_CONFIG_LOADED')) {
    return;
}
define('DB_CONFIG_LOADED', true);

// Database credentials - Auto-detect environment
// Parse MYSQL_URL if available (Railway format: mysql://user:pass@host:port/database)
$mysql_url = getenv('MYSQL_URL');
if ($mysql_url) {
    $parsed = parse_url($mysql_url);
    define('DB_HOST', $parsed['host'] ?? 'localhost');
    define('DB_USER', $parsed['user'] ?? 'root');
    define('DB_PASS', $parsed['pass'] ?? '');
    define('DB_NAME', ltrim($parsed['path'] ?? '/elearn_db', '/'));
    define('DB_PORT', $parsed['port'] ?? '3306');
} else {
    // Falls back to individual env vars or localhost for XAMPP
    define('DB_HOST', getenv('MYSQL_HOST') ?: getenv('MYSQLHOST') ?: 'localhost');
    define('DB_USER', getenv('MYSQL_USER') ?: getenv('MYSQLUSER') ?: 'root');
    define('DB_PASS', getenv('MYSQL_PASSWORD') ?: getenv('MYSQLPASSWORD') ?: '');
    define('DB_NAME', getenv('MYSQL_DATABASE') ?: getenv('MYSQLDATABASE') ?: 'elearn_db');
    define('DB_PORT', getenv('MYSQL_PORT') ?: getenv('MYSQLPORT') ?: '3306');
}

// Check if running on Railway/cloud
define('IS_PRODUCTION', getenv('RAILWAY_ENVIRONMENT') || getenv('APP_ENV') === 'production');

/**
 * Get MySQLi connection
 * @return mysqli|null
 */
function getDBConnection() {
    static $conn = null;
    
    if ($conn === null || !$conn->ping()) {
        $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, (int)DB_PORT);
        
        if ($conn->connect_error) {
            error_log("Database connection failed: " . $conn->connect_error);
            return null;
        }
        
        $conn->set_charset("utf8mb4");
    }
    
    return $conn;
}

/**
 * Get PDO connection
 * @return PDO|null
 */
function getPDOConnection() {
    static $pdo = null;
    
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]);
        } catch (PDOException $e) {
            error_log("PDO connection failed: " . $e->getMessage());
            return null;
        }
    }
    
    return $pdo;
}

/**
 * Test database connection
 * @return array
 */
function testDatabaseConnection() {
    $result = [
        'success' => false,
        'mysqli' => false,
        'pdo' => false,
        'database_exists' => false,
        'tables' => [],
        'errors' => []
    ];
    
    // Test MySQLi
    $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS);
    if ($conn->connect_error) {
        $result['errors'][] = "MySQLi connection failed: " . $conn->connect_error;
    } else {
        $result['mysqli'] = true;
        
        // Check if database exists
        $dbResult = $conn->query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '" . DB_NAME . "'");
        if ($dbResult && $dbResult->num_rows > 0) {
            $result['database_exists'] = true;
            
            // Select database and get tables
            $conn->select_db(DB_NAME);
            $tablesResult = $conn->query("SHOW TABLES");
            if ($tablesResult) {
                while ($row = $tablesResult->fetch_array()) {
                    $result['tables'][] = $row[0];
                }
            }
        } else {
            $result['errors'][] = "Database '" . DB_NAME . "' does not exist";
        }
        $conn->close();
    }
    
    // Test PDO
    try {
        $pdo = new PDO("mysql:host=" . DB_HOST, DB_USER, DB_PASS);
        $result['pdo'] = true;
    } catch (PDOException $e) {
        $result['errors'][] = "PDO connection failed: " . $e->getMessage();
    }
    
    $result['success'] = $result['mysqli'] && $result['database_exists'];
    
    return $result;
}

/**
 * Execute a safe query with error handling
 * @param string $sql
 * @param array $params (for prepared statements with PDO)
 * @return mysqli_result|bool|array
 */
function safeQuery($sql, $params = []) {
    if (empty($params)) {
        // Use MySQLi for simple queries
        $conn = getDBConnection();
        if (!$conn) {
            return false;
        }
        return $conn->query($sql);
    } else {
        // Use PDO for parameterized queries
        $pdo = getPDOConnection();
        if (!$pdo) {
            return false;
        }
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            error_log("Query failed: " . $e->getMessage());
            return false;
        }
    }
}

/**
 * Authenticate user with email and password
 * @param string $email
 * @param string $password
 * @param PDO|null $pdo (optional, will create if not provided)
 * @return array|false User data on success, false on failure
 */
function authenticateUser($email, $password, $pdo = null) {
    if ($pdo === null) {
        $pdo = getPDOConnection();
    }
    
    if (!$pdo) {
        error_log("Database connection failed in authenticateUser");
        return false;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user && password_verify($password, $user['password'])) {
            return $user;
        }
        
        return false;
    } catch (PDOException $e) {
        error_log("Authentication error: " . $e->getMessage());
        return false;
    }
}

/**
 * Create user session after successful login
 * @param array $user User data from database
 */
function createUserSession($user) {
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['name'] = $user['name'] ?? $user['firstname'] ?? '';
    $_SESSION['firstname'] = $user['firstname'] ?? '';
    $_SESSION['lastname'] = $user['lastname'] ?? '';
    $_SESSION['role'] = $user['role'] ?? 'user';
    $_SESSION['logged_in'] = true;
    $_SESSION['login_time'] = time();
}

/**
 * Check if user is logged in
 * @return bool
 */
function isLoggedIn() {
    return isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
}

/**
 * Require user to be logged in, redirect to login page if not
 * @param string $redirect URL to redirect to after login
 */
function requireLogin($redirect = null) {
    if (!isLoggedIn()) {
        $loginUrl = '/capstone/loginpage.php';
        if ($redirect) {
            $loginUrl .= '?redirect=' . urlencode($redirect);
        }
        header('Location: ' . $loginUrl);
        exit;
    }
}

/**
 * Get current user ID from session
 * @return int|null
 */
function getCurrentUserId() {
    return $_SESSION['user_id'] ?? null;
}

/**
 * Get current user role from session
 * @return string|null
 */
function getCurrentUserRole() {
    return $_SESSION['role'] ?? null;
}

/**
 * Destroy user session (logout)
 */
function destroyUserSession() {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
}

/**
 * Check if user exists by email
 * @param string $email
 * @param PDO|null $pdo
 * @return bool
 */
function userExists($email, $pdo = null) {
    if ($pdo === null) {
        $pdo = getPDOConnection();
    }
    
    if (!$pdo) {
        return false;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        return $stmt->fetch() !== false;
    } catch (PDOException $e) {
        error_log("Error checking user existence: " . $e->getMessage());
        return false;
    }
}

/**
 * Register a new user
 * @param string $firstName
 * @param string $lastName
 * @param string $email
 * @param string $password
 * @param string $gender
 * @param string $section
 * @param PDO|null $pdo
 * @return bool
 */
function registerUser($firstName, $lastName, $email, $password, $gender, $section, $pdo = null) {
    if ($pdo === null) {
        $pdo = getPDOConnection();
    }
    
    if (!$pdo) {
        return false;
    }
    
    try {
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("
            INSERT INTO users (firstname, lastname, email, password, gender, section, role, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, 'student', NOW())
        ");
        return $stmt->execute([$firstName, $lastName, $email, $hashedPassword, $gender, $section]);
    } catch (PDOException $e) {
        error_log("Error registering user: " . $e->getMessage());
        return false;
    }
}

// Initialize PDO connection for backward compatibility
$pdo = getPDOConnection();
?>