// ==UserScript==
// @name         Reddit to Redlib Redirector
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      3.3
// @description  Redirects Reddit to a private Redlib instance, preserving the URL path
// @author       NoIdeaDeveloper
// @license      MIT
// @match        *://*.reddit.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      *
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/reddit-to-redlib.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/reddit-to-redlib.user.js
// ==/UserScript==

// NOTE: This is the simpler, single-instance version of the Reddit redirector.
// It probes the configured instance before redirecting and shows a fallback
// message if it's down. For random instance selection with automatic failover,
// use user-reddit-to-redlib.user.js instead.

(function() {
    'use strict';

    // --- GUARD: Don't redirect if we're inside an iframe ---
    // Prevents the script from breaking Reddit embeds on third-party websites
    if (window.self !== window.top) {
        return;
    }

    // --- CONFIGURATION ---
    var destination = "https://redlib.perennialte.ch";

    // How long (ms) to wait for the instance to respond before showing the fallback page
    var PROBE_TIMEOUT_MS = 2500;

    // Validate/normalise the configured destination and derive its hostname,
    // both for the loop-prevention guard and for the reachability probe.
    // A typo or non-http(s) value falls back to a known-good instance.
    try {
        var parsedDest = new URL(destination);
        if (parsedDest.protocol !== 'https:' && parsedDest.protocol !== 'http:') {
            throw new Error('unsupported protocol');
        }
        destination = 'https://' + parsedDest.host; // force https, drop any path/query
    } catch (e) {
        destination = 'https://redlib.perennialte.ch';
    }
    var destHost = new URL(destination).hostname;

    // --- GUARD: Don't redirect if we're already on the Redlib instance ---
    // Prevents an infinite redirect loop if the destination is somehow matched
    if (window.location.hostname === destHost) {
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

    // --- PROBE THE INSTANCE'S REACHABILITY ---
    // Sends a lightweight HEAD request with a hard timeout. It resolves true
    // for any HTTP response and false on a genuine network failure — DNS
    // error, connection refused, or TLS failure — exactly the "instance is
    // down" case we want to catch before navigating away.
    //
    // The request MUST go through GM_xmlhttpRequest, not the page's fetch/XHR.
    // Reddit's CSP ("default-src 'none'") blocks any in-page request to other
    // origins, which would make a reachable instance look down.
    // GM_xmlhttpRequest runs outside the page and is not subject to that CSP.
    //
    // When GM_xmlhttpRequest is unavailable (e.g. Brave scriptlets) there is
    // no CSP-bypassing request we can make, so we optimistically treat the
    // instance as reachable and redirect directly.
    var gmxhr = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest : null;
    function probe(baseUrl, timeoutMs) {
        return new Promise(function(resolve) {
            if (!gmxhr) { resolve(true); return; }
            var settled = false;
            function finish(ok) {
                if (settled) return;
                settled = true;
                resolve(ok);
            }
            gmxhr({
                method: 'HEAD',
                url: baseUrl,
                timeout: timeoutMs,
                onload: function() { finish(true); },
                onerror: function() { finish(false); },
                ontimeout: function() { finish(false); }
            });
        });
    }

    // --- "INSTANCE UNREACHABLE" FALLBACK PAGE ---
    // Built with safe DOM methods (textContent / setAttribute), never innerHTML,
    // so nothing in the URL can be interpreted as markup.
    function showUnreachable() {
        function render() {
            style.remove(); // Reveal the page so it isn't just blank
            document.body.innerHTML = '';
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'font-family:sans-serif;text-align:center;padding:3rem;color:#333;';
            var heading = document.createElement('h2');
            heading.textContent = 'Redlib instance unreachable';
            heading.style.cssText = 'margin:0 0 0.5rem;';
            var para = document.createElement('p');
            para.style.cssText = 'color:#666;margin:0 0 1.5rem;';
            var strong = document.createElement('strong');
            strong.textContent = destHost; // textContent: safe, no HTML interpretation
            para.appendChild(strong);
            para.appendChild(document.createTextNode(' could not be reached.'));
            var link = document.createElement('a');
            link.setAttribute('href', 'https://github.com/redlib-org/redlib-instances');
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            link.textContent = 'Find another instance';
            link.style.cssText = 'color:#336699;';
            wrapper.appendChild(heading);
            wrapper.appendChild(para);
            wrapper.appendChild(link);
            document.body.appendChild(wrapper);
        }
        // The body may not exist yet at document-start — wait if necessary.
        if (document.body) render();
        else document.addEventListener('DOMContentLoaded', render);
    }

    // Build the new Redlib URL using Reddit's current path and cleaned query string
    var currentPath = window.location.pathname;
    var currentQuery = window.location.search;
    var cleanQuery = stripTrackingParams(currentQuery);
    // Build with the URL constructor for safe, well-formed output
    var newURL = new URL(currentPath + cleanQuery, destination).href;

    // Probe first: redirect only if the instance actually responds, otherwise
    // show a clear message instead of a browser error page. The hidden body
    // means you'll never see Reddit content either way.
    // replace() means Reddit won't appear in the browser history.
    probe(destination, PROBE_TIMEOUT_MS).then(function(reachable) {
        if (reachable) {
            window.location.replace(newURL);
        } else {
            showUnreachable();
        }
    });

})();
