// =============================================================================
// Medium to Scribe Redirector
// =============================================================================
// Redirects Medium articles to Scribe (scribe.rip), preserving the URL path.
//
// VERSION: 1.4
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
// @version      1.4
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

    // The Scribe instance all redirects will point to.
    // Must use https:// — enforced below before any redirect fires.
    var SCRIBE_BASE = "https://scribe.rip";

    // --- GUARD: Enforce HTTPS on the configured Scribe instance ---
    // If SCRIBE_BASE were accidentally changed to http://, this corrects it.
    // Ensures your browsing is always sent over an encrypted connection.
    if (SCRIBE_BASE.indexOf("https://") !== 0) {
        SCRIBE_BASE = SCRIBE_BASE.replace(/^http:\/\//i, "https://");
    }

    // --- GUARD: Don't redirect if we're already on Scribe ---
    // Prevents an infinite redirect loop if scribe.rip is somehow matched
    if (window.location.hostname === "scribe.rip") return;

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
        // Regex: hyphen, then 8–14 lowercase hex characters, at end of path
        return /-[a-f0-9]{8,14}$/i.test(path);
    }

    // --- REDIRECT CHECK ---
    // Runs on every navigation (both hard loads and client-side URL changes).
    // If the current URL looks like an article, redirects to Scribe.
    // Otherwise does nothing, allowing the page to load normally on Medium.
    // Accepts the observer so it can be disconnected cleanly before redirecting.
    function maybeRedirect(observer) {
        var currentPath = window.location.pathname;   // e.g. "/@user/my-article-09a6af907a2"
        var currentQuery = window.location.search;    // e.g. "?source=rss"

        // Only redirect if this looks like an article URL
        if (!isArticleUrl(currentPath)) return;

        // Build the Scribe URL using the URL constructor for safe, well-formed output.
        // This correctly handles any unusual characters in the path or query string.
        var cleanQuery = stripTrackingParams(currentQuery);
        var newURL = new URL(currentPath + cleanQuery, SCRIBE_BASE).href;

        // Stop observing DOM changes before navigating away — tidies up and
        // prevents any theoretical double-fire during the redirect transition.
        if (observer) observer.disconnect();

        // replace() is used so the Medium page doesn't appear in browser history,
        // meaning the back button won't loop the user back through Medium
        window.location.replace(newURL);
    }

    // --- HARD LOAD: run the check immediately on page load ---
    // This handles direct visits and links clicked from outside Medium
    // (e.g. from a search engine or another site).
    // We also hide the body briefly to prevent a flash of Medium content.
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    if (isArticleUrl(window.location.pathname)) {
        // It's an article — redirect immediately, keeping the body hidden.
        // No observer exists yet at this point, so we pass null.
        maybeRedirect(null);
    } else {
        // Not an article — reveal the page and let Medium load normally
        style.remove();
    }

    // --- CLIENT-SIDE NAVIGATION: watch for URL changes within Medium ---
    // Medium is a single-page app. When you click a link inside Medium, the
    // browser doesn't reload the page — it just updates the URL and swaps
    // the content via JavaScript. This means document-start only fires once,
    // on the initial load. To catch these internal navigations, we use a
    // MutationObserver to watch for DOM changes and check the URL each time.
    var lastPath = window.location.pathname; // Track the last seen path to avoid double-firing

    var observer = new MutationObserver(function() {
        var newPath = window.location.pathname;

        // Only act if the URL path has actually changed since we last checked
        if (newPath === lastPath) return;
        lastPath = newPath; // Update our record of the current path

        // Run the same redirect check as on a hard load, passing the observer
        // so it can be disconnected cleanly if a redirect is triggered
        maybeRedirect(observer);
    });

    // Observe the entire document for any DOM changes.
    // subtree: true catches changes anywhere in the page, not just direct children.
    // childList: true fires when elements are added or removed (covers page transitions).
    observer.observe(document.documentElement, { subtree: true, childList: true });

})();
