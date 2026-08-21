// ==UserScript==
// @name         YouTube to Invidious Redirector
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      1.4
// @description  Redirects YouTube to an Invidious instance, preserving video IDs, search queries, and channel pages
// @author       NoIdeaDeveloper
// @license      MIT
// @match        *://*.youtube.com/*
// @match        *://youtu.be/*
// @match        *://www.youtube-nocookie.com/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/youtube-to-invidious.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/youtube-to-invidious.user.js
// ==/UserScript==

// NOTE: This is the simpler, older version of the YouTube redirector.
// It probes the configured instance before redirecting and shows a fallback
// message if it's down. For a full-featured version with embed replacement,
// DuckDuckGo integration, and SPA navigation handling, use
// user-youtube-to-invidious.user.js instead.

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

    // How long (ms) to wait for the instance to respond before showing the fallback page
    var PROBE_TIMEOUT_MS = 2500;

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

    // Grab the current host, path, and query for matching against our rules.
    // We match on hostname + pathname rather than substring-testing the whole
    // URL string, so a value like "?q=youtube.com/watch" in the query can never
    // be mistaken for an actual YouTube path.
    var host = window.location.hostname;
    var path = window.location.pathname;
    var query = window.location.search;

    // True for youtube.com and any of its subdomains (www, m, music, …)
    var isYouTube = (host === 'youtube.com' || host.endsWith('.youtube.com'));
    // True for the privacy-enhanced youtube-nocookie.com embed domain
    var isNoCookie = host.endsWith('youtube-nocookie.com');

    // --- PROBE THE INSTANCE'S REACHABILITY ---
    // Sends a lightweight no-cors HEAD request with a hard timeout. A no-cors
    // request resolves for any HTTP response and rejects on a genuine network
    // failure (DNS error, connection refused, TLS failure) — exactly the
    // "instance is down" case. YouTube's CSP allows connect-src to any origin,
    // so a plain fetch works here (unlike on Reddit — see the Redlib scripts).
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
    var invidiousHost = new URL(invidious).hostname;
    function showUnreachable(newURL, styleEl) {
        function render() {
            if (styleEl) styleEl.remove(); // Reveal the page so it isn't just blank
            document.body.innerHTML = '';
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'font-family:sans-serif;text-align:center;padding:3rem;color:#333;';
            var heading = document.createElement('h2');
            heading.textContent = 'Invidious instance unreachable';
            heading.style.cssText = 'margin:0 0 0.5rem;';
            var para = document.createElement('p');
            para.style.cssText = 'color:#666;margin:0 0 1.5rem;';
            var strong = document.createElement('strong');
            strong.textContent = invidiousHost; // textContent: safe, no HTML interpretation
            para.appendChild(strong);
            para.appendChild(document.createTextNode(' could not be reached.'));
            var tryLink = document.createElement('a');
            tryLink.setAttribute('href', newURL); // setAttribute: safe, treats value as literal
            tryLink.textContent = 'Try opening it directly';
            tryLink.style.cssText = 'color:#336699;';
            var separator = document.createTextNode(' · ');
            var findLink = document.createElement('a');
            findLink.setAttribute('href', 'https://api.invidious.io');
            findLink.setAttribute('target', '_blank');
            findLink.setAttribute('rel', 'noopener noreferrer');
            findLink.textContent = 'Find another instance';
            findLink.style.cssText = 'color:#336699;';
            wrapper.appendChild(heading);
            wrapper.appendChild(para);
            wrapper.appendChild(tryLink);
            wrapper.appendChild(separator);
            wrapper.appendChild(findLink);
            document.body.appendChild(wrapper);
        }
        // The body may not exist yet at document-start — wait if necessary.
        if (document.body) render();
        else document.addEventListener('DOMContentLoaded', render);
    }

    // Helper function that performs the redirect.
    // Probes the Invidious instance first; if it responds, navigate with
    // replace() so the YouTube page won't appear in your browser history.
    // If it's unreachable, show a clear message instead of a browser error page.
    function redirect(newURL) {
        probe(invidious, PROBE_TIMEOUT_MS).then(function(reachable) {
            if (reachable) {
                window.location.replace(newURL);
            } else {
                showUnreachable(newURL, style);
            }
        });
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
    // Video IDs are encoded so any unexpected characters can't break out of the
    // query string (real IDs are [A-Za-z0-9_-], but a crafted link could differ).
    if (isYouTube && path === '/watch') {
        var videoID = new URLSearchParams(query).get("v");
        if (videoID) {
            var timestamp = new URLSearchParams(query).get("t") || "";
            redirect(invidious + "/watch?v=" + encodeURIComponent(videoID)
                + (timestamp ? "&t=" + encodeURIComponent(timestamp) : "")
                + videoParams);
            return;
        }
    }

    // --- RULE 2: youtu.be short URLs (e.g. youtu.be/ABC123?t=35) ---
    if (host === "youtu.be") {
        var shortID = path.substring(1);
        if (shortID) {
            var cleanQuery = stripTrackingParams(query);
            var queryPart = cleanQuery ? cleanQuery.replace("?", "&") : "";
            redirect(invidious + "/watch?v=" + encodeURIComponent(shortID) + queryPart + videoParams);
            return;
        }
    }

    // --- RULE 3: YouTube search results (e.g. youtube.com/results?search_query=cats) ---
    if (isYouTube && path === '/results') {
        var searchQuery = new URLSearchParams(query).get("search_query");
        if (searchQuery) {
            redirect(invidious + "/search?q=" + encodeURIComponent(searchQuery));
            return;
        }
    }

    // --- RULE 4: Standard YouTube embeds (e.g. youtube.com/embed/ABC123) ---
    if (isYouTube && path.indexOf('/embed/') === 0) {
        var embedID = (path.split('/embed/')[1] || '').split('/')[0];
        if (embedID) {
            redirect(invidious + "/embed/" + encodeURIComponent(embedID));
            return;
        }
    }

    // --- RULE 5: YouTube nocookie embeds (e.g. youtube-nocookie.com/embed/ABC123) ---
    if (isNoCookie && path.indexOf('/embed/') === 0) {
        var noCookieID = (path.split('/embed/')[1] || '').split('/')[0];
        if (noCookieID) {
            redirect(invidious + "/embed/" + encodeURIComponent(noCookieID));
            return;
        }
    }

    // --- RULE 6: All other YouTube pages (e.g. channel pages, homepage) ---
    if (isYouTube) {
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
