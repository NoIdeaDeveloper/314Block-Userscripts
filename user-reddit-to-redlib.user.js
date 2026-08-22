// =============================================================================
// Reddit to Redlib Redirector (Random Instance)
// =============================================================================
// Redirects Reddit to a randomly selected, reachable Redlib instance,
// preserving the URL path and query string. Strips known Reddit tracking
// parameters from URLs before redirecting.
//
// VERSION: 6.2
// AUTHOR:  NoIdeaDeveloper
// LICENSE: MIT
// REPO:    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// =============================================================================
//
// =============================================================================
// OPTION A — BRAVE BROWSER (Built-in Scriptlets, no extension required)
// =============================================================================
//
// STEP 1: Open Brave's content filter settings by visiting:
//            brave://settings/shields/filters
//
// STEP 2: Scroll to the bottom of the page and enable "Developer mode"
//
// STEP 3: Click "Add new scriptlet" and configure it as follows:
//            Name:   reddit-to-redlib
//            Code:   Paste everything from the (function() { line downward
//                    Do NOT include these comment instructions in the paste
//         Then click "Save"
//         Note: Brave automatically adds a "user-" prefix to the name,
//               so it will be saved as "user-reddit-to-redlib"
//
// STEP 4: Scroll up to the "Custom filters" text box on the same page
//         and add the following line exactly as shown:
//
//            *.reddit.com##+js(user-reddit-to-redlib.js)
//
//         (The ".js" above is Brave's scriptlet reference syntax — it refers
//          to the saved scriptlet name, not to any file in this repository.)
//
//         Then click "Save changes"
//
// STEP 5: Make sure Brave Shields is enabled (the lion icon in the address
//         bar should NOT be crossed out) when visiting Reddit
//
// STEP 6: Visit reddit.com to confirm the redirect is working
//
// -----------------------------------------------------------------------------
//
// =============================================================================
// OPTION B — CHROME / ANY BROWSER (Via Tampermonkey extension)
// =============================================================================
//
// STEP 1: Install the Tampermonkey extension for your browser:
//            Chrome:  https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
//            Firefox: https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/
//            Edge:    https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd
//
// STEP 2: Click the Tampermonkey icon in your toolbar and select
//         "Create a new script"
//
// STEP 3: Delete all the default placeholder code in the editor
//
// STEP 4: Paste the ENTIRE contents of this file (including the
//         ==UserScript== header block below) into the editor
//
// STEP 5: Click File > Save (or press Ctrl+S / Cmd+S)
//
// STEP 6: Visit reddit.com to confirm the redirect is working
//
// -----------------------------------------------------------------------------
//
// =============================================================================
// HOW INSTANCE SELECTION WORKS
// =============================================================================
//
// On every visit the instance list is shuffled into a random order, then each
// instance is probed in turn with a lightweight connectivity check. You are
// redirected to the FIRST instance that responds — so if your randomly chosen
// instance happens to be down, the script automatically rolls on to the next
// one instead of dumping you on a browser error page. If every instance is
// unreachable, a short fallback page is shown with a link to the instance list.
//
// IMPORTANT — about probing and Reddit's Content-Security-Policy:
//   Reddit serves a strict CSP ("default-src 'none'" with no connect-src), which
//   blocks ordinary fetch/XHR from inside the page to ANY other origin. That
//   means the connectivity probe can only work via GM_xmlhttpRequest, which runs
//   outside the page and bypasses its CSP. So:
//     • Tampermonkey (Option B): full probing + automatic failover (uses
//       GM_xmlhttpRequest — note the @grant and @connect lines in the header).
//     • Brave scriptlets (Option A): GM_xmlhttpRequest isn't available, so the
//       script skips probing and redirects straight to a randomly chosen
//       instance. (An earlier version tried a page-context fetch here, which
//       Reddit's CSP silently blocked — making EVERY instance look unreachable.)
//
// The list is sourced from the official Redlib instances JSON file at:
//   https://raw.githubusercontent.com/redlib-org/redlib-instances/refs/heads/main/instances.json
//
// The list was last updated: 2026-01-31
//
// To update the instance list manually:
//   1. Visit the URL above
//   2. Copy the clearnet (non-.onion) instance URLs into the INSTANCES array
//      in the script below
//   3. Update the "last updated" date above
//   4. Bump the @version number
//   5. Re-paste the updated script into Brave or Tampermonkey
//
// =============================================================================
// CONFIGURATION
// =============================================================================
//
//   INSTANCES   — The hardcoded list of Redlib instances to randomly pick from.
//                 .onion and .i2p addresses are excluded as normal browsers
//                 cannot reach them.
//
//   FALLBACK    — Used if the INSTANCES array is somehow empty. Should be
//                 a reliable instance you trust.
//
//   PROBE_TIMEOUT_MS — How long to wait for an instance to respond before
//                 treating it as unreachable and moving on to the next one.
//
// =============================================================================

// ==UserScript==
// @name         Reddit to Redlib Redirector (Random Instance)
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      6.3
// @description  Redirects Reddit to a randomly selected, reachable Redlib
//               instance, preserving the URL path and query string. Probes
//               instances and rolls on to the next if one is down. Strips
//               tracking parameters before redirecting.
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
// @connect      raw.githubusercontent.com
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-reddit-to-redlib.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-reddit-to-redlib.user.js
// ==/UserScript==

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

    // The master on/off switch for this script. When false, the script does
    // nothing (no redirect) and the settings panel is still shown so it can be
    // re-enabled. Persisted in storage so it survives updates.
    var ENABLED_KEY = 'reddit.enabled';
    var enabled = !!storeGet(ENABLED_KEY, true);
    function isEnabled() { return !!storeGet(ENABLED_KEY, true); }

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

    // The in-page settings panel, injected on front-end instances (where this
    // script also runs). Provides an enable/disable toggle plus any
    // script-specific fields supplied by the caller.
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

        // Enable/disable toggle
        var row = document.createElement('div');
        row.className = 'row';
        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.id = 'us314-enabled';
        chk.checked = isEnabled();
        var chkLbl = document.createElement('label');
        chkLbl.setAttribute('for', 'us314-enabled');
        chkLbl.textContent = 'Enable redirect';
        chkLbl.style.margin = '0';
        row.appendChild(chk);
        row.appendChild(chkLbl);
        panel.appendChild(row);

        // Script-specific fields
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

    // Hardcoded list of clearnet Redlib instances. Used as a fallback when the
    // auto-updated list (see maybeRefreshinstances below) is unavailable, empty,
    // or this script is running where network fetches are blocked.
    // Source: https://raw.githubusercontent.com/redlib-org/redlib-instances/refs/heads/main/instances.json
    // Last updated: 2026-01-31
    // .onion and .i2p instances are intentionally excluded — normal browsers cannot reach them
    var INSTANCES = [
        "https://redlib.catsarch.com",    // US
        "https://redlib.perennialte.ch",  // AU
        "https://redlib.nadeko.net",      // CL
    ];

    // Fallback used only if the instance list is somehow empty
    var FALLBACK = "https://redlib.perennialte.ch";

    // How long (ms) to wait for an instance to respond before moving on
    var PROBE_TIMEOUT_MS = 2500;

    // --- AUTO-UPDATING INSTANCE LIST ---
    // On a schedule we fetch the official instances.json so redirects always use
    // a current list of live instances without requiring a script update. The
    // fetched list is cached in storage so it's available synchronously on later
    // page loads; the hardcoded INSTANCES array is the fallback. Runs only on
    // front-end instances (not on the Reddit redirect path, which can't wait
    // for an async fetch). Set AUTOUPDATE to false in the settings panel to
    // disable (it does make a periodic request to GitHub).
    var INSTANCES_JSON_URL = 'https://raw.githubusercontent.com/redlib-org/redlib-instances/refs/heads/main/instances.json';
    var REFRESH_INTERVAL_MS = 3 * 24 * 3600 * 1000; // 3 days
    var AUTOUPDATE_KEY = 'reddit.autoUpdate';
    var INSTANCES_CACHE_KEY = 'reddit.instancesCache';
    var LASTFETCH_KEY = 'reddit.instancesFetchedAt';

    // GM_xmlhttpRequest bridge used by the reachability probe and the instance
    // list refresh. NULL when unavailable (e.g. Brave scriptlets) — callers
    // handle that case explicitly.
    var gmxhr = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest : null;

    function sanitizeInstances(json) {
        var out = [];
        if (!json || !Array.isArray(json.instances)) return out;
        json.instances.forEach(function(it) {
            var u = it && (it.url || null); // skip .onion/.i2p (no plain "url")
            if (!u) return;
            try {
                var p = new URL(u);
                if (p.protocol !== 'https:') return;
                out.push('https://' + p.host);
            } catch (e) { /* skip malformed */ }
        });
        return out;
    }

    // The list the redirect logic uses: cached auto-updated list if present and
    // non-empty, otherwise the embedded fallback.
    function currentInstances() {
        if (storeGet(AUTOUPDATE_KEY, true)) {
            var cached = storeGet(INSTANCES_CACHE_KEY, null);
            if (Array.isArray(cached) && cached.length) return cached;
        }
        return INSTANCES;
    }

    // Fetch + cache a fresh list if the cache is stale. Async; best-effort.
    function maybeRefreshInstances(force) {
        if (!storeGet(AUTOUPDATE_KEY, true)) return;
        if (!gmxhr) return; // needs a CSP-bypassing request
        var last = storeGet(LASTFETCH_KEY, 0);
        if (!force && (Date.now() - last) < REFRESH_INTERVAL_MS) return;
        gmxhr({
            method: 'GET',
            url: INSTANCES_JSON_URL,
            timeout: 8000,
            onload: function(res) {
                try {
                    var list = sanitizeInstances(JSON.parse(res.responseText));
                    if (list.length) {
                        storeSet(INSTANCES_CACHE_KEY, list);
                        storeSet(LASTFETCH_KEY, Date.now());
                    }
                } catch (e) { /* ignore bad JSON */ }
            },
            onerror: function() {}, ontimeout: function() {}
        });
    }

    // --- GUARD: one-time bypass ---
    // Appending "#noredirect" to a Reddit URL skips the redirect for that
    // navigation only (the fragment isn't sent to the server and doesn't
    // survive the redirect). Use it as an escape hatch to reach Reddit itself.
    var bypass = /(?:^|[#&])noredirect(?:[=&]|$)/.test(window.location.hash || '');
    if (bypass) {
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
    }

    // --- GUARD: script disabled via the settings panel ---
    var active = enabled && !bypass;

    // --- GUARD: Don't redirect if we're already on a Redlib instance ---
    // Checks the current hostname against every instance in the list
    var currentHost = window.location.hostname;
    var instanceList = currentInstances();
    var alreadyOnRedlib = instanceList.concat([FALLBACK]).some(function(url) {
        try {
            return new URL(url).hostname === currentHost;
        } catch(e) {
            return false; // Skip malformed URLs
        }
    });
    if (alreadyOnRedlib) {
        // On a front-end instance: (re)refresh the instance list on a schedule
        // and show the settings panel so the user can manage config.
        whenHead(function() {
            maybeRefreshInstances(false);
            buildSettingsPanel({
                title: 'Reddit → Redlib',
                fields: [
                    { key: 'instance', label: 'Force a specific Redlib instance (blank = random):', placeholder: 'https://redlib.example.com', value: storeGet('reddit.instance', '') }
                ],
                onSave: function(values, isOn) {
                    storeSet('reddit.instance', values.instance);
                    if (isOn && values.instance) maybeRefreshInstances(true);
                }
            });
            // Extra toggle for the auto-update behaviour
            var panel = document.getElementById('us314-panel');
            if (panel) {
                var row = document.createElement('div');
                row.className = 'row';
                var au = document.createElement('input');
                au.type = 'checkbox'; au.id = 'us314-au'; au.checked = !!storeGet(AUTOUPDATE_KEY, true);
                var auLbl = document.createElement('label');
                auLbl.setAttribute('for', 'us314-au'); auLbl.style.margin = '0';
                auLbl.textContent = 'Auto-update instance list (contacts GitHub)';
                row.appendChild(au); row.appendChild(auLbl);
                panel.insertBefore(row, document.getElementById('us314-note'));
                au.addEventListener('change', function() { storeSet(AUTOUPDATE_KEY, au.checked); if (au.checked) maybeRefreshInstances(true); });
            }
        });
        return; // No redirect when already on a front-end
    }

    // Register a menu command to open the settings panel on front-end instances.
    registerMenu('Reddit → Redlib settings', function() { /* panel lives on instances */ });

    // If the script is disabled or this is a bypass navigation, stop here —
    // leave Reddit alone entirely.
    if (!active) return;

    // Optional user-forced instance (set via the settings panel on an instance).
    // Validated; blank means "pick a random reachable instance".
    var forcedInstance = '';
    try {
        var fv = storeGet('reddit.instance', '');
        if (fv) {
            var fp = new URL(fv);
            if (fp.protocol === 'https:' || fp.protocol === 'http:') forcedInstance = 'https://' + fp.host;
        }
    } catch (e) { forcedInstance = ''; }

    // --- GUARD: Don't redirect if we're inside an iframe ---
    // Prevents the script from breaking Reddit embeds on third-party websites
    if (window.self !== window.top) {
        return;
    }

    // Immediately hide the page body so no Reddit content flashes on screen
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // Grab the current path and query string to preserve in the Redlib URL
    // e.g. /r/privacy?sort=new stays as /r/privacy?sort=new on Redlib
    var currentPath = window.location.pathname;
    var currentQuery = window.location.search;

    // --- TRACKING PARAMETER STRIPPER ---
    // Removes Reddit/generic analytics parameters that are meaningless on Redlib
    function stripTrackingParams(queryString) {
        if (!queryString) return '';

        var params = new URLSearchParams(queryString);

        // List of known Reddit/generic tracking parameters to remove
        var trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', // Generic UTM tracking
            'utm_term', 'utm_content',                   // More UTM params
            'ref', 'ref_source',                         // Reddit referral tracking
            'correlation_id', 'share_id'                 // Reddit share tracking
        ];

        trackingParams.forEach(function(param) {
            params.delete(param);
        });

        // Return the cleaned query string, or empty string if nothing remains
        return params.toString() ? '?' + params.toString() : '';
    }

    // --- SHUFFLE ---
    // Returns a randomly ordered copy of an array (Fisher–Yates). We try
    // instances in this shuffled order so load is spread across the list
    // while still allowing us to fall through to the next one on failure.
    function shuffled(arr) {
        var copy = arr.slice();
        for (var i = copy.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    // --- BUILD A REDLIB URL ---
    // Combines an instance origin with Reddit's cleaned path and query string,
    // using the URL constructor for safe, well-formed output.
    var cleanQuery = stripTrackingParams(currentQuery);
    function buildURL(instance) {
        return new URL(currentPath + cleanQuery, instance).href;
    }

    // --- PROBE AN INSTANCE'S REACHABILITY ---
    // Sends a lightweight HEAD request with a hard timeout. It resolves true for
    // any HTTP response (we can't always read the status, but we don't need to)
    // and false on a genuine network failure — DNS error, connection refused, or
    // TLS failure — which is exactly the "instance is down" case we want.
    //
    // The request MUST go through GM_xmlhttpRequest, not the page's fetch/XHR.
    // Reddit's CSP is "default-src 'none'" with no connect-src, so any in-page
    // request to another origin is blocked before it leaves the browser — which
    // made the previous fetch-based probe report EVERY instance as unreachable.
    // GM_xmlhttpRequest runs outside the page and is not subject to that CSP.
    //
    // When GM_xmlhttpRequest is unavailable (Brave scriptlets, or @grant none)
    // there is no CSP-bypassing request we can make, so we optimistically treat
    // the instance as reachable and redirect to it directly (no failover).
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

    // --- ALL-UNREACHABLE FALLBACK PAGE ---
    // Built with safe DOM methods (textContent / setAttribute), never innerHTML,
    // so nothing in the URL can be interpreted as markup.
    function showAllUnreachable() {
        function render() {
            style.remove(); // Reveal the page so it isn't just blank
            document.body.innerHTML = '';
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'font-family:sans-serif;text-align:center;padding:3rem;color:#333;';
            var heading = document.createElement('h2');
            heading.textContent = 'All Redlib instances are unreachable';
            heading.style.cssText = 'margin:0 0 0.5rem;';
            var para = document.createElement('p');
            para.style.cssText = 'color:#666;margin:0 0 1.5rem;';
            para.textContent = 'Try again later or visit the instance list to find alternatives.';
            var link = document.createElement('a');
            link.setAttribute('href', 'https://github.com/redlib-org/redlib-instances');
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            link.textContent = 'Browse Redlib instances';
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

    // --- REDIRECT ---
    // Walk the shuffled instance list, probing each one, and redirect to the
    // first that responds. If none respond, show the fallback page. A forced
    // instance (set in the settings panel) is tried first, then the rest.
    var pool = currentInstances();
    var candidates = shuffled(pool.length ? pool : [FALLBACK]);
    if (forcedInstance) {
        candidates = [forcedInstance].concat(candidates.filter(function(u) { return u !== forcedInstance; }));
    }

    (function tryNext(i) {
        if (i >= candidates.length) {
            showAllUnreachable();
            return;
        }
        var instance = candidates[i];
        probe(instance, PROBE_TIMEOUT_MS).then(function(reachable) {
            if (reachable) {
                // replace() means Reddit won't appear in the browser history
                window.location.replace(buildURL(instance));
            } else {
                tryNext(i + 1);
            }
        });
    })(0);

})();
