<?php
require_once __DIR__ . '/../../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    header("Location: ../loginpage.php");
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['module_id'])) {
    $moduleId = $_POST['module_id'];

    // Connect to the database
    $conn = getDBConnection();
    if (!$conn) {
        die("Connection failed");
    }

    // Update the module's status to "draft"
    $stmt = $conn->prepare("UPDATE modules SET status = 'draft' WHERE id = ?");
    $stmt->bind_param("i", $moduleId);

    if ($stmt->execute()) {
        // Redirect back to the module management page with a success message
        header("Location: ../Amodule.php?revoke=success");
    } else {
        echo "Error revoking module: " . $stmt->error;
    }

    $stmt->close();
    $conn->close();
    exit();
} else {
    echo "Invalid request.";
    exit();
}
?>