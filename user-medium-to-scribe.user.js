// =============================================================================
// Medium to Scribe Redirector
// =============================================================================
// Redirects Medium articles to Scribe (scribe.rip), preserving the URL path.
//
// VERSION: 1.6
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
//                  you prefer a different mirror.
//
// =============================================================================

// ==UserScript==
// @name         Medium to Scribe Redirector
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      1.6
// @description  Redirects Medium articles to Scribe (scribe.rip), preserving
//               the URL path. Strips tracking parameters before redirecting.
// @author       NoIdeaDeveloper
// @license      MIT
// @match        *://medium.com/*
// @match        *://www.medium.com/*
// @match        *://*.medium.com/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-medium-to-scribe.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-medium-to-scribe.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---

    // The Scribe instance all redirects will point to.
    // Must use https:// — enforced and validated below before any redirect fires.
    var SCRIBE_BASE = "https://scribe.rip";

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

    // Hostname of the Scribe instance, used for the loop-prevention guard below.
    var SCRIBE_HOST = new URL(SCRIBE_BASE).hostname;

    // --- GUARD: Don't redirect if we're already on Scribe ---
    // Prevents an infinite redirect loop if scribe.rip is somehow matched
    if (window.location.hostname === SCRIBE_HOST) return;

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

    // --- REDIRECT CHECK ---
    // Runs on every navigation (both hard loads and client-side URL changes).
    // If the current URL looks like an article, redirects to Scribe.
    // Otherwise does nothing, allowing the page to load normally on Medium.
    function maybeRedirect() {
        var currentPath = window.location.pathname;   // e.g. "/@user/my-article-09a6af907a2"
        var currentQuery = window.location.search;    // e.g. "?source=rss"

        // Only redirect if this looks like an article URL
        if (!isArticleUrl(currentPath)) return;

        // Build the Scribe URL using the URL constructor for safe, well-formed output.
        // This correctly handles any unusual characters in the path or query string.
        var cleanQuery = stripTrackingParams(currentQuery);
        var newURL = new URL(currentPath + cleanQuery, SCRIBE_BASE).href;

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
