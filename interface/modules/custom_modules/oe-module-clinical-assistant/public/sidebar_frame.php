<?php

/**
 * Clinical Assistant sidebar frame host
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    OpenEMR Community
 * @copyright Copyright (c) 2026 OpenEMR
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/../../../../globals.php';

$assetBase = $GLOBALS['web_root'] . '/interface/modules/custom_modules/oe-module-clinical-assistant/public/assets';
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clinical Assistant</title>
    <link rel="stylesheet" href="<?= attr($assetBase . '/sidebar.css') ?>">
</head>
<body>
<aside class="sidebar" id="sidebar-root">
    <header class="sidebar-header">
        <div class="title-row">
            <h1>Clinical Assistant</h1>
            <div class="status-pill" id="status-pill" data-state="ready" aria-live="polite">
                <span class="status-dot" id="status-dot"></span>
                <span id="status-text">Ready</span>
            </div>
        </div>
        <div class="context-row" id="context-line">No patient selected</div>
        <div class="header-controls">
            <label class="visually-hidden" for="history-select">Conversation history</label>
            <select id="history-select" class="clickable" title="Conversation history"></select>
            <button id="new-conversation" class="clickable">New Conversation</button>
        </div>
    </header>

    <main class="chat-shell">
        <section id="chat-area" class="chat-area" aria-live="polite"></section>
        <button id="new-messages-pill" class="new-messages-pill clickable hidden">↓ New messages</button>
    </main>

    <section id="review-panel" class="review-panel hidden">
        <div class="review-header">
            <strong>Review Suggested Changes</strong>
            <div class="review-header-actions">
                <button id="apply-all" class="clickable">Apply All</button>
                <button id="reject-all" class="clickable">Reject All</button>
            </div>
        </div>
        <div id="review-cards" class="review-cards"></div>
        <div class="review-footer">
            <span id="review-summary">No pending changes.</span>
            <button id="execute-button" class="clickable">Execute Changes</button>
        </div>
    </section>

    <footer class="input-bar">
        <label class="visually-hidden" for="chat-input">Message</label>
        <textarea id="chat-input" rows="1" maxlength="12000" placeholder="Ask for chart help, coding suggestions, or review-ready updates..."></textarea>
        <div class="input-meta">
            <span id="char-counter" class="char-counter hidden">0 / 8000</span>
            <button id="send-button" class="clickable">Send</button>
        </div>
    </footer>
</aside>

<script>
    window.OPENEMR_AGENT_PROXY = "<?= attr($GLOBALS['web_root'] . '/interface/modules/custom_modules/oe-module-clinical-assistant/public/proxy.php') ?>";
</script>
<script src="<?= attr($assetBase . '/sidebar.js') ?>"></script>
</body>
</html>
