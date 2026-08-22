// =============================================================================
// Medium to Scribe Redirector
// =============================================================================
// Redirects Medium articles to Scribe (scribe.rip), preserving the URL path.
//
// VERSION: 1.7
// LICENSE: MIT
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
//            Name:   medium-to-scribe
//            Code:   Paste everything from the (function() { line downward
//                    Do NOT include these comment instructions in the paste
//         Then click "Save"
//         Note: Brave automatically adds a "user-" prefix to the name,
//               so it will be saved as "user-medium-to-scribe"
//
// STEP 4: Scroll up to the "Custom filters" text box on the same page
//         and add the following lines exactly as shown:
//
//            www.medium.com##+js(user-medium-to-scribe.js)
//            medium.com##+js(user-medium-to-scribe.js)
//            *.medium.com##+js(user-medium-to-scribe.js)
//
//         (The ".js" above is Brave's scriptlet reference syntax — it refers
//          to the saved scriptlet name, not to any file in this repository.)
//
//         Then click "Save changes"
//
// STEP 5: Make sure Brave Shields is enabled (the lion icon in the address
//         bar should NOT be crossed out) when visiting Medium
//
// STEP 6: Visit medium.com to confirm the redirect is working
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
// STEP 6: Visit medium.com to confirm the redirect is working
//
// -----------------------------------------------------------------------------
//
// =============================================================================
// CONFIGURATION
// =============================================================================
//
//   SCRIBE_BASE  — The Scribe instance to redirect to. Change this if
//                  you prefer a different mirror. You can also switch
//                  instances at any time via the settings panel (gear icon
//                  in the bottom-right corner of any Scribe page); that
//                  stored choice takes precedence over SCRIBE_BASE.
//
//   PROBE_TIMEOUT_MS — The configured instance is probed before every
//                  redirect. If it doesn't respond within this time, a short
//                  fallback page is shown instead of dumping you on a browser
//                  error page. (The probe uses an ordinary page-context fetch
//                  — Medium's CSP allows cross-origin requests, so no
//                  GM_xmlhttpRequest is needed here, unlike on Reddit.)
//
// =============================================================================

// ==UserScript==
// @name         Medium to Scribe Redirector
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      1.7
// @description  Redirects Medium articles to Scribe (scribe.rip), preserving
//               the URL path. Strips tracking parameters before redirecting.
// @author       NoIdeaDeveloper
// @license      MIT
// @match        *://medium.com/*
// @match        *://www.medium.com/*
// @match        *://*.medium.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-medium-to-scribe.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-medium-to-scribe.user.js
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

    // The in-page settings panel, injected on the Scribe instance (where this
    // script could otherwise loop). Provides an enable/disable toggle plus any
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

    // The Scribe instance all redirects will point to (unless overridden in
    // the settings panel — see EFFECTIVE_BASE below).
    // Must use https:// — enforced and validated below before any redirect fires.
    var SCRIBE_BASE = "https://scribe.rip";

    // How long (ms) to wait for the instance to respond before showing the
    // unreachable-instance fallback page instead of redirecting.
    var PROBE_TIMEOUT_MS = 2500;

    // --- GUARD: Validate and normalise the configured Scribe instance ---
    // Parses the configured value with the URL constructor and forces it to a
    // bare https origin. Anything that isn't a valid http(s) URL falls back to
    // the known-good default, so a typo can never send you to a junk or
    // non-https destination (e.g. "javascript:" or a malformed string).
    try {
        var parsedBase = new URL(SCRIBE_BASE);
        if (parsedBase.protocol !== 'https:' && parsedBase.protocol !== 'http:') {
            throw new Error('unsupported protocol');
        }
        SCRIBE_BASE = 'https://' + parsedBase.host; // force https, drop any path/query
    } catch (e) {
        SCRIBE_BASE = 'https://scribe.rip';
    }

    // Optional user override (set via the settings panel on the Scribe
    // instance). Validated the same way as SCRIBE_BASE; if it's non-empty and
    // a valid http(s) URL it takes precedence and becomes the effective base.
    // Malformed or blank values are ignored, leaving the validated SCRIBE_BASE
    // (which itself falls back to https://scribe.rip) in effect.
    var EFFECTIVE_BASE = SCRIBE_BASE;
    try {
        var storedInstance = storeGet('medium.instance', '');
        if (storedInstance) {
            var parsedOverride = new URL(storedInstance);
            if (parsedOverride.protocol === 'https:' || parsedOverride.protocol === 'http:') {
                EFFECTIVE_BASE = 'https://' + parsedOverride.host; // force https, drop any path/query
            }
        }
    } catch (e) { /* ignore malformed override — keep the SCRIBE_BASE default */ }

    // Hostname of the effective Scribe instance, used for the loop-prevention
    // guard below and the unreachable-instance fallback page.
    var SCRIBE_HOST = new URL(EFFECTIVE_BASE).hostname;

    // --- GUARD: one-time bypass ---
    // Appending "#noredirect" to a Medium URL skips the redirect for that
    // navigation only (the fragment isn't sent to the server and doesn't
    // survive the redirect). Use it as an escape hatch to reach Medium itself.
    var bypass = /(?:^|[#&])noredirect(?:[=&]|$)/.test(window.location.hash || '');
    if (bypass) {
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
    }

    // The master on/off switch for this script. When false, the script does
    // nothing (no redirect) and the settings panel is still shown so it can be
    // re-enabled. Persisted in storage so it survives updates.
    var ENABLED_KEY = 'medium.enabled';
    var enabled = !!storeGet(ENABLED_KEY, true);
    function isEnabled() { return !!storeGet(ENABLED_KEY, true); }

    // --- GUARD: script disabled via the settings panel, or bypassed ---
    var active = enabled && !bypass;

    // --- GUARD: Don't redirect if we're already on Scribe ---
    // Prevents an infinite redirect loop if the Scribe instance is somehow
    // matched. Instead of returning silently, show the settings panel so the
    // instance and the enabled toggle can be managed right there.
    if (window.location.hostname === SCRIBE_HOST) {
        whenHead(function() {
            buildSettingsPanel({
                title: 'Medium → Scribe',
                fields: [
                    { key: 'instance', label: 'Scribe instance:', placeholder: 'https://scribe.rip', value: storeGet('medium.instance', SCRIBE_BASE) }
                ],
                onSave: function(values) {
                    storeSet('medium.instance', values.instance);
                }
            });
        });
        return;
    }

    // Register a menu command to note where the settings panel lives.
    registerMenu('Medium → Scribe settings', function() { /* panel lives on the instance */ });

    // If the script is disabled or this is a bypass navigation, stop here —
    // leave Medium alone entirely.
    if (!active) return;

    // --- GUARD: Don't redirect if we're inside an iframe ---
    // Prevents the script from breaking Medium embeds on third-party websites
    if (window.self !== window.top) return;

    // --- TRACKING PARAMETER STRIPPER ---
    // Removes known analytics/tracking parameters that are meaningless on Scribe
    function stripTrackingParams(queryString) {
        if (!queryString) return '';

        var params = new URLSearchParams(queryString);

        // Known tracking parameters used by Medium and generic analytics tools
        var trackingParams = [
            'source',                                    // Medium internal tracking
            'utm_source', 'utm_medium', 'utm_campaign', // Generic UTM tracking
            'utm_term', 'utm_content',                   // More UTM params
            'ref', 'ref_source',                         // Referral tracking
            'sk'                                         // Medium friend links / paywall bypass param
        ];

        // Delete each tracking parameter if it exists in the query string
        trackingParams.forEach(function(param) {
            params.delete(param);
        });

        // Return the cleaned query string, or empty string if nothing remains
        return params.toString() ? '?' + params.toString() : '';
    }

    // --- ARTICLE DETECTION ---
    // Medium article URLs always end with a Post ID: a hyphen followed by
    // 8–14 hex characters, e.g. "my-article-09a6af907a2".
    // Non-article pages (tags, profiles, homepages) don't match this pattern,
    // so we use it to decide whether a redirect to Scribe makes sense.
    function isArticleUrl(path) {
        // Ignore any trailing slashes so "/@user/my-article-09a6af907a2/" still
        // matches the same way "/@user/my-article-09a6af907a2" does.
        var trimmed = path.replace(/\/+$/, '');
        // Regex: hyphen, then 8–14 lowercase hex characters, at end of path
        return /-[a-f0-9]{8,14}$/i.test(trimmed);
    }

    // Immediately hide the page body so no Medium content flashes on screen
    // while the probe runs and the redirect fires. Kept in an outer-scope
    // variable so the unreachable fallback can remove it again. (If this turns
    // out not to be an article page, it's removed right away below.)
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // --- PROBE THE INSTANCE'S REACHABILITY ---
    // Sends a lightweight no-cors HEAD request with a hard timeout. A no-cors
    // request resolves for any HTTP response and rejects on a genuine network
    // failure (DNS error, connection refused, TLS failure) — exactly the
    // "instance is down" case. Medium's CSP allows connect-src to any origin,
    // so a plain page-context fetch works here (unlike on Reddit — see the
    // Redlib scripts, which need GM_xmlhttpRequest to get past Reddit's CSP).
    // The settle-guard ensures the promise resolves exactly once, whichever of
    // the fetch or the timeout fires first.
    function probe(baseUrl, timeoutMs) {
        return new Promise(function(resolve) {
            var settled = false;
            function finish(ok) {
                if (settled) return;
                settled = true;
                resolve(ok);
            }
            var timer = setTimeout(function() { finish(false); }, timeoutMs);
            fetch(baseUrl, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
                .then(function() { clearTimeout(timer); finish(true); })
                .catch(function() { clearTimeout(timer); finish(false); });
        });
    }

    // --- "INSTANCE UNREACHABLE" FALLBACK PAGE ---
    // Shown when the configured Scribe instance doesn't respond to the probe.
    // Built with safe DOM methods (textContent / setAttribute), never innerHTML
    // with interpolated values, so nothing from the URL can be interpreted as
    // markup. Removes the body-hiding style so the page isn't just blank.
    function showUnreachable(styleEl) {
        function render() {
            if (styleEl) styleEl.remove(); // Reveal the page so it isn't just blank
            document.body.innerHTML = '';
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'font-family:sans-serif;text-align:center;padding:3rem;color:#333;';
            var heading = document.createElement('h2');
            heading.textContent = 'Scribe instance unreachable';
            heading.style.cssText = 'margin:0 0 0.5rem;';
            var para = document.createElement('p');
            para.style.cssText = 'color:#666;margin:0 0 1.5rem;';
            var strong = document.createElement('strong');
            strong.textContent = SCRIBE_HOST; // textContent: safe, no HTML interpretation
            para.appendChild(strong);
            para.appendChild(document.createTextNode(' could not be reached.'));
            var findLink = document.createElement('a');
            findLink.setAttribute('href', 'https://scribe.rip'); // setAttribute: safe, treats value as literal
            findLink.setAttribute('target', '_blank');
            findLink.setAttribute('rel', 'noopener noreferrer');
            findLink.textContent = 'Find another instance';
            findLink.style.cssText = 'color:#336699;';
            wrapper.appendChild(heading);
            wrapper.appendChild(para);
            wrapper.appendChild(findLink);
            document.body.appendChild(wrapper);
        }
        // The body may not exist yet at document-start — wait if necessary.
        if (document.body) render();
        else document.addEventListener('DOMContentLoaded', render);
    }

    // --- REDIRECT CHECK ---
    // Runs on every navigation (both hard loads and client-side URL changes).
    // If the current URL looks like an article, probes the Scribe instance and
    // redirects to it. If the instance is unreachable, shows the fallback page
    // instead. Non-article pages are left alone to load normally on Medium.
    function maybeRedirect() {
        var currentPath = window.location.pathname;   // e.g. "/@user/my-article-09a6af907a2"
        var currentQuery = window.location.search;    // e.g. "?source=rss"

        // Only redirect if this looks like an article URL
        if (!isArticleUrl(currentPath)) return;

        // Build the Scribe URL using the URL constructor for safe, well-formed output.
        // This correctly handles any unusual characters in the path or query string.
        var cleanQuery = stripTrackingParams(currentQuery);
        var newURL = new URL(currentPath + cleanQuery, EFFECTIVE_BASE).href;

        // Probe first: redirect only if the instance responds.
        // If the instance is down, show the fallback page (which removes the
        // body-hiding style) instead of a browser error page.
        // replace() is used so the Medium page doesn't appear in browser history,
        // meaning the back button won't loop the user back through Medium
        probe(EFFECTIVE_BASE, PROBE_TIMEOUT_MS).then(function(reachable) {
            if (reachable) {
                window.location.replace(newURL);
            } else {
                showUnreachable(style);
            }
        });
    }

    // --- HARD LOAD: run the check immediately on page load ---
    // This handles direct visits and links clicked from outside Medium
    // (e.g. from a search engine or another site). The body is already hidden
    // (see above), so there's no flash of Medium content.
    if (isArticleUrl(window.location.pathname)) {
        // It's an article — probe and redirect, keeping the body hidden unless
        // the instance turns out to be unreachable (the fallback page reveals it).
        maybeRedirect();
    } else {
        // Not an article — reveal the page and let Medium load normally
        style.remove();
    }

    // --- CLIENT-SIDE NAVIGATION: watch for URL changes within Medium ---
    // Medium is a single-page app. When you click a link inside Medium, the
    // browser doesn't reload the page — it just updates the URL via the History
    // API and swaps the content via JavaScript. document-start only fires once,
    // on the initial load, so we need to catch these internal navigations too.
    //
    // The browser fires "popstate" for back/forward navigation, but NOT for
    // pushState/replaceState (which is what Medium uses for in-app navigation).
    // We patch both so they emit a custom event, then listen for everything.
    // This is far cheaper than the previous whole-document MutationObserver,
    // which re-checked the URL on every single DOM mutation Medium produced.
    var lastPath = window.location.pathname; // Avoid reacting to no-op URL updates

    function onLocationChange() {
        if (window.location.pathname === lastPath) return;
        lastPath = window.location.pathname;
        maybeRedirect();
    }

    ['pushState', 'replaceState'].forEach(function(method) {
        try {
            var original = history[method].bind(history);
            history[method] = function() {
                var result = original.apply(history, arguments);
                window.dispatchEvent(new Event('medium-locationchange'));
                return result;
            };
        } catch (e) {
            // Patching failed — leave the original History method intact.
            // Back/forward navigation is still covered by the popstate listener.
        }
    });

    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('medium-locationchange', onLocationChange);

})();
