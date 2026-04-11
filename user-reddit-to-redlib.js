// =============================================================================
// Reddit to Redlib Redirector (Random Instance)
// =============================================================================
// Redirects Reddit to a randomly selected Redlib instance, preserving the URL
// path and query string. Strips known Reddit tracking parameters from URLs
// before redirecting.
//
// VERSION: 5.0
// AUTHOR:  You
// LICENSE: MIT
// REPO:    https://github.com/yourusername/yourrepo
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
//            www.reddit.com##+js(user-reddit-to-redlib.js)
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
// A random instance is picked from the hardcoded list below on every visit.
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
// You can customise the following values inside the script below:
//
//   INSTANCES  — The hardcoded list of Redlib instances to randomly pick from.
//                .onion and .i2p addresses are excluded as normal browsers
//                cannot reach them.
//
//   FALLBACK   — Used if the INSTANCES array is somehow empty. Should be
//                a reliable instance you trust.
//
// =============================================================================

// ==UserScript==
// @name         Reddit to Redlib Redirector (Random Instance)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Redirects Reddit to a randomly selected Redlib instance,
//               preserving the URL path and query string. Strips tracking
//               parameters before redirecting.
// @author       You
// @match        *://www.reddit.com/*
// @run-at       document-start
// @grant        none
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

    // --- RANDOM INSTANCE PICKER ---
    // Selects a random instance from the INSTANCES array on every visit
    function pickRandomInstance() {
        // Safety check — fall back to hardcoded instance if the list is empty
        if (!INSTANCES.length) return FALLBACK;

        // Math.random() produces a different value on every call
        var randomIndex = Math.floor(Math.random() * INSTANCES.length);
        return INSTANCES[randomIndex];
    }

    // --- REDIRECT ---
    // Strip tracking params, pick a random instance, and redirect
    var cleanQuery = stripTrackingParams(currentQuery);
    var chosenInstance = pickRandomInstance();

    // Combine the chosen instance with Reddit's cleaned path and query string
    // e.g. reddit.com/r/cats?sort=new → redlib.nadeko.net/r/cats?sort=new
    var newURL = chosenInstance + currentPath + cleanQuery;

    // replace() means Reddit won't appear in the browser history
    window.location.replace(newURL);

})();
