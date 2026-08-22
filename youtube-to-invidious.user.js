// ==UserScript==
// @name         YouTube to Invidious Redirector
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      1.5
// @description  Redirects YouTube to an Invidious instance, preserving video IDs, search queries, and channel pages
// @author       NoIdeaDeveloper
// @license      MIT
// @match        *://*.youtube.com/*
// @match        *://youtu.be/*
// @match        *://www.youtube-nocookie.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/youtube-to-invidious.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/youtube-to-invidious.user.js
// ==/UserScript==

// NOTE: This is the simpler, older version of the YouTube redirector.
// It probes the configured instance before redirecting and shows a fallback
// message if it's down. For a full-featured version with embed replacement,
// DuckDuckGo integration, and SPA navigation handling, use
// user-youtube-to-invidious.user.js instead.

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

    // The master on/off switch for this script. When false, the script does
    // nothing (no redirect) and the settings panel is still shown so it can be
    // re-enabled. Persisted in storage so it survives updates.
    var ENABLED_KEY = 'yt.simple.enabled';
    function isEnabled() { return !!storeGet(ENABLED_KEY, true); }

    // --- CONFIGURATION ---
    // Replace this with your preferred Invidious instance
    var invidious = "https://inv.nadeko.net";

    // --- OPTIONAL: URL PARAMETERS ---
    // These are appended to video and page URLs to customise your Invidious experience.
    // Set either to an empty string "" to disable them.
    // For URLs that already have a "?" (e.g. /watch?v=...), parameters start with "&"
    var videoParams = "&related_videos=false&comments=false";
    // For URLs that don't have a "?" (e.g. channel pages), parameters start with "?"
    var pageParams = "?related_videos=false&comments=false";

    // How long (ms) to wait for the instance to respond before showing the fallback page
    var PROBE_TIMEOUT_MS = 2500;

    // --- GUARD: Validate and normalise the configured Invidious instance ---
    // Parse the configured value and force it to a bare https origin. Anything
    // that isn't a valid http(s) URL falls back to the known-good default, so a
    // typo can never send you to a junk or non-https destination, and a malformed
    // value can't throw an uncaught error that kills the whole script.
    try {
        var parsedInstance = new URL(invidious);
        if (parsedInstance.protocol !== 'https:' && parsedInstance.protocol !== 'http:') {
            throw new Error('unsupported protocol');
        }
        invidious = 'https://' + parsedInstance.host;
    } catch (e) {
        invidious = 'https://inv.nadeko.net';
    }

    // Optional user override (set via the settings panel on the Invidious
    // instance). Validated the same way as the in-file default; if it's
    // non-empty and a valid http(s) URL it takes precedence and becomes the
    // redirect target. Malformed or blank values are ignored, leaving the
    // validated default above in effect.
    try {
        var storedInstance = storeGet('yt.simple.instance', '');
        if (storedInstance) {
            var parsedOverride = new URL(storedInstance);
            if (parsedOverride.protocol === 'https:' || parsedOverride.protocol === 'http:') {
                invidious = 'https://' + parsedOverride.host; // force https, drop any path/query
            }
        }
    } catch (e) { /* ignore malformed override — keep the in-file default */ }

    // --- GUARD: one-time bypass ---
    // Appending "#noredirect" to a YouTube URL skips the redirect for that
    // navigation only (the fragment isn't sent to the server and doesn't
    // survive the redirect). Use it as an escape hatch to reach YouTube itself.
    var bypass = /(?:^|[#&])noredirect(?:[=&]|$)/.test(window.location.hash || '');
    if (bypass) {
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        return; // Skip the whole redirect for this visit
    }

    // --- GUARD: script disabled via the settings panel ---
    var enabled = !!storeGet(ENABLED_KEY, true);

    // --- GUARD: Don't redirect if we're already on the Invidious instance ---
    // The settings panel is shown here regardless of the enabled flag, so a
    // disabled script can always be re-enabled from the instance itself.
    if (window.location.hostname === new URL(invidious).hostname) {
        whenHead(function() {
            buildSettingsPanel({
                title: 'YouTube → Invidious',
                fields: [
                    { key: 'instance', label: 'Invidious instance:', placeholder: 'https://inv.example.com', value: storeGet('yt.simple.instance', invidious) }
                ],
                onSave: function(v) {
                    storeSet('yt.simple.instance', v.instance);
                }
            });
        });
        return;
    }

    // If the script is disabled via the settings panel, stop here (after the
    // on-instance panel guard above so re-enabling stays possible).
    if (!enabled) return;

    // Register a menu command to note where the settings panel lives.
    registerMenu('YouTube → Invidious settings', function() { /* panel lives on the instance */ });

    // --- GUARD: Don't redirect if we're inside an iframe ---
    if (window.self !== window.top) {
        return;
    }

    // Hide the page immediately so no YouTube content flashes on screen
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // Grab the current host, path, and query for matching against our rules.
    // We match on hostname + pathname rather than substring-testing the whole
    // URL string, so a value like "?q=youtube.com/watch" in the query can never
    // be mistaken for an actual YouTube path.
    var host = window.location.hostname;
    var path = window.location.pathname;
    var query = window.location.search;

    // True for youtube.com and any of its subdomains (www, m, music, …)
    var isYouTube = (host === 'youtube.com' || host.endsWith('.youtube.com'));
    // True for the privacy-enhanced youtube-nocookie.com embed domain
    var isNoCookie = host.endsWith('youtube-nocookie.com');

    // --- PROBE THE INSTANCE'S REACHABILITY ---
    // Sends a lightweight no-cors HEAD request with a hard timeout. A no-cors
    // request resolves for any HTTP response and rejects on a genuine network
    // failure (DNS error, connection refused, TLS failure) — exactly the
    // "instance is down" case. YouTube's CSP allows connect-src to any origin,
    // so a plain fetch works here (unlike on Reddit — see the Redlib scripts).
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
    // Built with safe DOM methods (textContent / setAttribute), never innerHTML,
    // so nothing in the URL can be interpreted as markup.
    var invidiousHost = new URL(invidious).hostname;
    function showUnreachable(newURL, styleEl) {
        function render() {
            if (styleEl) styleEl.remove(); // Reveal the page so it isn't just blank
            document.body.innerHTML = '';
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'font-family:sans-serif;text-align:center;padding:3rem;color:#333;';
            var heading = document.createElement('h2');
            heading.textContent = 'Invidious instance unreachable';
            heading.style.cssText = 'margin:0 0 0.5rem;';
            var para = document.createElement('p');
            para.style.cssText = 'color:#666;margin:0 0 1.5rem;';
            var strong = document.createElement('strong');
            strong.textContent = invidiousHost; // textContent: safe, no HTML interpretation
            para.appendChild(strong);
            para.appendChild(document.createTextNode(' could not be reached.'));
            var tryLink = document.createElement('a');
            tryLink.setAttribute('href', newURL); // setAttribute: safe, treats value as literal
            tryLink.textContent = 'Try opening it directly';
            tryLink.style.cssText = 'color:#336699;';
            var separator = document.createTextNode(' · ');
            var findLink = document.createElement('a');
            findLink.setAttribute('href', 'https://api.invidious.io');
            findLink.setAttribute('target', '_blank');
            findLink.setAttribute('rel', 'noopener noreferrer');
            findLink.textContent = 'Find another instance';
            findLink.style.cssText = 'color:#336699;';
            wrapper.appendChild(heading);
            wrapper.appendChild(para);
            wrapper.appendChild(tryLink);
            wrapper.appendChild(separator);
            wrapper.appendChild(findLink);
            document.body.appendChild(wrapper);
        }
        // The body may not exist yet at document-start — wait if necessary.
        if (document.body) render();
        else document.addEventListener('DOMContentLoaded', render);
    }

    // Helper function that performs the redirect.
    // Probes the Invidious instance first; if it responds, navigate with
    // replace() so the YouTube page won't appear in your browser history.
    // If it's unreachable, show a clear message instead of a browser error page.
    function redirect(newURL) {
        probe(invidious, PROBE_TIMEOUT_MS).then(function(reachable) {
            if (reachable) {
                window.location.replace(newURL);
            } else {
                showUnreachable(newURL, style);
            }
        });
    }

    // --- TRACKING PARAMETER STRIPPER ---
    function stripTrackingParams(queryString) {
        if (!queryString) return '';

        var params = new URLSearchParams(queryString);
        var trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign',
            'utm_term', 'utm_content',
            'si', 'pp', 'feature', 'ab_channel'
        ];

        trackingParams.forEach(function(param) {
            params.delete(param);
        });

        return params.toString() ? '?' + params.toString() : '';
    }

    // --- RULE 1: YouTube video URLs (e.g. youtube.com/watch?v=ABC123) ---
    // Check the parsed "v" value directly rather than a loose query.includes("v=")
    // test, which would also fire for unrelated params like "?srv=1".
    // Video IDs are encoded so any unexpected characters can't break out of the
    // query string (real IDs are [A-Za-z0-9_-], but a crafted link could differ).
    if (isYouTube && path === '/watch') {
        var videoID = new URLSearchParams(query).get("v");
        if (videoID) {
            var timestamp = new URLSearchParams(query).get("t") || "";
            redirect(invidious + "/watch?v=" + encodeURIComponent(videoID)
                + (timestamp ? "&t=" + encodeURIComponent(timestamp) : "")
                + videoParams);
            return;
        }
    }

    // --- RULE 2: youtu.be short URLs (e.g. youtu.be/ABC123?t=35) ---
    if (host === "youtu.be") {
        var shortID = path.substring(1);
        if (shortID) {
            var cleanQuery = stripTrackingParams(query);
            var queryPart = cleanQuery ? cleanQuery.replace("?", "&") : "";
            redirect(invidious + "/watch?v=" + encodeURIComponent(shortID) + queryPart + videoParams);
            return;
        }
    }

    // --- RULE 3: YouTube search results (e.g. youtube.com/results?search_query=cats) ---
    if (isYouTube && path === '/results') {
        var searchQuery = new URLSearchParams(query).get("search_query");
        if (searchQuery) {
            redirect(invidious + "/search?q=" + encodeURIComponent(searchQuery));
            return;
        }
    }

    // --- RULE 4: Standard YouTube embeds (e.g. youtube.com/embed/ABC123) ---
    if (isYouTube && path.indexOf('/embed/') === 0) {
        var embedID = (path.split('/embed/')[1] || '').split('/')[0];
        if (embedID) {
            redirect(invidious + "/embed/" + encodeURIComponent(embedID));
            return;
        }
    }

    // --- RULE 5: YouTube nocookie embeds (e.g. youtube-nocookie.com/embed/ABC123) ---
    if (isNoCookie && path.indexOf('/embed/') === 0) {
        var noCookieID = (path.split('/embed/')[1] || '').split('/')[0];
        if (noCookieID) {
            redirect(invidious + "/embed/" + encodeURIComponent(noCookieID));
            return;
        }
    }

    // --- RULE 6: All other YouTube pages (e.g. channel pages, homepage) ---
    if (isYouTube) {
        var cleanPageQuery = stripTrackingParams(query);
        var pageSuffix = cleanPageQuery
            ? cleanPageQuery + pageParams.replace("?", "&")
            : pageParams;
        redirect(invidious + path + pageSuffix);
        return;
    }

    // --- SAFETY NET: no rule matched ---
    // Reaches here on YouTube-ish domains none of the rules handle (e.g. a
    // top-level youtube-nocookie.com page, whose host doesn't contain
    // "youtube.com"). Reveal the page so the user isn't left on a blank screen.
    style.remove();

})();
