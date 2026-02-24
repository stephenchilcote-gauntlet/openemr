(function injectClinicalAssistantSidebar() {
    if (window.top !== window.self) {
        return;
    }

    // Skip login/logout pages — no session exists, sidebar_frame would redirect top window
    if (/\/(login|login_screen)\.php/i.test(window.location.pathname)) {
        return;
    }

    var SIDEBAR_ID = 'openemr-clinical-assistant-sidebar';
    if (document.getElementById(SIDEBAR_ID)) {
        return;
    }

    var SIDEBAR_WIDTH = 380;
    var moduleRoot = '/interface/modules/custom_modules/oe-module-clinical-assistant/public';
    var site = new URLSearchParams(window.location.search).get('site') || 'default';
    var frameSrc = moduleRoot + '/sidebar_frame.php?site=' + encodeURIComponent(site);

    function collectContext() {
        var topWindow = window.top || window;
        var pid = null;
        var encounter = null;
        var patientName = null;

        // Modern OpenEMR tab interface stores patient in Knockout view model
        try {
            var appVM = topWindow.app_view_model;
            if (appVM && appVM.application_data && appVM.application_data.patient) {
                var patient = appVM.application_data.patient();
                if (patient) {
                    pid = patient.pid ? patient.pid() : null;
                    patientName = patient.pname ? patient.pname() : null;
                    encounter = patient.selectedEncounterID ? patient.selectedEncounterID() : null;
                }
            }
        } catch (e) { /* view model not ready yet */ }

        // Fallback to legacy window globals
        if (!pid) {
            pid = topWindow.pid || (topWindow.globals ? topWindow.globals.pid : null) || null;
        }
        if (!encounter) {
            encounter = topWindow.encounter || (topWindow.globals ? topWindow.globals.encounter : null) || null;
        }
        if (!patientName) {
            patientName = topWindow.patient_name || null;
        }

        topWindow.openemrAgentContext = {
            pid: pid,
            encounter: encounter,
            patient_name: patientName
        };
    }

    function subscribeToPatientChanges() {
        var topWindow = window.top || window;
        try {
            var appVM = topWindow.app_view_model;
            if (appVM && appVM.application_data && appVM.application_data.patient &&
                typeof appVM.application_data.patient.subscribe === 'function') {
                appVM.application_data.patient.subscribe(function () {
                    collectContext();
                });
            }
        } catch (e) { /* Knockout not available */ }
    }

    function mount() {
        if (!document.body) {
            return;
        }

        collectContext();
        subscribeToPatientChanges();

        // --- Restructure DOM: wrap existing body children + sidebar in a flex row ---
        var outerShell = document.createElement('div');
        outerShell.id = 'ca-shell';

        var contentPane = document.createElement('div');
        contentPane.id = 'ca-content';

        // Move every existing body child into the content pane
        while (document.body.firstChild) {
            contentPane.appendChild(document.body.firstChild);
        }

        var sidebar = document.createElement('div');
        sidebar.id = SIDEBAR_ID;

        var frame = document.createElement('iframe');
        frame.src = frameSrc;
        frame.title = 'Clinical Assistant';

        sidebar.appendChild(frame);
        outerShell.appendChild(contentPane);
        outerShell.appendChild(sidebar);
        document.body.appendChild(outerShell);

        // --- Inject layout CSS ---
        var s = document.createElement('style');
        s.id = 'clinical-assistant-layout';
        s.textContent =
            // Reset body — let the shell fill the viewport
            'html, body { width: 100% !important; min-width: 0 !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; display: block !important; }' +
            // Flex row: content takes remaining space, sidebar is fixed-width
            '#ca-shell { display: flex; flex-direction: row; width: 100vw; height: 100vh; overflow: hidden; }' +
            '#ca-content { flex: 1 1 0%; min-width: 0; height: 100%; overflow: auto; display: flex; flex-direction: column; }' +
            // Preserve OpenEMR flex layout inside the content pane
            '#ca-content > #mainBox { flex: 1 1 auto; min-height: 0; width: 100% !important; }' +
            // Sidebar
            '#' + SIDEBAR_ID + ' { flex: 0 0 ' + SIDEBAR_WIDTH + 'px; width: ' + SIDEBAR_WIDTH + 'px; height: 100%; border-left: 1px solid #d1d5db; background: #fff; box-shadow: 0 14px 34px rgba(15,23,42,0.12); z-index: 2147480000; }' +
            '#' + SIDEBAR_ID + ' > iframe { width: 100%; height: 100%; border: 0; }';
        document.head.appendChild(s);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
        mount();
    }
})();
