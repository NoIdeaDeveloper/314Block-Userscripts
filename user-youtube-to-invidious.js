// =============================================================================
// YouTube to Invidious Redirector
// =============================================================================
// Redirects YouTube to a configured Invidious instance, preserving the video
// ID, timestamps, search queries, and playlists. Strips tracking parameters.
// Replaces YouTube embeds in iframes with a privacy-friendly overlay.
//
// VERSION: 2.5
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
//            duckduckgo.com##+js(user-youtube-to-invidious.js)
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
// @version      2.5
// @description  Redirects YouTube to a configured Invidious instance,
//               preserving video IDs, timestamps, search queries, and
//               playlists. Strips tracking parameters. Replaces embeds
//               with a privacy-friendly overlay. Adds "Watch on Invidious"
//               buttons to DuckDuckGo Videos tab results.
// @author       You
// @match        *://www.youtube.com/*
// @match        *://youtube.com/*
// @match        *://youtu.be/*
// @match        *://www.youtube-nocookie.com/*
// @match        *://duckduckgo.com/*
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
            var embedVideoID = embedPath.replace("/embed/", "");

            // Also check for a start time parameter (?start=35 or ?t=35)
            // so the Invidious link can pick up at the same point in the video
            var params = new URLSearchParams(window.location.search);
            var startTime = params.get("start") || params.get("t") || null;

            // Build the Invidious link, appending the timestamp if one exists
            var invidiousURL = invidious + "/watch?v=" + embedVideoID
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

    // --- GUARD: Only run YouTube redirect logic on YouTube domains ---
    // The script also runs on duckduckgo.com (for the Videos tab injection below).
    // This check ensures the body-hiding style and redirect rules are never
    // triggered on DDG, which would leave the page permanently blank.
    var isYouTubeDomain = (
        window.location.hostname === 'www.youtube.com' ||
        window.location.hostname === 'youtube.com' ||
        window.location.hostname === 'youtu.be' ||
        window.location.hostname === 'www.youtube-nocookie.com'
    );

    // --- REDIRECT FUNCTION ---
    // Performs the redirect using replace() so YouTube doesn't appear in
    // browser history. Also registers an error handler so that if the
    // Invidious instance is unreachable, the user sees a clear message
    // rather than a silent browser error page.
    // Declared at IIFE scope (not inside the isYouTubeDomain block) to
    // avoid function declarations inside conditional blocks, which is
    // unreliable across JavaScript engines.
    function redirect(newURL) {
        // Listen for a page error after navigation — if Invidious is down or
        // unreachable, reveal a user-friendly message explaining what happened.
        window.addEventListener('error', function() {
            style.remove(); // Reveal the page so it isn't just blank

            // --- SAFE DOM CONSTRUCTION ---
            // Build the error page by creating elements and setting their
            // text/attributes individually, rather than injecting an HTML
            // string via innerHTML. This eliminates any XSS risk from
            // unexpected characters in the URL being interpreted as markup.

            var parsedURL = new URL(newURL); // Already validated when redirect() was called

            // Wrapper
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'font-family:sans-serif;text-align:center;padding:3rem;color:#333;';

            // Warning icon
            var icon = document.createElement('div');
            icon.textContent = '⚠️';
            icon.style.cssText = 'font-size:2.5rem;margin-bottom:1rem;';

            // Heading
            var heading = document.createElement('h2');
            heading.textContent = 'Invidious instance unreachable';
            heading.style.cssText = 'margin:0 0 0.5rem;';

            // Paragraph with bolded hostname — set via textContent, never innerHTML
            var para = document.createElement('p');
            para.style.cssText = 'color:#666;margin:0 0 1.5rem;';
            var strong = document.createElement('strong');
            strong.textContent = parsedURL.hostname; // textContent: safe, no HTML interpretation
            para.appendChild(strong);
            para.appendChild(document.createTextNode(' could not be reached.'));

            // "Try directly" link — href set via setAttribute, not string concatenation
            var tryLink = document.createElement('a');
            tryLink.setAttribute('href', newURL); // setAttribute: safe, treats value as literal
            tryLink.textContent = 'Try opening it directly';
            tryLink.style.cssText = 'color:#336699;';

            // Separator
            var separator = document.createTextNode('\u00a0·\u00a0'); // &nbsp;·&nbsp;

            // "Find another instance" link — static URL, no user data involved
            var findLink = document.createElement('a');
            findLink.setAttribute('href', 'https://api.invidious.io');
            findLink.setAttribute('target', '_blank');
            findLink.setAttribute('rel', 'noopener noreferrer');
            findLink.textContent = 'Find another instance';
            findLink.style.cssText = 'color:#336699;';

            // Assemble and replace the page body
            wrapper.appendChild(icon);
            wrapper.appendChild(heading);
            wrapper.appendChild(para);
            wrapper.appendChild(tryLink);
            wrapper.appendChild(separator);
            wrapper.appendChild(findLink);
            document.body.innerHTML = ''; // Clear the body first
            document.body.appendChild(wrapper);
        }, { once: true }); // Bind once — we only need to catch the first error

        window.location.replace(newURL);
    }

    // --- TRACKING PARAMETER STRIPPER ---
    // Removes YouTube/Google analytics parameters from the query string.
    // These are meaningless on Invidious and just add noise to the URL.
    // Declared at IIFE scope alongside redirect() for the same reason.
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

    // Skip all YouTube redirect logic if we're not on a YouTube domain
    if (!isYouTubeDomain) {
        // Jump ahead to the DDG section below
    } else {

    // Hide the page immediately to prevent YouTube content flashing on screen
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // Grab the current URL, path, and query string for use in our redirect rules
    var url = window.location.href;
    var path = window.location.pathname;
    var query = window.location.search;

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

    } // end if (isYouTubeDomain) / else block

    // ==========================================================================
    // DUCKDUCKGO VIDEOS TAB — "Watch on Invidious" Button Injection
    // ==========================================================================
    // When browsing the DuckDuckGo Videos tab, each result is a YouTube video
    // card. This section injects a "Watch on Invidious" button onto every card,
    // so you can open the video directly on your configured Invidious instance
    // without first being routed through YouTube.
    //
    // HOW IT WORKS:
    // Each video card is an <a> tag whose href points to the YouTube watch URL
    // (e.g. https://www.youtube.com/watch?v=ABC123). The video ID is extracted
    // directly from that href — no fragile class name targeting required.
    // A "Watch on Invidious" button is then injected into the card's footer row.
    //
    // Because DDG loads video results dynamically (including when you switch to
    // the Videos tab or scroll for more results), a MutationObserver watches for
    // newly added cards and processes them as they appear.
    // ==========================================================================

    // Only run the DDG injection on duckduckgo.com
    if (window.location.hostname !== 'duckduckgo.com') return;

    // --- MARKER ATTRIBUTE ---
    // Used to tag cards we've already processed, so the MutationObserver
    // doesn't inject a duplicate button if a card is re-rendered by DDG's
    // React frontend (which can happen on tab switches or layout updates).
    var DDG_PROCESSED_ATTR = 'data-invidious-injected';

    // --- BUILD INVIDIOUS URL FROM A YOUTUBE HREF ---
    // Accepts a full YouTube watch URL string and returns the equivalent
    // Invidious URL, with videoParams appended. Returns null if no video
    // ID can be found (e.g. if the card links somewhere other than YouTube).
    function buildInvidiousURL(youtubeHref) {
        try {
            var parsed = new URL(youtubeHref);

            // Only handle standard YouTube watch URLs
            if (!parsed.hostname.includes('youtube.com')) return null;

            var videoId = parsed.searchParams.get('v');
            if (!videoId) return null;

            // Build the Invidious watch URL using the shared invidious + videoParams config
            return invidious + '/watch?v=' + videoId + videoParams;
        } catch (e) {
            return null; // Malformed URL — skip this card
        }
    }

    // --- INJECT BUTTON INTO A SINGLE VIDEO CARD ---
    // Accepts the <a> card element, extracts the video ID from its href,
    // and appends a styled "Watch on Invidious" button inside the card.
    function injectButton(card) {
        // Skip cards we've already processed
        if (card.hasAttribute(DDG_PROCESSED_ATTR)) return;

        // Extract the YouTube href from the card's own link
        var cardHref = card.getAttribute('href');
        if (!cardHref) return;

        var invURL = buildInvidiousURL(cardHref);
        if (!invURL) return; // Not a YouTube video link — skip

        // Mark the card as processed before making any DOM changes,
        // so a re-entrant MutationObserver call can't inject a duplicate
        card.setAttribute(DDG_PROCESSED_ATTR, 'true');

        // --- BUILD THE BUTTON ---
        // Styled as a <button> rather than an <a> to avoid the redundancy
        // of setting an href that is then immediately prevented by the click
        // handler. Navigation is handled entirely by window.open() below.
        var btn = document.createElement('button');
        btn.textContent = '▶ Watch on Invidious';
        btn.setAttribute('type', 'button'); // Prevents any accidental form submission

        // Stop the click from also triggering the parent card's YouTube link
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent click bubbling up to the <a> card wrapper
            e.preventDefault();  // Belt-and-braces: suppress any default button behaviour
            window.open(invURL, '_blank', 'noopener,noreferrer');
        });

        // --- BUTTON STYLES ---
        // Matches DuckDuckGo's visual language:
        //   • #de5833 — DDG's signature orange-red, used on their logo and primary actions
        //   • Rounded pill shape — consistent with DDG's button style
        //   • Small, compact size — fits neatly in the card footer without crowding
        //   • Semibold weight and uppercase tracking — matches DDG's label conventions
        btn.style.cssText = [
            'display: inline-flex',
            'align-items: center',
            'gap: 6px',
            'margin-top: 8px',
            'padding: 5px 12px',
            'background: #de5833',           // DDG orange-red — primary brand colour
            'color: #ffffff',
            'font-size: 0.72rem',
            'font-weight: 600',
            'letter-spacing: 0.03em',
            'border: none',
            'border-radius: 20px',           // Pill shape — consistent with DDG UI
            'cursor: pointer',
            'white-space: nowrap',
            'font-family: inherit',          // Inherit DDG's system font stack
            'position: relative',            // Ensures the button sits above the card link layer
            'z-index: 10',
            'transition: background 0.15s ease',  // Subtle hover feedback
            'box-shadow: 0 1px 3px rgba(0,0,0,0.18)' // Gentle lift to distinguish from card bg
        ].join('; ');

        // Darken button slightly on hover for clear interactive feedback
        btn.addEventListener('mouseenter', function() {
            btn.style.background = '#c24a28'; // ~15% darker than #de5833
        });
        btn.addEventListener('mouseleave', function() {
            btn.style.background = '#de5833'; // Restore original colour on mouse out
        });

        // Find the innermost <article> inside the card to append the button to.
        // The article contains the card's content rows — appending here keeps
        // the button visually inside the card without disrupting its layout.
        var article = card.querySelector('article');
        var target = article || card; // Fall back to the card itself if no article found
        target.appendChild(btn);
    }

    // --- PROCESS ALL CURRENTLY VISIBLE CARDS ---
    // Finds all video cards on the page right now and injects buttons into them.
    // Called once on load and again whenever new cards are detected.
    //
    // Video cards are identified by their href pointing to youtube.com/watch —
    // this is a structural selector that doesn't depend on DDG's class names.
    function processAllCards() {
        document.querySelectorAll('a[href*="youtube.com/watch"]').forEach(function(card) {
            injectButton(card);
        });
    }

    // --- OBSERVE FOR DYNAMICALLY LOADED CARDS ---
    // DDG loads video results asynchronously — both on initial tab load and
    // when scrolling for more results. The MutationObserver watches for new
    // nodes being added to the DOM and runs processAllCards each time.
    //
    // A debounce flag (ddgPending) prevents the observer from calling
    // processAllCards on every individual DOM mutation, which could be
    // hundreds per second during a page load. Instead, it batches them:
    // processAllCards runs once per animation frame at most.
    var ddgPending = false;

    var ddgObserver = new MutationObserver(function() {
        // If a run is already scheduled for this frame, don't schedule another
        if (ddgPending) return;
        ddgPending = true;

        // requestAnimationFrame defers the work until the browser is ready to
        // paint, batching all mutations that occurred in the same frame into
        // a single processAllCards call
        requestAnimationFrame(function() {
            processAllCards();
            ddgPending = false; // Reset flag so the next batch can be scheduled
        });
    });

    // Start observing once the DOM is available
    // (this section runs after document-start, so we may need to wait)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            processAllCards();
            ddgObserver.observe(document.documentElement, {
                childList: true, // Fire when child nodes are added or removed
                subtree: true    // Watch the entire document tree, not just direct children
            });
        });
    } else {
        // DOM already available — act immediately
        processAllCards();
        ddgObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

})();
