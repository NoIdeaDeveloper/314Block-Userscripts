// =============================================================================
// YouTube to Invidious Redirector
// =============================================================================
// Redirects YouTube to a configured Invidious instance, preserving the video
// ID, timestamps, search queries, and playlists. Strips tracking parameters.
// Replaces YouTube embeds in iframes with a privacy-friendly overlay.
//
// VERSION: 3.0
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
//            noai.duckduckgo.com##+js(user-youtube-to-invidious.js)
//
//         (The ".js" above is Brave's scriptlet reference syntax — it refers
//          to the saved scriptlet name, not to any file in this repository.)
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
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      3.0
// @description  Redirects YouTube to a configured Invidious instance,
//               preserving video IDs, timestamps, search queries, and
//               playlists. Strips tracking parameters. Replaces embeds
//               with a privacy-friendly overlay. Adds "Watch on Invidious"
//               buttons to DuckDuckGo Videos tab results.
// @author       NoIdeaDeveloper
// @license      MIT
// @match        *://www.youtube.com/*
// @match        *://youtube.com/*
// @match        *://youtu.be/*
// @match        *://www.youtube-nocookie.com/*
// @match        *://duckduckgo.com/*
// @match        *://noai.duckduckgo.com/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-youtube-to-invidious.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-youtube-to-invidious.user.js
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

    // How long (ms) to wait for the Invidious instance to respond before
    // showing the "unreachable" fallback page instead of redirecting.
    var PROBE_TIMEOUT_MS = 2500;

    // --- GUARD: Validate and normalise the configured Invidious instance ---
    // Parse the configured value and force it to a bare https origin. Anything
    // that isn't a valid http(s) URL (a typo, "javascript:", a malformed string)
    // falls back to the known-good default, so a misconfiguration can never send
    // you to a junk or non-https destination.
    try {
        var parsedInstance = new URL(invidious);
        if (parsedInstance.protocol !== 'https:' && parsedInstance.protocol !== 'http:') {
            throw new Error('unsupported protocol');
        }
        invidious = 'https://' + parsedInstance.host; // force https, drop any path/query
    } catch (e) {
        invidious = 'https://inv.nadeko.net';
    }

    // Hostname of the validated instance, used for the loop-prevention guard.
    var invidiousHost = new URL(invidious).hostname;

    // --- GUARD: Don't redirect if we're already on the Invidious instance ---
    // Prevents redirect loops if the script ever runs on the Invidious page itself
    if (window.location.hostname === invidiousHost) {
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
            var embedVideoID = (embedPath.split('/embed/')[1] || '').split('/')[0];

            // Bail out if no video ID was found — avoids opening a broken Invidious URL
            if (!embedVideoID) {
                return;
            }

            // Also check for a start time parameter (?start=35 or ?t=35)
            // so the Invidious link can pick up at the same point in the video.
            // Sanitised to digits only — timestamps are always integers, and this
            // prevents any unexpected characters from being appended to the URL.
            var params = new URLSearchParams(window.location.search);
            var rawStartTime = params.get("start") || params.get("t") || "";
            var startTime = rawStartTime.replace(/\D/g, ""); // Strip anything that isn't a digit

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
            link.setAttribute('href', invidiousURL); // setAttribute: consistent with safe DOM pattern
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

    // --- PROBE AN INSTANCE'S REACHABILITY ---
    // Sends a lightweight no-cors HEAD request with a hard timeout. A no-cors
    // request resolves for any HTTP response and rejects on a genuine network
    // failure (DNS error, connection refused, TLS failure) — exactly the
    // "instance is down" case. This replaces the previous approach of listening
    // for a window "error" event after navigating, which never actually fired
    // for failed top-level navigations.
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
    function showUnreachable(newURL, styleEl) {
        function render() {
            if (styleEl) styleEl.remove(); // Reveal the page so it isn't just blank

            var parsedURL;
            try {
                parsedURL = new URL(newURL);
            } catch (e) {
                parsedURL = { hostname: invidiousHost };
            }

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
            var separator = document.createTextNode(' · '); // &nbsp;·&nbsp;

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
        }

        // The body may not exist yet at document-start — wait if necessary.
        if (document.body) render();
        else document.addEventListener('DOMContentLoaded', render);
    }

    // --- REDIRECT FUNCTION ---
    // Probes the Invidious instance first. If it responds, navigate with
    // replace() so YouTube doesn't appear in browser history. If it's
    // unreachable, show a clear message instead of dumping the user on a
    // silent browser error page.
    //
    // Accepts the body-hiding <style> element as a parameter so it can be
    // revealed if we end up showing the fallback page.
    function redirect(newURL, styleEl) {
        probe(invidious, PROBE_TIMEOUT_MS).then(function(reachable) {
            if (reachable) {
                window.location.replace(newURL);
            } else {
                showUnreachable(newURL, styleEl);
            }
        });
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

    // Skip all YouTube redirect logic if we're not on a YouTube domain
    if (!isYouTubeDomain) {
        // Jump ahead to the DDG section below
    } else {

    // Hide the page immediately to prevent YouTube content flashing on screen
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // Grab the current host, path, and query string for use in our redirect rules.
    // We match on hostname + pathname rather than substring-testing the whole URL
    // string, so a value like "?q=youtube.com/watch" in the query can never be
    // mistaken for an actual YouTube path.
    var host = window.location.hostname;
    var path = window.location.pathname;
    var query = window.location.search;

    // True for youtube.com and any of its subdomains (www, m, music, …).
    // youtu.be is handled separately by RULE 2.
    var isYouTubeCom = (host === 'youtube.com' || host.endsWith('.youtube.com'));

    // --- RULE 1: Standard YouTube video URLs (e.g. youtube.com/watch?v=ABC123&t=35) ---
    // Check the parsed "v" value directly rather than a loose query.includes("v=")
    // test, which would also fire for unrelated params like "?srv=1".
    // Video IDs are encoded so any unexpected characters can't break out of the
    // query string (real IDs are [A-Za-z0-9_-], but a crafted link could differ).
    if (isYouTubeCom && path === '/watch') {
        var parsedQuery = new URLSearchParams(query);
        var videoID = parsedQuery.get("v");           // Extract the video ID
        if (videoID) {
            var timestamp = parsedQuery.get("t") || "";   // Preserve timestamp if present (e.g. &t=35)
            redirect(invidious + "/watch?v=" + encodeURIComponent(videoID)
                + (timestamp ? "&t=" + encodeURIComponent(timestamp) : "")
                + videoParams, style);
            return;
        }
    }

    // --- RULE 2: youtu.be short URLs (e.g. youtu.be/ABC123?t=35) ---
    if (host === "youtu.be") {
        var shortID = path.substring(1); // Remove the leading "/" to get just the video ID
        if (shortID) {
            // Strip tracking params but preserve legitimate ones like timestamps (?t=35)
            var cleanQuery = stripTrackingParams(query);

            // Convert any remaining "?" to "&" since we're appending to an existing query string
            var queryPart = cleanQuery ? cleanQuery.replace("?", "&") : "";
            redirect(invidious + "/watch?v=" + encodeURIComponent(shortID) + queryPart + videoParams, style);
            return;
        }
    }

    // --- RULE 3: YouTube search results (e.g. youtube.com/results?search_query=cats) ---
    if (isYouTubeCom && path === '/results') {
        var searchQuery = new URLSearchParams(query).get("search_query"); // Extract search term
        if (searchQuery) {
            redirect(invidious + "/search?q=" + encodeURIComponent(searchQuery), style);
            return;
        }
    }

    // --- RULE 4: YouTube Shorts (e.g. youtube.com/shorts/ABC123?t=35) ---
    // Shorts use the same player as regular videos, just with a different URL format.
    // Without this rule they would hit the catch-all and likely land on a broken page.
    if (isYouTubeCom && path.indexOf('/shorts/') === 0) {
        var shortsID = (path.split('/shorts/')[1] || '').split('/')[0]; // Extract the video ID from the path
        if (shortsID) {
            var shortsTimestamp = new URLSearchParams(query).get("t") || ""; // Preserve timestamp if present
            redirect(invidious + "/watch?v=" + encodeURIComponent(shortsID)
                + (shortsTimestamp ? "&t=" + encodeURIComponent(shortsTimestamp) : "")
                + videoParams, style);
            return;
        }
    }

    // --- RULE 5: YouTube Playlist URLs (e.g. youtube.com/playlist?list=ABC123) ---
    // Without this rule playlists would hit the catch-all and likely break on Invidious.
    // Invidious supports playlists natively at /playlist?list=
    if (isYouTubeCom && path === '/playlist') {
        var playlistID = new URLSearchParams(query).get("list"); // Extract playlist ID
        if (playlistID) {
            redirect(invidious + "/playlist?list=" + encodeURIComponent(playlistID), style);
            return;
        }
    }

    // --- RULE 6: All other YouTube pages (channels, homepage, etc.) ---
    // Broadest/catch-all rule — must remain last so it doesn't swallow specific rules above.
    // Builds the query string carefully to avoid a double "?" on pages that already
    // have one (e.g. youtube.com/channel/ABC?sort=popular → /channel/ABC?sort=popular&...)
    if (isYouTubeCom) {
        var cleanPageQuery = stripTrackingParams(query);

        // If there's already a query string, append pageParams with "&" instead of "?"
        // to avoid producing a malformed URL like "?sort=popular?related_videos=false"
        var pageSuffix = cleanPageQuery
            ? cleanPageQuery + pageParams.replace("?", "&")
            : pageParams;

        redirect(invidious + path + pageSuffix, style);
        return;
    }

    // --- SAFETY NET: no rule matched ---
    // This happens on YouTube-ish domains that none of the rules above handle —
    // e.g. a top-level youtube-nocookie.com page (whose host does NOT contain
    // "youtube.com", so the catch-all skips it), or a youtu.be page with an empty
    // path. Reveal the page so the user isn't left staring at a permanently blank
    // (display:none) screen.
    style.remove();

    } // end if (isYouTubeDomain) / else block

    // ==========================================================================
    // DUCKDUCKGO VIDEOS TAB — Invidious Branding Replacement
    // ==========================================================================
    // When browsing the DuckDuckGo Videos tab, each result is a YouTube video
    // card. This section replaces the YouTube favicon and "YouTube" label in
    // each card's footer with the Invidious icon and "Invidious" label, and
    // intercepts card clicks to open the video on your Invidious instance
    // instead of YouTube.
    //
    // HOW IT WORKS:
    // Each video card is an <a> tag whose href points to the YouTube watch URL
    // (e.g. https://www.youtube.com/watch?v=ABC123). The video ID is extracted
    // directly from that href — no fragile class name targeting required.
    // Rather than appending a separate button, the script finds the YouTube
    // favicon <img> and "YouTube" <span> already present in each card's footer
    // and replaces them in place with the Invidious icon and label. The card's
    // click handler is also intercepted to open Invidious instead of YouTube.
    // The Invidious icon is inlined as a base64 SVG data URI — no network
    // request is ever made to fetch it.
    //
    // Because DDG loads video results dynamically (including when you switch to
    // the Videos tab or scroll for more results), a MutationObserver watches for
    // newly added cards and processes them as they appear. A history.pushState
    // patch fires a custom event on every client-side navigation, allowing the
    // card observer to be started or stopped precisely when the Videos tab is
    // entered or left — so there is zero overhead on all other DDG tabs.
    // ==========================================================================

    // Only run the DDG injection on DuckDuckGo. This covers both the main site
    // and the AI-free "noai." subdomain, which serves the same Videos tab markup.
    var ddgHost = window.location.hostname;
    if (ddgHost !== 'duckduckgo.com' && ddgHost !== 'noai.duckduckgo.com') return;

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

    // --- INVIDIOUS LOGO (INLINE SVG DATA URI) ---
    // The Invidious logo is inlined as a base64 SVG data URI so that no
    // network request is ever made to fetch it. Fetching from an external
    // URL would reveal to that server that you're browsing DDG video results,
    // which defeats the purpose of this privacy-focused script.
    //
    // The SVG is derived from the official Invidious logo (iv-org/invidious,
    // AGPL-3.0). It has been simplified to a clean 16×16 monochrome version
    // suitable for use as a small favicon-style icon.
    //
    // The icon is a circle (the Invidious "eye" motif) with a filled play
    // triangle centred inside it — instantly recognisable at small sizes.
    var INVIDIOUS_ICON_SVG = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">',
        '  <circle cx="8" cy="8" r="7.5" fill="#de5833"/>',   // Orange-red background circle
        '  <polygon points="6,4.5 12,8 6,11.5" fill="#ffffff"/>',  // White play triangle
        '</svg>'
    ].join('');

    // Convert the SVG string to a data URI so it can be set as an img src.
    // btoa() base64-encodes the string — safe for use in a data: URL attribute.
    var INVIDIOUS_ICON_URI = 'data:image/svg+xml;base64,' + btoa(INVIDIOUS_ICON_SVG);

    // --- REPLACE YOUTUBE BRANDING IN A SINGLE VIDEO CARD ---
    // Instead of appending a separate button, we find the YouTube favicon <img>
    // and the "YouTube" <span> text already present in the card footer and
    // replace them in place with the Invidious equivalents.
    //
    // This approach is less intrusive than adding a new element — it slots
    // naturally into the existing card layout without affecting spacing or
    // requiring any position hacks.
    //
    // The YouTube favicon is identified by its src containing "youtube" —
    // a structural match that doesn't depend on DDG's generated class names.
    // The sibling <span> containing the text "YouTube" is then found and
    // updated to read "Invidious" instead.
    function injectButton(card) {
        // Skip cards we've already processed
        if (card.hasAttribute(DDG_PROCESSED_ATTR)) return;

        // Extract the YouTube href from the card's own link
        var cardHref = card.getAttribute('href');
        if (!cardHref) return;

        var invURL = buildInvidiousURL(cardHref);
        if (!invURL) return; // Not a YouTube video link — skip

        // Find the YouTube favicon <img> inside this card.
        // Matches on the src containing "youtube" — works for both
        // "/assets/icons/favicons/youtube.2x.png" and any future path.
        var faviconImg = card.querySelector('img[src*="youtube"]');
        if (!faviconImg) return; // Card doesn't have the expected favicon — skip

        // Mark the card as processed before making any DOM changes,
        // so a re-entrant MutationObserver call can't process it again
        card.setAttribute(DDG_PROCESSED_ATTR, 'true');

        // Swap the YouTube favicon src for the inline Invidious SVG.
        // Using setAttribute keeps it safe — no HTML injection possible.
        faviconImg.setAttribute('src', INVIDIOUS_ICON_URI);
        faviconImg.setAttribute('alt', 'Invidious');

        // Find the sibling <span> that contains the text "YouTube" and
        // update it to say "Invidious" instead.
        // We look at the favicon's parent element and search its child spans,
        // matching on text content rather than class name for robustness.
        var faviconParent = faviconImg.parentElement;
        if (faviconParent) {
            var spans = faviconParent.querySelectorAll('span');
            spans.forEach(function(span) {
                if (span.textContent.trim() === 'YouTube') {
                    span.textContent = 'Invidious'; // Safe: textContent, not innerHTML
                }
            });
        }

        // Redirect the card's own link to Invidious instead of YouTube.
        // This means clicking anywhere on the card (not just the favicon row)
        // goes to Invidious, consistent with what the branding now shows.
        // We intercept the click rather than changing href directly, to avoid
        // DDG's React router potentially overwriting the attribute on re-render.
        card.addEventListener('click', function(e) {
            // Respect modified clicks (open-in-new-tab/window, middle click) —
            // let the browser handle those natively rather than hijacking them.
            if (e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
                return;
            }
            e.preventDefault();  // Stop DDG from following the YouTube href
            e.stopPropagation(); // Prevent React from handling this click
            window.open(invURL, '_blank', 'noopener,noreferrer');
        });
    }

    // --- PROCESS ALL CURRENTLY VISIBLE CARDS ---
    // Finds all video cards on the page right now and injects buttons into them.
    // Called once on Videos tab load and again whenever new cards are detected
    // by the card observer below.
    //
    // Video cards are identified by their href pointing to youtube.com/watch —
    // this is a structural selector that doesn't depend on DDG's class names.
    function processAllCards() {
        document.querySelectorAll('a[href*="youtube.com/watch"]').forEach(function(card) {
            injectButton(card);
        });
    }

    // --- VIDEOS TAB DETECTION ---
    // Returns true if the current URL indicates the user is on the Videos tab.
    //
    // DDG uses two different query string patterns for the Videos tab depending
    // on how you arrive there:
    //
    //   iax=videos  — set when switching TO the Videos tab from another tab
    //                 e.g. https://duckduckgo.com/?q=iceland&ia=videos&iax=videos
    //
    //   iar=videos  — set when conducting a NEW search from within the Videos tab
    //                 e.g. https://duckduckgo.com/?q=puppies&iar=videos
    //
    // Both patterns must be checked, otherwise re-searching from the Videos tab
    // would cause the card observer to stop and buttons would stop appearing.
    // The parsed query string is cached and only re-parsed when the URL
    // actually changes, so repeated isVideosTab() calls (e.g. from the card
    // observer) don't each allocate a fresh URLSearchParams.
    var cachedSearch = null;
    var cachedParams = null;
    function currentParams() {
        if (cachedSearch !== window.location.search) {
            cachedSearch = window.location.search;
            cachedParams = new URLSearchParams(cachedSearch);
        }
        return cachedParams;
    }

    function isVideosTab() {
        var params = currentParams();
        // iax=videos — present when switching TO the Videos tab from another tab
        // iar=videos — present when re-searching from within the Videos tab
        // Exact parameter matching via URLSearchParams avoids false positives from
        // values like "iax=videos-extended" that would fool an indexOf check.
        return params.get('iax') === 'videos' || params.get('iar') === 'videos';
    }

    // --- CARD OBSERVER ---
    // Watches for new video cards being injected into the DOM while the Videos
    // tab is active (e.g. initial load, infinite scroll). Disconnects itself
    // when the user navigates away from the Videos tab to avoid unnecessary
    // overhead on search results, image, news, and other DDG pages.
    //
    // A debounce flag (ddgPending) batches rapid DOM mutations into a single
    // processAllCards call per animation frame, rather than firing on every
    // individual change — React apps can produce hundreds of mutations per second.
    var ddgPending = false;
    var cardObserver = new MutationObserver(function() {
        if (ddgPending) return; // A frame-batched run is already scheduled
        ddgPending = true;

        // Defer until the browser's next paint cycle, coalescing all mutations
        // that occurred in the same frame into a single processAllCards call
        requestAnimationFrame(function() {
            processAllCards();
            ddgPending = false; // Reset so the next batch of mutations can schedule
        });
    });

    // --- TAB NAVIGATION DETECTION ---
    // DDG is a single-page app — switching tabs and submitting new searches both
    // update the URL without a full page reload. The browser fires a "popstate"
    // event for back/forward navigation, but NOT for pushState navigations (which
    // is what DDG uses for tab switches and new searches).
    //
    // To catch all URL changes reliably, we patch history.pushState to fire a
    // custom "ddg-navigate" event whenever DDG calls it. We then listen for both
    // "popstate" (back/forward) and "ddg-navigate" (tab switches, new searches)
    // to trigger our Videos tab check.
    //
    // This is more reliable than watching the <title> element, which DDG does not
    // always update when switching tabs or re-searching from the Videos tab.
    var lastTabState = false; // Tracks whether the card observer is currently running

    function onNavigate() {
        var onVideos = isVideosTab();

        if (onVideos && !lastTabState) {
            // Just arrived on the Videos tab — start the card observer and
            // process any cards already present in the DOM
            processAllCards();
            cardObserver.observe(document.documentElement, {
                childList: true, // Fire when child elements are added or removed
                subtree: true    // Watch all descendants, not just direct children
            });
            lastTabState = true;

        } else if (!onVideos && lastTabState) {
            // Just left the Videos tab — stop the card observer to eliminate
            // overhead while browsing Web, Images, News, or other DDG tabs
            cardObserver.disconnect();
            lastTabState = false;

        } else if (onVideos && lastTabState) {
            // Still on the Videos tab but the URL changed (e.g. new search from
            // within Videos). The card observer is already running, but the new
            // results haven't been processed yet — run processAllCards immediately
            // to pick up any cards that appeared before the observer saw them.
            processAllCards();
        }
    }

    // Patch history.pushState to fire a custom event we can listen to.
    // DDG calls pushState on every client-side navigation, but the browser
    // provides no built-in event for it — so we wrap it ourselves.
    // The try/catch ensures the original pushState is always preserved even
    // if the patch itself throws for any reason.
    try {
        var originalPushState = history.pushState.bind(history);
        history.pushState = function(state, title, url) {
            originalPushState(state, title, url); // Call the real pushState first
            window.dispatchEvent(new Event('ddg-navigate')); // Then fire our custom event
        };
    } catch (e) {
        // Patching failed — fall back to popstate only (back/forward navigation).
        // Tab switches and new searches won't trigger the observer in this case,
        // but the script will still work for direct page loads on the Videos tab.
    }

    // Listen for both navigation event types:
    //   popstate    — fired by the browser on back/forward navigation
    //   ddg-navigate — fired by our pushState patch on tab switches and new searches
    window.addEventListener('popstate', onNavigate);
    window.addEventListener('ddg-navigate', onNavigate);

    // --- INITIALISE ---
    // Wire everything up once the DOM is ready. We need the body to exist
    // before we can query for video cards.
    function initDDG() {
        // If the page loaded directly on the Videos tab (e.g. a bookmarked URL
        // or a direct link), start the card observer immediately rather than
        // waiting for the first navigation event to fire.
        if (isVideosTab()) {
            processAllCards();
            cardObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
            lastTabState = true;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDDG);
    } else {
        initDDG();
    }

})();
