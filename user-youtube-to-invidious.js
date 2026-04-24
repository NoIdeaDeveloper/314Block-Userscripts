// =============================================================================
// YouTube to Invidious Redirector
// =============================================================================
// Redirects YouTube to a configured Invidious instance, preserving the video
// ID, timestamps, search queries, and playlists. Strips tracking parameters.
// Replaces YouTube embeds in iframes with a privacy-friendly overlay.
//
// VERSION: 2.1
// LICENSE: MIT
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
//         and add the following lines exactly as shown:
//
//            www.youtube.com##+js(user-youtube-to-invidious.js)
//            youtube.com##+js(user-youtube-to-invidious.js)
//            youtu.be##+js(user-youtube-to-invidious.js)
//            www.youtube-nocookie.com##+js(user-youtube-to-invidious.js)
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
// CHANGING YOUR INVIDIOUS INSTANCE
// =============================================================================
//
// The script is pre-configured with "https://inv.nadeko.net" as the default
// Invidious instance. If this instance is slow or unavailable, you can switch
// to any other public instance:
//
//   1. Visit https://api.invidious.io to find a list of active instances
//   2. Copy the URL of your preferred instance
//   3. Replace the value of the "invidious" variable near the top of the script
//   4. Re-save the script in Brave or Tampermonkey
//
// =============================================================================
// CONFIGURATION
// =============================================================================
//
//   invidious    — The Invidious instance all redirects will point to.
//                  Must begin with https://
//
//   videoParams  — Query parameters appended to video watch URLs.
//                  Customise to control Invidious player behaviour.
//                  See your instance's settings page for available options.
//
//   pageParams   — Same as videoParams but for non-video pages
//                  (channels, homepage, search results, etc.)
//
// =============================================================================

// ==UserScript==
// @name         YouTube to Invidious Redirector
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Redirects YouTube to a configured Invidious instance,
//               preserving video IDs, timestamps, search queries, and
//               playlists. Strips tracking parameters. Replaces embeds
//               with a privacy-friendly overlay.
// @author       You
// @match        *://www.youtube.com/*
// @match        *://youtube.com/*
// @match        *://youtu.be/*
// @match        *://www.youtube-nocookie.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---

    // Your preferred Invidious instance.
    // Find available instances at: https://api.invidious.io
    var invidious = "https://inv.nadeko.net";

    // --- OPTIONAL: URL PARAMETERS ---
    // Appended to video URLs to customise your Invidious experience.
    // "&" prefix: used for video URLs that already have a "?" (e.g. /watch?v=...)
    // "?" prefix: used for pages that don't already have a query string
    var videoParams = "&related_videos=false&comments=false";
    var pageParams = "?related_videos=false&comments=false";

    // --- GUARD: Enforce HTTPS on the configured Invidious instance ---
    // If the instance URL were accidentally set to http://, this corrects it.
    // Ensures browsing is always sent over an encrypted connection.
    if (invidious.indexOf("https://") !== 0) {
        invidious = invidious.replace(/^http:\/\//i, "https://");
    }

    // --- GUARD: Don't redirect if we're already on the Invidious instance ---
    // Prevents redirect loops if the scriptlet ever runs on the Invidious page itself
    if (window.location.hostname === new URL(invidious).hostname) {
        return;
    }

    // --- GUARD: Don't redirect if we're inside an iframe ---
    // Instead of doing nothing, we replace the embed with a privacy-friendly overlay
    // that lets the user choose to open the video on Invidious instead.
    if (window.self !== window.top) {

        // Hide the iframe body immediately to prevent any YouTube content flashing
        // on screen before the overlay is injected. Mirrors the approach used on
        // the main redirect path.
        var iframeStyle = document.createElement('style');
        iframeStyle.textContent = 'body { display: none !important; }';
        document.documentElement.appendChild(iframeStyle);

        // Wait for the body to be available before we can modify the page
        // (since we run at document-start, the body may not exist yet)
        document.addEventListener('DOMContentLoaded', function() {

            // Reveal the body now that we're ready to inject our overlay
            iframeStyle.remove();

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

    // --- REDIRECT FUNCTION ---
    // Performs the redirect using replace() so YouTube doesn't appear in
    // browser history. Also registers an error handler so that if the
    // Invidious instance is unreachable, the user sees a clear message
    // rather than a silent browser error page.
    function redirect(newURL) {
        // Listen for a page error after navigation — if Invidious is down or
        // unreachable, reveal a user-friendly message explaining what happened.
        window.addEventListener('error', function() {
            style.remove(); // Reveal the page so it isn't just blank
            document.body.innerHTML = [
                '<div style="font-family:sans-serif;text-align:center;padding:3rem;color:#333;">',
                '  <div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>',
                '  <h2 style="margin:0 0 0.5rem;">Invidious instance unreachable</h2>',
                '  <p style="color:#666;margin:0 0 1.5rem;">',
                '    <strong>' + new URL(newURL).hostname + '</strong> could not be reached.',
                '  </p>',
                '  <a href="' + newURL + '" style="color:#336699;">Try opening it directly</a>',
                '  &nbsp;·&nbsp;',
                '  <a href="https://api.invidious.io" target="_blank" rel="noopener noreferrer" style="color:#336699;">',
                '    Find another instance',
                '  </a>',
                '</div>'
            ].join('');
        }, { once: true }); // Bind once — we only need to catch the first error

        window.location.replace(newURL);
    }

    // --- TRACKING PARAMETER STRIPPER ---
    // Removes YouTube/Google analytics parameters from the query string.
    // These are meaningless on Invidious and just add noise to the URL.
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

    // --- RULE 1: Standard YouTube video URLs (e.g. youtube.com/watch?v=ABC123&t=35) ---
    if (url.includes("youtube.com/watch") && query.includes("v=")) {
        var parsedQuery = new URLSearchParams(query);
        var videoID = parsedQuery.get("v");           // Extract the video ID
        var timestamp = parsedQuery.get("t") || "";   // Preserve timestamp if present (e.g. &t=35)
        redirect(invidious + "/watch?v=" + videoID
            + (timestamp ? "&t=" + timestamp : "")
            + videoParams);
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

    // --- RULE 4: YouTube Shorts (e.g. youtube.com/shorts/ABC123?t=35) ---
    // Shorts use the same player as regular videos, just with a different URL format.
    // Without this rule they would hit the catch-all and likely land on a broken page.
    if (url.includes("youtube.com/shorts/")) {
        var shortsID = path.replace("/shorts/", ""); // Extract the video ID from the path
        var shortsTimestamp = new URLSearchParams(query).get("t") || ""; // Preserve timestamp if present
        redirect(invidious + "/watch?v=" + shortsID
            + (shortsTimestamp ? "&t=" + shortsTimestamp : "")
            + videoParams);
        return;
    }

    // --- RULE 5: YouTube Playlist URLs (e.g. youtube.com/playlist?list=ABC123) ---
    // Without this rule playlists would hit the catch-all and likely break on Invidious.
    // Invidious supports playlists natively at /playlist?list=
    if (url.includes("youtube.com/playlist") && query.includes("list=")) {
        var playlistID = new URLSearchParams(query).get("list"); // Extract playlist ID
        redirect(invidious + "/playlist?list=" + playlistID);
        return;
    }

    // --- RULE 6: All other YouTube pages (channels, homepage, etc.) ---
    // Broadest/catch-all rule — must remain last so it doesn't swallow specific rules above.
    // Builds the query string carefully to avoid a double "?" on pages that already
    // have one (e.g. youtube.com/channel/ABC?sort=popular → /channel/ABC?sort=popular&...)
    if (url.includes("youtube.com")) {
        var cleanPageQuery = stripTrackingParams(query);

        // If there's already a query string, append pageParams with "&" instead of "?"
        // to avoid producing a malformed URL like "?sort=popular?related_videos=false"
        var pageSuffix = cleanPageQuery
            ? cleanPageQuery + pageParams.replace("?", "&")
            : pageParams;

        redirect(invidious + path + pageSuffix);
        return;
    }

})();
