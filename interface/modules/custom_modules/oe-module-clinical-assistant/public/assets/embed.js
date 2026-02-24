(function injectClinicalAssistantSidebar() {
    if (window.top !== window.self) {
        return;
    }

    var SIDEBAR_ID = 'openemr-clinical-assistant-sidebar';
    if (document.getElementById(SIDEBAR_ID)) {
        return;
    }

    var moduleRoot = '/interface/modules/custom_modules/oe-module-clinical-assistant/public';
    var site = new URLSearchParams(window.location.search).get('site') || 'default';
    var frameSrc = moduleRoot + '/sidebar_frame.php?site=' + encodeURIComponent(site);

    function collectContext() {
        var topWindow = window.top || window;
        var pid = topWindow.pid || (topWindow.globals ? topWindow.globals.pid : null) || null;
        var encounter = topWindow.encounter || (topWindow.globals ? topWindow.globals.encounter : null) || null;
        var patientName = topWindow.patient_name || null;
        topWindow.openemrAgentContext = {
            pid: pid,
            encounter: encounter,
            patient_name: patientName
        };
    }

    function mount() {
        if (!document.body) {
            return;
        }

        collectContext();

        var wrapper = document.createElement('div');
        wrapper.id = SIDEBAR_ID;
        wrapper.style.position = 'fixed';
        wrapper.style.top = '0';
        wrapper.style.right = '0';
        wrapper.style.width = '380px';
        wrapper.style.height = '100vh';
        wrapper.style.zIndex = '2147480000';
        wrapper.style.borderLeft = '1px solid #d1d5db';
        wrapper.style.background = '#fff';
        wrapper.style.boxShadow = '0 14px 34px rgba(15, 23, 42, 0.12)';

        var frame = document.createElement('iframe');
        frame.src = frameSrc;
        frame.title = 'Clinical Assistant';
        frame.style.width = '100%';
        frame.style.height = '100%';
        frame.style.border = '0';

        wrapper.appendChild(frame);
        document.body.appendChild(wrapper);
        if (window.innerWidth >= 1024) {
            document.body.style.marginRight = '380px';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
        mount();
    }
})();
