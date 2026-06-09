// =============================================================================
// Reddit to Redlib Redirector (Random Instance)
// =============================================================================
// Redirects Reddit to a randomly selected, reachable Redlib instance,
// preserving the URL path and query string. Strips known Reddit tracking
// parameters from URLs before redirecting.
//
// VERSION: 6.1
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
// @version      6.1
// @description  Redirects Reddit to a randomly selected, reachable Redlib
//               instance, preserving the URL path and query string. Probes
//               instances and rolls on to the next if one is down. Strips
//               tracking parameters before redirecting.
// @author       NoIdeaDeveloper
// @license      MIT
// @match        *://*.reddit.com/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-reddit-to-redlib.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-reddit-to-redlib.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---

    // Hardcoded list of clearnet Redlib instances
    // Source: https://raw.githubusercontent.com/redlib-org/redlib-instances/refs/heads/main/instances.json
    // Last updated: 2026-01-31
    // .onion and .i2p instances are intentionally excluded — normal browsers cannot reach them
    var INSTANCES = [
        "https://l.opnxng.com",           // SG
        "https://redlib.catsarch.com",    // US
        "https://redlib.perennialte.ch",  // AU
        "https://redlib.r4fo.com",        // DE
        "https://red.artemislena.eu",     // DE
        "https://redlib.cow.rip",         // IN
        "https://redlib.nadeko.net",      // CL
        "https://redlib.orangenet.cc",    // SI
        "https://redlib.privadency.com",  // DE
    ];

    // Fallback used only if INSTANCES is somehow empty
    var FALLBACK = "https://redlib.perennialte.ch";

    // How long (ms) to wait for an instance to respond before moving on
    var PROBE_TIMEOUT_MS = 2500;

    // --- GUARD: Don't redirect if we're already on a Redlib instance ---
    // Checks the current hostname against every instance in the list
    var currentHost = window.location.hostname;
    var alreadyOnRedlib = INSTANCES.some(function(url) {
        try {
            return new URL(url).hostname === currentHost;
        } catch(e) {
            return false; // Skip malformed URLs
        }
    });
    if (alreadyOnRedlib) return;

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
    // Sends a lightweight no-cors HEAD request with a hard timeout. A no-cors
    // request resolves for any HTTP response (we can't read the status, but we
    // don't need to) and rejects on a genuine network failure — DNS error,
    // connection refused, or TLS failure — which is exactly the "instance is
    // down" case we want to detect. This replaces the previous approach of
    // listening for a window "error" event after navigating, which never
    // actually fired for failed top-level navigations.
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
    // first that responds. If none respond, show the fallback page.
    var candidates = shuffled(INSTANCES.length ? INSTANCES : [FALLBACK]);

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
