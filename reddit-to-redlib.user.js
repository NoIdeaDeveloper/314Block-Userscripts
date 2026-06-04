// ==UserScript==
// @name         Reddit to Redlib Redirector
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Redirects Reddit to a private Redlib instance, preserving the URL path
// @author       You
// @match        *://www.reddit.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// NOTE: This is the simpler, single-instance version of the Reddit redirector.
// For a full-featured version with random instance selection and loop prevention,
// use user-reddit-to-redlib.js instead.

(function() {
    'use strict';

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
    var newURL = destination + currentPath + cleanQuery;

    // Redirect to Redlib — the hidden body means you'll never see Reddit content
    window.location.replace(newURL);

})();
