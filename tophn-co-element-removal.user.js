// ==UserScript==
// @name         TopHN Element Remover
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Remove specific div elements from TopHN
// @author       You
// @match        https://www.tophn.co/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // CSS selector for the element(s) you want to remove
    const SELECTOR = 'div.mt-2.px-3.py-2.bg-neutral-50.dark\\:bg-neutral-900.rounded';

    // How long to keep retrying on page load (milliseconds)
    const MAX_WAIT = 5000;

    // How often to retry (milliseconds)
    const INTERVAL = 200;

    // Removes all matching elements and returns how many were removed
    function removeElements() {
        const targets = document.querySelectorAll(SELECTOR);
        targets.forEach(el => el.remove());
        return targets.length;
    }

    // Keeps trying to remove elements until they're found or we hit MAX_WAIT.
    // This handles the case where elements load after the script initially runs.
    function removeWithRetry() {
        let elapsed = 0;

        const timer = setInterval(function() {
            const removed = removeElements();

            elapsed += INTERVAL;

            // Stop retrying once we've found and removed something, or timed out
            if (removed > 0 || elapsed >= MAX_WAIT) {
                clearInterval(timer);
            }
        }, INTERVAL);
    }

    // Watch for future DOM changes (e.g. after navigation or lazy loading)
    // and remove matching elements as soon as they appear
    const observer = new MutationObserver(function(mutations) {
        // Only act if something was actually added to the DOM
        const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasAddedNodes) {
            removeElements();
        }
    });

    // Start observing the whole document for added elements
    observer.observe(document.documentElement, {
        childList: true,  // Watch for added/removed elements
        subtree: true      // Watch all descendants, not just direct children
    });

    // Kick off the retry loop on initial page load
    removeWithRetry();

})();
