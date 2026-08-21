// ==UserScript==
// @name         TopHN Element Remover
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      1.4
// @description  Remove specific div elements from TopHN
// @author       NoIdeaDeveloper
// @license      MIT
// @match        https://www.tophn.co/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/tophn-co-element-removal.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/tophn-co-element-removal.user.js
// ==/UserScript==

(function() {
    'use strict';

    // CSS selector for the element(s) you want to remove
    const SELECTOR = 'div.mt-2.px-3.py-2.bg-neutral-50.dark\\:bg-neutral-900.rounded';

    // How long to keep retrying on page load (milliseconds). Short, because at
    // document-start the DOM may not contain matching elements yet — the
    // MutationObserver below catches every later arrival, so this loop only
    // needs to cover elements that appear during initial load.
    const MAX_WAIT = 2000;

    // How often to retry (milliseconds)
    const INTERVAL = 200;

    // Removes all matching elements and returns how many were removed
    function removeElements() {
        const targets = document.querySelectorAll(SELECTOR);
        targets.forEach(el => el.remove());
        return targets.length;
    }

    // Keeps trying to remove elements until they're found or we hit MAX_WAIT.
    // Once an initial removal succeeds (or the wait times out), the interval
    // stops — the MutationObserver below handles every later DOM change, so
    // running both simultaneously would just duplicate work.
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
    // and remove matching elements as soon as they appear.
    //
    // A debounce flag batches rapid mutations into a single removeElements call
    // per animation frame, rather than running the (relatively expensive)
    // querySelectorAll on every individual mutation — a busy page can otherwise
    // emit hundreds of mutations per second.
    let pending = false;
    const observer = new MutationObserver(function(mutations) {
        // Only act if something was actually added to the DOM
        const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
        if (!hasAddedNodes || pending) return;

        pending = true;
        requestAnimationFrame(function() {
            removeElements();
            pending = false;
        });
    });

    // Start observing the whole document for added elements
    observer.observe(document.documentElement, {
        childList: true,  // Watch for added/removed elements
        subtree: true      // Watch all descendants, not just direct children
    });

    // Kick off the retry loop on initial page load
    removeWithRetry();

})();
