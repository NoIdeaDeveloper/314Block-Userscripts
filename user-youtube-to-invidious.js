// =============================================================================
// YouTube to Invidious Redirector
// =============================================================================
// Redirects YouTube to a private Invidious instance, preserving video IDs,
// search queries, shorts, playlists, and channel pages. Replaces embedded
// YouTube videos with a privacy-friendly overlay linking to Invidious instead.
//
// VERSION: 2.0
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
//            Name:   youtube-to-invidious
//            Code:   Paste everything from the (function() { line downward
//                    Do NOT include these comment instructions in the paste
//         Then click "Save"
//         Note: Brave automatically adds a "user-" prefix to the name,
//               so it will be saved as "user-youtube-to-invidious"
//
// STEP 4: Scroll up to the "Custom filters" text box on the same page
//         and add the following three lines exactly as shown:
//
//            youtube.com##+js(user-youtube-to-invidious.js)
//            youtu.be##+js(user-youtube-to-invidious.js)
//            youtube-nocookie.com##+js(user-youtube-to-invidious.js)
//
//         Then click "Save changes"
//
// STEP 5: Make sure Brave Shields is enabled (the lion icon in the address
//         bar should NOT be crossed out) when visiting YouTube
//
// STEP 6: Visit youtube.com to confirm the redirect is working
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
// STEP 6: Visit youtube.com to confirm the redirect is working
//
// -----------------------------------------------------------------------------
//
// =============================================================================
// CONFIGURATION
// =============================================================================
//
// Before installing, you may want to customise the following values inside
// the script below:
//
//   invidious    — The Invidious instance to redirect to.
//                  Default: "https://inv.nadeko.net"
//                  Find alternative instances at: https://api.invidious.io
//
//   videoParams  — Parameters appended to video watch URLs.
//                  Default: "&related_videos=false&comments=false"
//                  Set to "" to disable.
//
//   pageParams   — Parameters appended to all other Invidious page URLs.
//                  Default: "?related_videos=false&comments=false"
//                  Set to "" to disable.
//
// =============================================================================

// ==UserScript==
// @name         YouTube to Invidious Redirector
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Redirects YouTube to a private Invidious instance, preserving
//               video IDs, search queries, shorts, playlists, and channel pages.
//               Replaces embedded YouTube videos with a privacy overlay.
// @author       You
// @match        *://*.youtube.com/*
// @match        *://youtu.be/*
// @match        *://www.youtube-nocookie.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    // Replace this with your preferred Invidious instance
    // Find available instances at: https://api.invidious.io
    var invidious = "https://inv.nadeko.net";

    // --- OPTIONAL: URL PARAMETERS ---
    // Appended to video URLs to customise your Invidious experience
    // "&" prefix is used because video URLs already have a "?" (e.g. /watch?v=...)
    var videoParams = "&related_videos=false&comments=false";
    // "?" prefix is used for pages that don't already have a query string
    var pageParams = "?related_videos=false&comments=false";

    // --- GUARD: Don't redirect if we're already on the Invidious instance ---
    // Prevents redirect loops if the scriptlet ever runs on the Invidious page itself
    if (window.location.hostname === new URL(invidious).hostname) {
        return;
    }

    // --- GUARD: Don't redirect if we're inside an iframe ---
    // Instead of doing nothing, we replace the embed with a privacy-friendly overlay
    // that lets the user choose to open the video on Invidious instead
    if (window.self !== window.top) {

        // Wait for the body to be available before we can modify the page
        // (since we run at document-start, the body may not exist yet)
        document.addEventListener('DOMContentLoaded', function() {

            // Extract the video ID from the current embed URL
            // e.g. youtube.com/embed/ABC123 → ABC123
            var embedPath = window.location.pathname;
            var videoID = embedPath.replace("/embed/", "");

            // Also check for a start time parameter (?start=35 or ?t=35)
            // so the Invidious link can pick up at the same point in the video
            var params = new URLSearchParams(window.location.search);
            var startTime = params.get("start") || params.get("t") || null;

            // Build the Invidious link, appending the timestamp if one exists
            var invidiousURL = invidious + "/watch?v=" + videoID
                + (startTime ? "&t=" + startTime : "")
                + videoParams;

            // --- BUILD THE OVERLAY ---
            // Style the overlay to fill the entire embed frame
            var overlay = document.createElement('div');
            overlay.style.cssText = [
                'position: fixed',        // Fill the whole iframe viewport
                'top: 0',
                'left: 0',
                'width: 100%',
                'height: 100%',
                'background: #0f0f0f',    // Dark background matching Invidious/YouTube palette
                'display: flex',
                'flex-direction: column',
                'align-items: center',
                'justify-content: center',
                'font-family: sans-serif',
                'z-index: 99999',         // Sit on top of everything in the iframe
                'box-sizing: border-box',
                'padding: 16px',
                'text-align: center'
            ].join('; ');

            // Lock/shield icon to visually communicate privacy
            var icon = document.createElement('div');
            icon.textContent = '🔒';
            icon.style.cssText = 'font-size: 2rem; margin-bottom: 8px;';

            // Short explanation of why the embed is blocked
            var message = document.createElement('p');
            message.textContent = 'YouTube embed blocked for privacy.';
            message.style.cssText = [
                'color: #aaa',
                'font-size: 0.85rem',
                'margin: 0 0 16px 0'
            ].join('; ');

            // The main clickable link to open the video on Invidious
            var link = document.createElement('a');
            link.href = invidiousURL;
            link.textContent = '▶  Watch on Invidious';
            link.target = '_blank';           // Open in a new tab
            link.rel = 'noopener noreferrer'; // Security best practice for target="_blank"
            link.style.cssText = [
                'color: #fff',
                'background: #336699',    // Muted blue — avoids mimicking YouTube red
                'padding: 10px 20px',
                'border-radius: 6px',
                'text-decoration: none',
                'font-size: 1rem',
                'font-weight: bold'
            ].join('; ');

            // Assemble and inject the overlay into the page
            overlay.appendChild(icon);
            overlay.appendChild(message);
            overlay.appendChild(link);
            document.body.appendChild(overlay);
        });

        // Stop here — don't run any of the redirect rules below
        return;
    }

    // Hide the page immediately to prevent YouTube content flashing on screen
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // Grab the current URL, path, and query string for use in our redirect rules
    var url = window.location.href;
    var path = window.location.pathname;
    var query = window.location.search;

    // Performs the redirect — using replace() so YouTube doesn't appear in browser history
    function redirect(newURL) {
        window.location.replace(newURL);
    }

    // Checks if a URL already contains our custom parameters
    // Prevents infinite redirect loops when we're already on an Invidious page
    function alreadyHasParams(url, params) {
        // Strip the leading "&" or "?" before checking
        return url.includes(params.substring(1));
    }

    // --- TRACKING PARAMETER STRIPPER ---
    // Removes YouTube/Google analytics parameters from the query string
    // These are meaningless on Invidious and just add noise to the URL
    function stripTrackingParams(queryString) {
        if (!queryString) return '';

        var params = new URLSearchParams(queryString);

        // List of known YouTube/Google tracking parameters to remove
        var trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', // Generic UTM tracking
            'utm_term', 'utm_content',                   // More UTM params
            'si',                                        // YouTube share tracking ID
            'pp',                                        // YouTube personalisation parameter
            'feature',                                   // YouTube internal feature tracking
            'ab_channel'                                 // YouTube A/B channel testing param
        ];

        // Delete each tracking param if present
        trackingParams.forEach(function(param) {
            params.delete(param);
        });

        // Return the cleaned query string, or empty string if nothing remains
        return params.toString() ? '?' + params.toString() : '';
    }

    // --- RULE 1: Standard YouTube video URLs (e.g. youtube.com/watch?v=ABC123) ---
    if (url.includes("youtube.com/watch") && query.includes("v=")) {
        var videoID = new URLSearchParams(query).get("v"); // Extract just the video ID
        redirect(invidious + "/watch?v=" + videoID + videoParams);
        return;
    }

    // --- RULE 2: youtu.be short URLs (e.g. youtu.be/ABC123?t=35) ---
    if (window.location.hostname === "youtu.be") {
        var shortID = path.substring(1); // Remove the leading "/" to get just the video ID

        // Strip tracking params but preserve legitimate ones like timestamps (?t=35)
        var cleanQuery = stripTrackingParams(query);

        // Convert any remaining "?" to "&" since we're appending to an existing query string
        var queryPart = cleanQuery ? cleanQuery.replace("?", "&") : "";
        redirect(invidious + "/watch?v=" + shortID + queryPart + videoParams);
        return;
    }

    // --- RULE 3: YouTube search results (e.g. youtube.com/results?search_query=cats) ---
    if (url.includes("youtube.com/results") && query.includes("search_query=")) {
        var searchQuery = new URLSearchParams(query).get("search_query"); // Extract search term
        redirect(invidious + "/search?q=" + encodeURIComponent(searchQuery));
        return;
    }

    // --- RULE 4: YouTube Shorts (e.g. youtube.com/shorts/ABC123) ---
    // Shorts use the same player as regular videos, just with a different URL format
    // Without this rule they would hit the catch-all and likely land on a broken page
    if (url.includes("youtube.com/shorts/")) {
        var shortsID = path.replace("/shorts/", ""); // Extract the video ID from the path
        redirect(invidious + "/watch?v=" + shortsID + videoParams);
        return;
    }

    // --- RULE 5: Standard YouTube embeds (e.g. youtube.com/embed/ABC123) ---
    // Note: at this point we are NOT in an iframe (that was handled above)
    // This handles the case where someone navigates directly to an embed URL
    if (url.includes("youtube.com/embed/")) {
        var embedID = path.replace("/embed/", ""); // Strip "/embed/" to get the video ID
        redirect(invidious + "/embed/" + embedID);
        return;
    }

    // --- RULE 6: YouTube nocookie embeds (e.g. youtube-nocookie.com/embed/ABC123) ---
    if (url.includes("youtube-nocookie.com/embed/")) {
        var noCookieID = path.replace("/embed/", "");
        redirect(invidious + "/embed/" + noCookieID);
        return;
    }

    // --- RULE 7: YouTube Playlist URLs (e.g. youtube.com/playlist?list=ABC123) ---
    // Without this rule playlists would hit the catch-all and likely break on Invidious
    // Invidious supports playlists natively at /playlist?list=
    if (url.includes("youtube.com/playlist") && query.includes("list=")) {
        var playlistID = new URLSearchParams(query).get("list"); // Extract playlist ID
        redirect(invidious + "/playlist?list=" + playlistID);
        return;
    }

    // --- RULE 8: All other YouTube pages (channels, homepage, etc.) ---
    // Broadest/catch-all rule — must remain last so it doesn't swallow specific rules above
    if (url.includes("youtube.com")) {
        var cleanPageQuery = stripTrackingParams(query); // Strip tracking before redirecting
        redirect(invidious + path + cleanPageQuery + pageParams);
        return;
    }

})();
