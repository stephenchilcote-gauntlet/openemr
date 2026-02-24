<?php

/**
 * Clinical Assistant proxy endpoint
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    OpenEMR Community
 * @copyright Copyright (c) 2026 OpenEMR
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/../../../../globals.php';

$path = isset($_GET['path']) ? (string)$_GET['path'] : '';
if ($path === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing path']);
    exit;
}

if ($path[0] !== '/') {
    $path = '/' . $path;
}

if (!preg_match('#^/api/|^/ui(?:/|$)#', $path)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unsupported path']);
    exit;
}

$userId = (string)($_SESSION['authUserID'] ?? $_SESSION['authUser'] ?? '');
if ($userId === '') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

$baseUrl = rtrim((string)(getenv('OPENEMR_AGENT_API_URL') ?: 'http://127.0.0.1:8000'), '/');
$targetUrl = $baseUrl . $path;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$requestBody = file_get_contents('php://input') ?: '';

// For /api/chat POST requests, inject patient context from the PHP session.
// The JS sidebar may not reliably detect the active patient from the iframe,
// so the server-side session is the authoritative source.
if ($method === 'POST' && preg_match('#^/api/chat$#', $path) && $requestBody !== '') {
    $payload = json_decode($requestBody, true);
    if (is_array($payload)) {
        $sessionPid = !empty($pid) ? (string)$pid : null;
        $sessionEncounter = !empty($encounter) ? (string)$encounter : null;
        $patientName = null;
        if ($sessionPid) {
            require_once $GLOBALS['fileroot'] . '/library/patient.inc.php';
            $ptData = getPatientData($sessionPid, 'fname, lname');
            if ($ptData) {
                $patientName = trim(($ptData['fname'] ?? '') . ' ' . ($ptData['lname'] ?? ''));
            }
        }
        if (!isset($payload['page_context']) || !is_array($payload['page_context'])) {
            $payload['page_context'] = [];
        }
        // Server-side values override client-side (authoritative source)
        if ($sessionPid) {
            $payload['page_context']['patient_id'] = $sessionPid;
        }
        if ($sessionEncounter) {
            $payload['page_context']['encounter_id'] = $sessionEncounter;
        }
        if ($patientName) {
            if (!isset($payload['page_context']['visible_data']) || !is_array($payload['page_context']['visible_data'])) {
                $payload['page_context']['visible_data'] = [];
            }
            $payload['page_context']['visible_data']['patient_name'] = $patientName;
        }
        $requestBody = json_encode($payload);
    }
}

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

$headers = [
    'openemr_user_id: ' . $userId,
    'Accept: application/json',
];
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if ($contentType !== '') {
    $headers[] = 'Content-Type: ' . $contentType;
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

if ($method !== 'GET' && $method !== 'HEAD') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
}

$responseHeaders = [];
curl_setopt($ch, CURLOPT_HEADERFUNCTION, static function ($curl, $headerLine) use (&$responseHeaders) {
    $len = strlen($headerLine);
    $parts = explode(':', $headerLine, 2);
    if (count($parts) === 2) {
        $name = strtolower(trim($parts[0]));
        $value = trim($parts[1]);
        $responseHeaders[$name] = $value;
    }
    return $len;
});

$responseBody = curl_exec($ch);
if ($responseBody === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Agent backend unreachable']);
    curl_close($ch);
    exit;
}

$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($status > 0 ? $status : 200);
header('Content-Type: ' . ($responseHeaders['content-type'] ?? 'application/json'));
echo $responseBody;
