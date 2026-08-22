// ==UserScript==
// @name         Reddit to Redlib Redirector
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      3.4
// @description  Redirects Reddit to a private Redlib instance, preserving the URL path
// @author       NoIdeaDeveloper
// @license      MIT
// @match        *://*.reddit.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      *
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/reddit-to-redlib.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/reddit-to-redlib.user.js
// ==/UserScript==

// NOTE: This is the simpler, single-instance version of the Reddit redirector.
// It probes the configured instance before redirecting and shows a fallback
// message if it's down. For random instance selection with automatic failover,
// use user-reddit-to-redlib.user.js instead.

(function() {
    'use strict';

    // =========================================================================
    // SHARED SETTINGS & STORAGE
    // Present (with per-script keys) in every redirect script in this repo.
    // =========================================================================

    // Storage for settings and caches. Prefers the userscript manager's
    // synchronous GM_getValue/GM_setValue (readable at document-start, per the
    // @grant lines above, and they survive script auto-updates). Falls back to
    // localStorage when GM storage isn't available (e.g. Brave scriptlets) — in
    // that case persisted values only apply on the domains this script runs on.
    var canStore = (typeof GM_getValue === 'function' && typeof GM_setValue === 'function');
    function storeGet(key, def) {
        try {
            if (canStore) { var v = GM_getValue(key); return (v === undefined || v === null) ? def : v; }
            var raw = localStorage.getItem('us:' + key);
            return raw == null ? def : JSON.parse(raw);
        } catch (e) { return def; }
    }
    function storeSet(key, val) {
        try {
            if (canStore) { GM_setValue(key, val); return; }
            localStorage.setItem('us:' + key, JSON.stringify(val));
        } catch (e) { /* storage unavailable — keep in-memory */ }
    }

    // Inject CSS. Uses GM_addStyle (immune to page CSP) when available,
    // otherwise appends a <style> element.
    function addCSS(css) {
        if (typeof GM_addStyle === 'function') { try { GM_addStyle(css); return; } catch (e) {} }
        var s = document.createElement('style');
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    }

    // Insert the settings panel's CSS once the <head> exists.
    function whenHead(fn) {
        if (document.head) { fn(); return; }
        var mo = new MutationObserver(function() {
            if (document.head) { mo.disconnect(); fn(); }
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
        document.addEventListener('DOMContentLoaded', function() { mo.disconnect(); fn(); }, { once: true });
    }

    // Register a userscript-manager menu command, bridging GM (sync v3 API)
    // and the GM.* / window.GM async variants.
    function registerMenu(label, fn) {
        try {
            if (typeof GM_registerMenuCommand === 'function') { GM_registerMenuCommand(label, fn); return; }
        } catch (e) {}
        try {
            if (typeof GM !== 'undefined' && GM && typeof GM.registerMenuCommand === 'function') { GM.registerMenuCommand(label, fn); return; }
        } catch (e) {}
        try {
            if (typeof window !== 'undefined' && window.GM && typeof window.GM.registerMenuCommand === 'function') { window.GM.registerMenuCommand(label, fn); return; }
        } catch (e) {}
    }

    // The in-page settings panel, injected on the configured Redlib instance
    // (where this script also matches, since it may be under reddit.com). It
    // provides an enable/disable toggle plus the script-specific instance
    // override field. Storage keys here ('reddit.simple.*') are distinct from
    // the random-instance script's ('reddit.*') so the two scripts' settings
    // never collide.
    //   opts: { title, fields:[{key,label,placeholder,value}], onSave }
    function buildSettingsPanel(opts) {
        addCSS(
            '#us314-fab{position:fixed;bottom:24px;right:24px;z-index:2147483646;width:46px;height:46px;border-radius:50%;background:#222;color:#fff;border:1px solid #444;font-size:20px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4);line-height:1;}' +
            '#us314-panel{position:fixed;bottom:82px;right:24px;z-index:2147483646;width:300px;background:#fff;color:#222;border:1px solid #ccc;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.35);font-family:sans-serif;padding:14px;}' +
            '#us314-panel h3{margin:0 0 10px;font-size:15px;}' +
            '#us314-panel label{display:block;font-size:12px;margin:8px 0 2px;color:#555;}' +
            '#us314-panel input[type=text]{width:100%;box-sizing:border-box;padding:6px;border:1px solid #bbb;border-radius:4px;font-size:13px;}' +
            '#us314-panel .row{display:flex;align-items:center;gap:8px;margin:8px 0;}' +
            '#us314-panel .btns{margin-top:12px;text-align:right;}' +
            '#us314-panel button{padding:6px 12px;border:0;border-radius:4px;cursor:pointer;font-size:13px;}' +
            '#us314-save{background:#336699;color:#fff;}' +
            '#us314-note{font-size:11px;color:#888;margin-top:10px;}'
        );
        var fab = document.createElement('button');
        fab.id = 'us314-fab';
        fab.title = 'Script settings';
        fab.textContent = '⚙';
        var panel = document.createElement('div');
        panel.id = 'us314-panel';
        panel.style.display = 'none';
        var h = document.createElement('h3');
        h.textContent = opts.title;
        panel.appendChild(h);

        // Enable/disable toggle — persists ENABLED_KEY instantly on Save
        var row = document.createElement('div');
        row.className = 'row';
        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.id = 'us314-enabled';
        chk.checked = !!storeGet(ENABLED_KEY, true);
        var chkLbl = document.createElement('label');
        chkLbl.setAttribute('for', 'us314-enabled');
        chkLbl.textContent = 'Enable redirect';
        chkLbl.style.margin = '0';
        row.appendChild(chk);
        row.appendChild(chkLbl);
        panel.appendChild(row);

        // Script-specific fields (here: the instance override)
        (opts.fields || []).forEach(function(f) {
            var lbl = document.createElement('label');
            lbl.textContent = f.label;
            panel.appendChild(lbl);
            var inp = document.createElement('input');
            inp.type = 'text';
            inp.id = 'us314-f-' + f.key;
            inp.placeholder = f.placeholder || '';
            inp.value = f.value;
            panel.appendChild(inp);
        });

        var note = document.createElement('div');
        note.id = 'us314-note';
        note.textContent = 'Saved instantly; applies to future pages.';
        panel.appendChild(note);

        var btns = document.createElement('div');
        btns.className = 'btns';
        var save = document.createElement('button');
        save.id = 'us314-save';
        save.textContent = 'Save';
        btns.appendChild(save);
        panel.appendChild(btns);

        (document.body || document.documentElement).appendChild(fab);
        (document.body || document.documentElement).appendChild(panel);

        fab.addEventListener('click', function() {
            panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
        });
        save.addEventListener('click', function() {
            storeSet(ENABLED_KEY, chk.checked);
            var values = {};
            (opts.fields || []).forEach(function(f) {
                var inp = document.getElementById('us314-f-' + f.key);
                values[f.key] = inp ? inp.value.trim() : '';
            });
            if (opts.onSave) opts.onSave(values, chk.checked);
            note.textContent = 'Saved. Applies to future pages.';
            setTimeout(function() { panel.style.display = 'none'; }, 250);
        });
    }

    // --- CONFIGURATION ---
    var destination = "https://redlib.perennialte.ch";

    // How long (ms) to wait for the instance to respond before showing the fallback page
    var PROBE_TIMEOUT_MS = 2500;

    // Validate/normalise the configured destination and derive its hostname,
    // both for the loop-prevention guard and for the reachability probe.
    // A typo or non-http(s) value falls back to a known-good instance.
    try {
        var parsedDest = new URL(destination);
        if (parsedDest.protocol !== 'https:' && parsedDest.protocol !== 'http:') {
            throw new Error('unsupported protocol');
        }
        destination = 'https://' + parsedDest.host; // force https, drop any path/query
    } catch (e) {
        destination = 'https://redlib.perennialte.ch';
    }
    var destHost = new URL(destination).hostname;

    // --- CONFIG OVERRIDE: user-pinned instance from the settings panel ---
    // If the user has saved a non-empty instance override, validate it and
    // use it instead of the in-file destination above (forcing https and
    // dropping any path/query). Blank falls back to the in-file default.
    try {
        var overrideVal = storeGet('reddit.simple.instance', '');
        if (overrideVal) {
            var parsedOverride = new URL(overrideVal);
            if (parsedOverride.protocol === 'https:' || parsedOverride.protocol === 'http:') {
                destination = 'https://' + parsedOverride.host;
                destHost = parsedOverride.hostname;
            }
        }
    } catch (e) { /* malformed override — keep the in-file destination */ }

    // --- GUARD: one-time bypass ---
    // Appending "#noredirect" to a Reddit URL skips the redirect for that
    // navigation only (the fragment isn't sent to the server and doesn't
    // survive the redirect). Use it as an escape hatch to reach Reddit itself.
    var bypass = /(?:^|[#&])noredirect(?:[=&]|$)/.test(window.location.hash || '');
    if (bypass) {
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
    }

    // The master on/off switch for this script, persisted in storage so it
    // survives updates. 'active' combines it with the one-time bypass above.
    var ENABLED_KEY = 'reddit.simple.enabled';
    var enabled = !!storeGet(ENABLED_KEY, true);
    function isEnabled() { return !!storeGet(ENABLED_KEY, true); }
    var active = enabled && !bypass;

    // --- GUARD: Don't redirect if we're already on the Redlib instance ---
    // Prevents an infinite redirect loop if the destination is somehow matched.
    // Instead of just bailing out, show the settings panel so the user can
    // change the pinned instance (or disable the script) from the instance itself.
    if (window.location.hostname === destHost) {
        whenHead(function() {
            buildSettingsPanel({
                title: 'Reddit → Redlib',
                fields: [
                    { key: 'instance', label: 'Redlib instance:', placeholder: 'https://redlib.example.com', value: storeGet('reddit.simple.instance', destination) }
                ],
                onSave: function(v) {
                    storeSet('reddit.simple.instance', v.instance);
                }
            });
        });
        return;
    }

    // If the script is disabled via the settings panel, or this is a bypass
    // navigation, stop here and leave Reddit alone entirely.
    if (!active) {
        return;
    }

    // --- GUARD: Don't redirect if we're inside an iframe ---
    // Prevents the script from breaking Reddit embeds on third-party websites
    if (window.self !== window.top) {
        return;
    }

    // Immediately hide the page body so no Reddit content flashes on screen
    // while the redirect is processing
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // --- TRACKING PARAMETER STRIPPER ---
    function stripTrackingParams(queryString) {
        if (!queryString) return '';

        var params = new URLSearchParams(queryString);
        var trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign',
            'utm_term', 'utm_content',
            'ref', 'ref_source',
            'correlation_id', 'share_id'
        ];

        trackingParams.forEach(function(param) {
            params.delete(param);
        });

        return params.toString() ? '?' + params.toString() : '';
    }

    // --- PROBE THE INSTANCE'S REACHABILITY ---
    // Sends a lightweight HEAD request with a hard timeout. It resolves true
    // for any HTTP response and false on a genuine network failure — DNS
    // error, connection refused, or TLS failure — exactly the "instance is
    // down" case we want to catch before navigating away.
    //
    // The request MUST go through GM_xmlhttpRequest, not the page's fetch/XHR.
    // Reddit's CSP ("default-src 'none'") blocks any in-page request to other
    // origins, which would make a reachable instance look down.
    // GM_xmlhttpRequest runs outside the page and is not subject to that CSP.
    //
    // When GM_xmlhttpRequest is unavailable (e.g. Brave scriptlets) there is
    // no CSP-bypassing request we can make, so we optimistically treat the
    // instance as reachable and redirect directly.
    var gmxhr = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest : null;
    function probe(baseUrl, timeoutMs) {
        return new Promise(function(resolve) {
            if (!gmxhr) { resolve(true); return; }
            var settled = false;
            function finish(ok) {
                if (settled) return;
                settled = true;
                resolve(ok);
            }
            gmxhr({
                method: 'HEAD',
                url: baseUrl,
                timeout: timeoutMs,
                onload: function() { finish(true); },
                onerror: function() { finish(false); },
                ontimeout: function() { finish(false); }
            });
        });
    }

    // --- "INSTANCE UNREACHABLE" FALLBACK PAGE ---
    // Built with safe DOM methods (textContent / setAttribute), never innerHTML,
    // so nothing in the URL can be interpreted as markup.
    function showUnreachable() {
        function render() {
            style.remove(); // Reveal the page so it isn't just blank
            document.body.innerHTML = '';
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'font-family:sans-serif;text-align:center;padding:3rem;color:#333;';
            var heading = document.createElement('h2');
            heading.textContent = 'Redlib instance unreachable';
            heading.style.cssText = 'margin:0 0 0.5rem;';
            var para = document.createElement('p');
            para.style.cssText = 'color:#666;margin:0 0 1.5rem;';
            var strong = document.createElement('strong');
            strong.textContent = destHost; // textContent: safe, no HTML interpretation
            para.appendChild(strong);
            para.appendChild(document.createTextNode(' could not be reached.'));
            var link = document.createElement('a');
            link.setAttribute('href', 'https://github.com/redlib-org/redlib-instances');
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            link.textContent = 'Find another instance';
            link.style.cssText = 'color:#336699;';
            wrapper.appendChild(heading);
            wrapper.appendChild(para);
            wrapper.appendChild(link);
            document.body.appendChild(wrapper);
        }
        // The body may not exist yet at document-start — wait if necessary.
        if (document.body) render();
        else document.addEventListener('DOMContentLoaded', render);
    }

    // Build the new Redlib URL using Reddit's current path and cleaned query string
    var currentPath = window.location.pathname;
    var currentQuery = window.location.search;
    var cleanQuery = stripTrackingParams(currentQuery);
    // Build with the URL constructor for safe, well-formed output
    var newURL = new URL(currentPath + cleanQuery, destination).href;

    // Probe first: redirect only if the instance actually responds, otherwise
    // show a clear message instead of a browser error page. The hidden body
    // means you'll never see Reddit content either way.
    // replace() means Reddit won't appear in the browser history.
    probe(destination, PROBE_TIMEOUT_MS).then(function(reachable) {
        if (reachable) {
            window.location.replace(newURL);
        } else {
            showUnreachable();
        }
    });

})();
