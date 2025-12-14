<?php
/**
 * Router for PHP Built-in Server
 * Handles routing and error logging for Railway deployment
 */

// Enable error display and logging
error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
ini_set('log_errors', '1');

try {
    error_log("Router: Request URI: " . $_SERVER['REQUEST_URI']);
    
    // Get the requested URI
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $uri = urldecode($uri);
    
    // Remove leading slash for file checking
    $file = ltrim($uri, '/');
    
    // If empty, serve index.php
    if (empty($file) || $file === '/') {
        $file = 'index.php';
    }
    
    // Build the full path
    $filePath = __DIR__ . '/' . $file;
    
    // If it's a real file and not a PHP file, serve it
    if (file_exists($filePath) && !is_dir($filePath) && pathinfo($filePath, PATHINFO_EXTENSION) !== 'php') {
        return false; // Let PHP built-in server handle it
    }
    
    // If it's a PHP file, include it
    if (file_exists($filePath) && pathinfo($filePath, PATHINFO_EXTENSION) === 'php') {
        error_log("Router: Including file: " . $filePath);
        try {
            require $filePath;
        } catch (Throwable $e) {
            error_log("Router: Error including file: " . $e->getMessage());
            http_response_code(500);
            echo "Error loading page: " . htmlspecialchars($e->getMessage());
        }
        return true;
    }
    
    // If file doesn't exist and doesn't have an extension, try adding .php
    if (!file_exists($filePath) && !pathinfo($filePath, PATHINFO_EXTENSION)) {
        $phpFile = $filePath . '.php';
        if (file_exists($phpFile)) {
            error_log("Router: Including PHP file: " . $phpFile);
            try {
                require $phpFile;
            } catch (Throwable $e) {
                error_log("Router: Error including PHP file: " . $e->getMessage());
                http_response_code(500);
                echo "Error loading page: " . htmlspecialchars($e->getMessage());
            }
            return true;
        }
    }
    
    // If nothing found, serve index.php (SPA behavior)
    if (file_exists(__DIR__ . '/index.php')) {
        error_log("Router: Falling back to index.php");
        try {
            require __DIR__ . '/index.php';
        } catch (Throwable $e) {
            error_log("Router: Error with index.php: " . $e->getMessage());
            http_response_code(500);
            echo "Error loading page: " . htmlspecialchars($e->getMessage());
        }
        return true;
    }
    
    // 404
    http_response_code(404);
    echo "404 Not Found";
    return true;
} catch (Throwable $e) {
    error_log("Router: Fatal error: " . $e->getMessage());
    http_response_code(500);
    echo "Fatal error: " . htmlspecialchars($e->getMessage());
    return true;
}
