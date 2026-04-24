// =============================================================================
// Medium to Scribe Redirector
// =============================================================================
// Redirects Medium articles to Scribe (scribe.rip), preserving the URL path.
//
// VERSION: 1.0
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
//                  you prefer a different mirror.
//
// =============================================================================

// ==UserScript==
// @name         Medium to Scribe Redirector
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Redirects Medium articles to Scribe (scribe.rip), preserving
//               the URL path. Strips tracking parameters before redirecting.
// @author       You
// @match        *://medium.com/*
// @match        *://www.medium.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---

    // The Scribe instance all redirects will point to
    var SCRIBE_BASE = "https://scribe.rip";

    // --- GUARD: Don't redirect if we're already on Scribe ---
    // Prevents an infinite redirect loop if scribe.rip is somehow matched
    if (window.location.hostname === "scribe.rip") return;

    // --- GUARD: Don't redirect if we're inside an iframe ---
    // Prevents the script from breaking Medium embeds on third-party websites
    if (window.self !== window.top) return;

    // Immediately hide the page body so no Medium content flashes on screen
    // before the redirect fires
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // Grab useful parts of the current URL for building the Scribe redirect
    var currentPath = window.location.pathname;    // e.g. "/@user/my-article-09a6af907a2"
    var currentQuery = window.location.search;     // e.g. "?source=rss"

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

    // --- REDIRECT ---
    // Simple case: swap medium.com for scribe.rip, keeping the full path intact
    // e.g. medium.com/@user/my-post-09a6af907a2 → scribe.rip/@user/my-post-09a6af907a2
    var cleanQuery = stripTrackingParams(currentQuery);
    var newURL = SCRIBE_BASE + currentPath + cleanQuery;

    // replace() is used so the Medium page doesn't appear in browser history,
    // meaning the back button won't loop the user back through Medium
    window.location.replace(newURL);

})();
