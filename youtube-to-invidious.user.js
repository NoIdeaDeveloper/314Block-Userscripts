// ==UserScript==
// @name         YouTube to Invidious Redirector
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Redirects YouTube to an Invidious instance, preserving video IDs, search queries, and channel pages
// @author       You
// @match        *://*.youtube.com/*
// @match        *://youtu.be/*
// @match        *://www.youtube-nocookie.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// NOTE: This is the simpler, older version of the YouTube redirector.
// For a full-featured version with embed replacement, DuckDuckGo integration,
// tracking parameter stripping, and error handling, use user-youtube-to-invidious.js instead.

(function() {
    'use strict';

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

    // --- GUARD: Don't redirect if we're already on the Invidious instance ---
    if (window.location.hostname === new URL(invidious).hostname) {
        return;
    }

    // --- GUARD: Don't redirect if we're inside an iframe ---
    if (window.self !== window.top) {
        return;
    }

    // Hide the page immediately so no YouTube content flashes on screen
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // Grab the full current URL for matching against our rules
    var url = window.location.href;
    var path = window.location.pathname;
    var query = window.location.search;

    // Helper function that performs the redirect.
    // Using replace() means the YouTube page won't appear in your browser history.
    function redirect(newURL) {
        window.location.replace(newURL);
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
    if (url.includes("youtube.com/watch")) {
        var videoID = new URLSearchParams(query).get("v");
        if (videoID) {
            var timestamp = new URLSearchParams(query).get("t") || "";
            redirect(invidious + "/watch?v=" + videoID
                + (timestamp ? "&t=" + timestamp : "")
                + videoParams);
            return;
        }
    }

    // --- RULE 2: youtu.be short URLs (e.g. youtu.be/ABC123?t=35) ---
    if (window.location.hostname === "youtu.be") {
        var shortID = path.substring(1);
        if (shortID) {
            var cleanQuery = stripTrackingParams(query);
            var queryPart = cleanQuery ? cleanQuery.replace("?", "&") : "";
            redirect(invidious + "/watch?v=" + shortID + queryPart + videoParams);
            return;
        }
    }

    // --- RULE 3: YouTube search results (e.g. youtube.com/results?search_query=cats) ---
    if (url.includes("youtube.com/results")) {
        var searchQuery = new URLSearchParams(query).get("search_query");
        if (searchQuery) {
            redirect(invidious + "/search?q=" + encodeURIComponent(searchQuery));
            return;
        }
    }

    // --- RULE 4: Standard YouTube embeds (e.g. youtube.com/embed/ABC123) ---
    if (url.includes("youtube.com/embed/")) {
        var embedID = (path.split('/embed/')[1] || '').split('/')[0];
        redirect(invidious + "/embed/" + embedID);
        return;
    }

    // --- RULE 5: YouTube nocookie embeds (e.g. youtube-nocookie.com/embed/ABC123) ---
    if (url.includes("youtube-nocookie.com/embed/")) {
        var noCookieID = (path.split('/embed/')[1] || '').split('/')[0];
        redirect(invidious + "/embed/" + noCookieID);
        return;
    }

    // --- RULE 6: All other YouTube pages (e.g. channel pages, homepage) ---
    if (url.includes("youtube.com")) {
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
