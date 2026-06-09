// ==UserScript==
// @name         Reddit to Redlib Redirector
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Redirects Reddit to a private Redlib instance, preserving the URL path
// @author       You
// @match        *://*.reddit.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// NOTE: This is the simpler, single-instance version of the Reddit redirector.
// For a full-featured version with random instance selection and reachability
// probing, use user-reddit-to-redlib.user.js instead.

(function() {
    'use strict';

    // --- GUARD: Don't redirect if we're inside an iframe ---
    // Prevents the script from breaking Reddit embeds on third-party websites
    if (window.self !== window.top) {
        return;
    }

    // Immediately hide the page body so no Reddit content flashes on screen
    // while the redirect is processing
    var style = document.createElement('style');
    style.textContent = 'body { display: none !important; }';
    document.documentElement.appendChild(style);

    // --- TRACKING PARAMETER STRIPPER ---
    function stripTrackingParams(queryString) {
        if (!queryString) return '';

        var params = new URLSearchParams(queryString);
        var trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign',
            'utm_term', 'utm_content',
            'ref', 'ref_source',
            'correlation_id', 'share_id'
        ];

        trackingParams.forEach(function(param) {
            params.delete(param);
        });

        return params.toString() ? '?' + params.toString() : '';
    }

    // Build the new Redlib URL using Reddit's current path and cleaned query string
    var destination = "https://redlib.perennialte.ch";
    var currentPath = window.location.pathname;
    var currentQuery = window.location.search;
    var cleanQuery = stripTrackingParams(currentQuery);
    // Build with the URL constructor for safe, well-formed output
    var newURL = new URL(currentPath + cleanQuery, destination).href;

    // Redirect to Redlib — the hidden body means you'll never see Reddit content
    window.location.replace(newURL);

})();
