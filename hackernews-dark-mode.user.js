// ==UserScript==
// @name         Hacker News — Dark Mode & Reddit-Style Comments
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      2.3
// @description  Dark mode, colour-coded comment threads, new-comment highlighting, OP/reply highlighting, keyboard navigation, collapsible threads with a collapse-all control, a sticky header, visited-story dimming or hiding, and a settings panel for Hacker News
// @author       NoIdeaDeveloper
// @license      MIT
// @match        *://news.ycombinator.com/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/hackernews-dark-mode.user.js
// @updateURL    https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/hackernews-dark-mode.user.js
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================
    // SECTION 0: SETTINGS
    // Settings are read synchronously at document-start (localStorage is
    // available before the DOM exists), so the chosen theme is applied with no
    // flash of the original page. Every feature is gated by a class toggled on
    // <html>, which means the in-page settings panel can switch features on and
    // off live without a reload.
    // =========================================================================

    var SETTINGS_KEY = 'hn-enhancer-settings';

    var DEFAULTS = {
        darkMode:     'on',   // 'on' | 'off' | 'auto' (auto = follow OS preference)
        depthColors:  true,   // colour-coded left borders per nesting depth
        newComments:  true,   // highlight comments posted since your last visit
        opHighlight:  true,   // badge the submitter (OP) and replies to you
        keyboardNav:  true,   // j/k/p/c/o keyboard navigation
        sortBar:      true,   // comment sort bar
        navButton:    true,   // floating next-parent button
        stickyHeader: true,   // sticky story title while scrolling comments
        visitedDim:   true,   // dim stories you've already visited
        hideVisited:  false,  // hide visited stories entirely (takes precedence over dimming)
        fontSize:     14,     // base font size (px) for titles and comment text
        lineHeight:   1.4,    // comment text line height
        width:        0       // content max-width (px); 0 = native HN width
    };

    function loadSettings() {
        try {
            return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
        } catch (e) {
            return Object.assign({}, DEFAULTS);
        }
    }

    function saveSettings(s) {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* private mode / quota */ }
    }

    var settings = loadSettings();

    // Resolve whether dark mode should currently be active, honouring 'auto'.
    function darkActive(s) {
        if (s.darkMode === 'off') return false;
        if (s.darkMode === 'on') return true;
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    // Toggle a feature class on <html>. All themed CSS is scoped under these
    // classes, so adding/removing one enables/disables the feature instantly.
    function setClass(name, on) {
        document.documentElement.classList.toggle(name, !!on);
    }

    // Build the CSS for the user's font-size / line-height / width preferences.
    function prefsCSS(s) {
        var css = '';
        css += '.commtext { font-size:' + s.fontSize + 'px !important; line-height:' + s.lineHeight + ' !important; }';
        css += '.titleline > a { font-size:' + s.fontSize + 'px !important; }';
        if (s.width > 0) {
            css += '#hnmain { width:100% !important; max-width:' + s.width + 'px !important; }';
        }
        return css;
    }

    // Apply every setting: toggle the feature classes and refresh the prefs CSS.
    var prefStyle = null;
    function applySettings(s) {
        setClass('hn-dark',         darkActive(s));
        setClass('hn-depthcolors',  s.depthColors);
        setClass('hn-newcomments',  s.newComments);
        setClass('hn-ophighlight',  s.opHighlight);
        setClass('hn-keyboardnav',  s.keyboardNav);
        setClass('hn-sortbar',      s.sortBar);
        setClass('hn-navbutton',    s.navButton);
        setClass('hn-stickyheader', s.stickyHeader);
        setClass('hn-visiteddim',   s.visitedDim);
        setClass('hn-hidevisited',  s.hideVisited);
        if (prefStyle) prefStyle.textContent = prefsCSS(s);
    }

    // =========================================================================
    // SECTION 1: INJECT CSS
    // All visual styling lives here. Every rule is scoped under an html.hn-*
    // class so it only takes effect when that feature is enabled.
    // =========================================================================
    var style = document.createElement('style');
    style.textContent = `

        /* === DARK MODE (scoped under html.hn-dark) ============================ */

        html.hn-dark, html.hn-dark body {
            background-color: #1a1a1b !important;
            color: #d7dadc !important;
        }

        html.hn-dark body > center > table,
        html.hn-dark body > center > table td {
            background-color: #1a1a1b !important;
        }

        /* The orange header bar — darken it to a deep charcoal */
        html.hn-dark #hnmain > tbody > tr:first-child td,
        html.hn-dark .pagetop,
        html.hn-dark .pagetop a,
        html.hn-dark td[bgcolor="#ff6600"] {
            background-color: #272729 !important;
            color: #d7dadc !important;
        }

        html.hn-dark .pagetop a { color: #818384 !important; }
        html.hn-dark .pagetop a:hover { color: #d7dadc !important; }

        /* The thin spacer line between header and content */
        html.hn-dark .pagetop + tr td { background-color: #343536 !important; }

        html.hn-dark .athing { background-color: #1a1a1b !important; }

        html.hn-dark .titleline > a,
        html.hn-dark .titleline > a:visited { color: #d7dadc !important; }

        html.hn-dark .sitebit a, html.hn-dark .sitestr { color: #818384 !important; }

        html.hn-dark .subtext, html.hn-dark .subtext a { color: #818384 !important; }
        html.hn-dark .subtext a:hover { color: #d7dadc !important; text-decoration: underline; }

        /* Force text inside comment rows light — HN sometimes inlines
           color="black" on <font> tags, which would otherwise win. Targeted
           selectors instead of `.comtr *` so the browser doesn't have to
           recalculate style for every descendant of every comment row. */
        html.hn-dark .comtr .commtext,
        html.hn-dark .comtr .commtext *,
        html.hn-dark .comtr > td,
        html.hn-dark .comtr .default,
        html.hn-dark .comtr .default * { color: #d7dadc !important; }

        /* Re-apply specific accent colours the wildcard above would flatten */
        html.hn-dark .hnuser, html.hn-dark a.hnuser { color: #ff6314 !important; font-weight: 600; }
        html.hn-dark .age a, html.hn-dark .reply a { color: #818384 !important; }
        html.hn-dark .reply a:hover, html.hn-dark .age a:hover { color: #d7dadc !important; }
        html.hn-dark .comment a { color: #4fbdff !important; }
        html.hn-dark .votearrow { filter: invert(60%) !important; }

        html.hn-dark #hnmain > tbody > tr:last-child td { background-color: #272729 !important; }

        html.hn-dark #hnmain > tbody > tr:last-child td,
        html.hn-dark #hnmain > tbody > tr:last-child td *,
        html.hn-dark .yclinks,
        html.hn-dark .yclinks * { color: #d7dadc !important; }
        html.hn-dark .yclinks a:hover { color: #ffffff !important; text-decoration: underline; }

        html.hn-dark input, html.hn-dark textarea {
            background-color: #272729 !important;
            color: #d7dadc !important;
            border: 1px solid #343536 !important;
        }
        html.hn-dark input[type="submit"] {
            background-color: #343536 !important;
            color: #d7dadc !important;
            border: 1px solid #818384 !important;
            cursor: pointer;
        }
        html.hn-dark a.morelink { color: #ff6314 !important; }

        /* === COLLAPSIBLE COMMENT TEXTAREA ==================================== */
        textarea.hn-textarea-collapsed {
            height: 104px !important;
            min-height: 104px !important;
            max-height: 104px !important;
            overflow: hidden !important;
            resize: none !important;
            transition: height 0.2s ease, max-height 0.2s ease, box-shadow 0.2s ease;
            cursor: pointer;
            opacity: 0.8;
        }
        textarea.hn-textarea-expanded {
            height: 192px !important;
            min-height: 192px !important;
            max-height: none !important;
            overflow: auto !important;
            resize: vertical !important;
            transition: height 0.2s ease, max-height 0.2s ease, box-shadow 0.2s ease;
            cursor: text;
            opacity: 1;
            box-shadow: 0 0 0 2px #ff6314 !important;
        }

        /* === COMMENT DEPTH COLOUR CODING (html.hn-depthcolors) =============== */
        html.hn-depthcolors .comtr .commtext {
            padding-left: 8px !important;
            border-left: 3px solid transparent;
        }
        html.hn-depthcolors [data-depth="0"] .commtext { border-left-color: transparent !important; }
        html.hn-depthcolors [data-depth="1"] .commtext { border-left-color: #ff4500 !important; }
        html.hn-depthcolors [data-depth="2"] .commtext { border-left-color: #0dd3bb !important; }
        html.hn-depthcolors [data-depth="3"] .commtext { border-left-color: #ffb000 !important; }
        html.hn-depthcolors [data-depth="4"] .commtext { border-left-color: #46d160 !important; }
        html.hn-depthcolors [data-depth="5"] .commtext { border-left-color: #cc69b9 !important; }
        html.hn-depthcolors [data-depth="6"] .commtext { border-left-color: #0079d3 !important; }
        html.hn-depthcolors [data-depth="7"] .commtext { border-left-color: #ff585b !important; }
        html.hn-depthcolors [data-depth="8"] .commtext { border-left-color: #ff4500 !important; }
        html.hn-depthcolors [data-depth="9"] .commtext { border-left-color: #0dd3bb !important; }

        /* === NEW-COMMENT HIGHLIGHTING (html.hn-newcomments) ================== */
        .hn-new-badge { display: none; }
        html.hn-newcomments .comtr.hn-new-comment .commtext {
            background: rgba(255, 153, 0, 0.07) !important;
        }
        html.hn-newcomments .hn-new-badge {
            display: inline-block;
            margin-left: 6px;
            font-size: 10px;
            font-weight: 700;
            color: #ff6314;
            border: 1px solid #ff6314;
            border-radius: 8px;
            padding: 0 5px;
            vertical-align: middle;
        }

        /* === OP & REPLY HIGHLIGHTING (html.hn-ophighlight) =================== */
        .hn-op-badge, .hn-reply-badge { display: none; }
        html.hn-ophighlight .hn-op-badge {
            display: inline-block;
            margin-left: 5px;
            font-size: 10px;
            font-weight: 700;
            background: #ff6314;
            color: #fff !important;
            border-radius: 8px;
            padding: 0 5px;
        }
        html.hn-ophighlight .hn-reply-badge {
            display: inline-block;
            margin-left: 5px;
            font-size: 10px;
            font-weight: 700;
            background: #2d6cdf;
            color: #fff !important;
            border-radius: 8px;
            padding: 0 5px;
        }

        /* === KEYBOARD-NAV CURRENT ROW (html.hn-keyboardnav) ================== */
        html.hn-keyboardnav .hn-nav-current > td {
            background: rgba(255, 99, 20, 0.12) !important;
        }
        html.hn-keyboardnav .hn-nav-current .commtext {
            box-shadow: -3px 0 0 0 #ff6314;
        }

        /* === VISITED-STORY DIMMING (html.hn-visiteddim) ===================== */
        html.hn-visiteddim tr.athing.hn-visited .titleline > a { opacity: 0.5; }

        /* === VISITED-STORY HIDING (html.hn-hidevisited) ===================== */
        /* Alternative to dimming: remove visited stories (title, subtext and
           spacer rows) from the list entirely. display:none wins over the dim
           rule above, so enabling both is safe — hide takes precedence. */
        html.hn-hidevisited tr.athing.hn-visited,
        html.hn-hidevisited tr.athing.hn-visited + tr,
        html.hn-hidevisited tr.athing.hn-visited + tr + tr { display: none !important; }

        /* === COLLAPSE-ALL BUTTON (lives in the comment sort bar) ============ */
        #hn-collapse-all-btn { margin-left: auto; }

        /* === COMMENT SORT BAR (html.hn-sortbar) ============================= */
        #hn-sort-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 4px;
            margin-bottom: 4px;
            border-bottom: 1px solid #343536;
        }
        html:not(.hn-sortbar) #hn-sort-bar { display: none !important; }
        #hn-sort-bar span { font-size: 12px; color: #818384 !important; margin-right: 4px; }
        .hn-sort-btn {
            font-size: 12px;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 20px;
            border: 1px solid #343536;
            background-color: #272729;
            color: #818384 !important;
            cursor: pointer;
            transition: background-color 0.15s, color 0.15s, border-color 0.15s;
            user-select: none;
        }
        .hn-sort-btn:hover { border-color: #818384; color: #d7dadc !important; }
        .hn-sort-btn.active { background-color: #ff6314; border-color: #ff6314; color: #ffffff !important; }

        /* === FLOATING NEXT-PARENT BUTTON (html.hn-navbutton) ================ */
        #hn-next-parent-btn {
            position: fixed;
            bottom: 84px;
            right: 28px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: #ff6314;
            color: #ffffff;
            font-size: 22px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(0,0,0,0.5);
            z-index: 9999;
            border: none;
            transition: background-color 0.15s, transform 0.1s;
            user-select: none;
        }
        html:not(.hn-navbutton) #hn-next-parent-btn { display: none !important; }
        #hn-next-parent-btn:hover { background-color: #e55a10; transform: scale(1.08); }
        #hn-next-parent-btn:active { transform: scale(0.95); }

        /* === STICKY STORY HEADER (html.hn-stickyheader) ===================== */
        #hn-sticky {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9998;
            background: #272729;
            color: #d7dadc;
            border-bottom: 1px solid #343536;
            padding: 8px 14px;
            font-family: sans-serif;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 12px;
            transform: translateY(-100%);
            transition: transform 0.18s ease;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
        }
        #hn-sticky.hn-sticky-visible { transform: none; }
        html:not(.hn-stickyheader) #hn-sticky { display: none !important; }
        #hn-sticky .hn-sticky-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #hn-sticky a { color: #d7dadc; text-decoration: none; }
        #hn-sticky a:hover { text-decoration: underline; }
        #hn-sticky .hn-sticky-new { color: #ff6314; font-weight: 700; white-space: nowrap; }
        #hn-sticky .hn-sticky-top { color: #ff6314; font-weight: 700; cursor: pointer; white-space: nowrap; }

        /* === SETTINGS BUTTON & PANEL ======================================== */
        #hn-settings-btn {
            position: fixed;
            bottom: 28px; right: 28px;
            width: 48px; height: 48px;
            border-radius: 50%;
            background-color: #272729;
            color: #d7dadc;
            border: 1px solid #343536;
            font-size: 22px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 4px 14px rgba(0,0,0,0.5);
            transition: transform 0.1s, color 0.15s, border-color 0.15s;
            user-select: none;
        }
        #hn-settings-btn:hover { color: #fff; border-color: #818384; transform: rotate(40deg); }

        #hn-settings-panel {
            position: fixed;
            bottom: 88px; right: 28px;
            width: 280px;
            max-height: 72vh;
            overflow-y: auto;
            background: #1f1f21;
            color: #d7dadc;
            border: 1px solid #343536;
            border-radius: 10px;
            padding: 14px 16px;
            z-index: 10000;
            box-shadow: 0 8px 28px rgba(0,0,0,0.6);
            font-family: sans-serif;
            font-size: 13px;
            display: none;
        }
        #hn-settings-panel.hn-open { display: block; }
        #hn-settings-panel h3 { margin: 0 0 10px; font-size: 14px; color: #fff; }
        #hn-settings-panel label.hn-check {
            display: flex; align-items: center; gap: 8px;
            margin: 7px 0; cursor: pointer;
        }
        #hn-settings-panel .hn-field { margin: 12px 0 4px; }
        #hn-settings-panel .hn-field > span { display: block; margin-bottom: 4px; color: #aaa; }
        #hn-settings-panel .hn-field .hn-val { float: right; color: #818384; }
        #hn-settings-panel input[type="range"] { width: 100%; accent-color: #ff6314; }
        #hn-settings-panel select {
            width: 100%;
            background: #272729; color: #d7dadc;
            border: 1px solid #343536; border-radius: 4px; padding: 4px;
        }
        #hn-settings-panel hr { border: none; border-top: 1px solid #343536; margin: 12px 0; }
        #hn-settings-panel .hn-hint { color: #777; font-size: 11px; line-height: 1.5; }
        #hn-settings-panel .hn-hint kbd {
            background: #272729; border: 1px solid #343536; border-radius: 3px;
            padding: 0 4px; font-family: monospace; color: #d7dadc;
        }

    `;
    document.documentElement.appendChild(style);

    // Separate style element for live-updated font/width/line-height prefs.
    prefStyle = document.createElement('style');
    prefStyle.textContent = prefsCSS(settings);
    document.documentElement.appendChild(prefStyle);

    // Apply settings immediately (at document-start) so the theme shows with no flash.
    applySettings(settings);

    // If dark mode is set to 'auto', react to the OS theme changing live.
    if (window.matchMedia) {
        try {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
                if (settings.darkMode === 'auto') setClass('hn-dark', darkActive(settings));
            });
        } catch (e) { /* older browsers: no live OS-theme updates */ }
    }


    // =========================================================================
    // SHARED HELPERS
    // =========================================================================

    // Is an element currently visible (not collapsed/display:none)?
    function isVisible(el) {
        return !!el && el.getClientRects().length > 0;
    }

    // Parse a comment row's post time (ms since epoch) from its <span class="age">.
    // Handles three formats robustly:
    //   1. Newer HN: title="2025-06-10T18:30:00 1749580200" (trailing unix seconds)
    //   2. ISO-ish: title="2024-03-01 14:22:05" or "2024-03-01T14:22:05"
    //   3. Fallback: relative link text like "3 hours ago"
    function parseRowTime(ageSpan, ageLink) {
        if (ageSpan && ageSpan.title) {
            var parts = ageSpan.title.trim().split(/\s+/);
            var last = parts[parts.length - 1];
            if (parts.length > 1 && /^\d{9,}$/.test(last)) {
                var secs = parseInt(last, 10);
                if (!isNaN(secs)) return secs * 1000;
            }
            var iso = (parts[0].indexOf('T') === -1 && parts.length > 1)
                ? parts[0] + 'T' + parts[1]
                : parts[0];
            var t = new Date(iso).getTime();
            if (!isNaN(t)) return t;
        }
        if (ageLink) {
            var text = ageLink.textContent.trim();
            var now = Date.now(), m;
            if ((m = text.match(/(\d+)\s+minute/))) return now - m[1] * 60000;
            if ((m = text.match(/(\d+)\s+hour/)))   return now - m[1] * 3600000;
            if ((m = text.match(/(\d+)\s+day/)))     return now - m[1] * 86400000;
            if ((m = text.match(/(\d+)\s+month/)))   return now - m[1] * 2592000000;
            if ((m = text.match(/(\d+)\s+year/)))    return now - m[1] * 31536000000;
        }
        return 0;
    }

    // The parent comment row of a given row = the nearest preceding .comtr with
    // a smaller data-depth. Used for "replies to you" and the `p` nav shortcut.
    function parentOf(row) {
        var d = parseInt(row.getAttribute('data-depth'), 10);
        var p = row.previousElementSibling;
        while (p) {
            if (p.classList && p.classList.contains('comtr')) {
                var pd = parseInt(p.getAttribute('data-depth'), 10);
                if (pd < d) return p;
            }
            p = p.previousElementSibling;
        }
        return null;
    }

    // --- VISITED-STORY STORE ---
    function getVisited() {
        try { return JSON.parse(localStorage.getItem('hn-visited') || '{}'); }
        catch (e) { return {}; }
    }
    function markVisited(id) {
        if (!id) return;
        var v = getVisited();
        v[id] = Date.now();
        // Prune to the most-recent 3000 ids so the store can't grow unbounded
        var keys = Object.keys(v);
        if (keys.length > 3000) {
            keys.sort(function (a, b) { return v[a] - v[b]; });
            for (var i = 0; i < keys.length - 3000; i++) delete v[keys[i]];
        }
        try { localStorage.setItem('hn-visited', JSON.stringify(v)); } catch (e) { /* ignore */ }
    }


    // =========================================================================
    // MAIN: runs once the DOM is ready
    // =========================================================================
    document.addEventListener('DOMContentLoaded', function () {

        buildSettingsUI();

        var isItemPage = window.location.pathname === '/item';
        if (isItemPage) {
            // Record that we've now viewed this story (for visited dimming elsewhere)
            var itemId = new URLSearchParams(window.location.search).get('id');
            markVisited(itemId);
            initItemPage(itemId);
        } else {
            initListPage();
        }

        initKeyboardNav(isItemPage);
    });


    // =========================================================================
    // ITEM PAGE: comment-thread features
    // =========================================================================
    function initItemPage(itemId) {

        var commentRows = Array.from(document.querySelectorAll('.comtr'));

        // --- DEPTH ASSIGNMENT (always computed; CSS colouring is gated separately) ---
        var indentSet = new Set();
        commentRows.forEach(function (row) {
            var img = row.querySelector('td.ind img');
            indentSet.add(img ? parseInt(img.getAttribute('width'), 10) : 0);
        });
        var indentLevels = Array.from(indentSet).sort(function (a, b) { return a - b; });
        var depthByWidth = new Map();
        indentLevels.forEach(function (w, depth) { depthByWidth.set(w, depth); });

        commentRows.forEach(function (row) {
            var img = row.querySelector('td.ind img');
            var w = img ? parseInt(img.getAttribute('width'), 10) : 0;
            row.setAttribute('data-depth', depthByWidth.get(w));
        });

        // --- WHO IS OP / WHO AM I ---
        var fatitem = document.querySelector('.fatitem');
        var subEl = fatitem ? fatitem.querySelector('.hnuser') : null;
        var submitter = subEl ? subEl.textContent.trim() : null;

        var meEl = document.querySelector('span.pagetop a[href^="user?id="]');
        var me = meEl ? meEl.textContent.trim() : null;

        // --- NEW-COMMENT BASELINE ---
        // Read the timestamp of our previous visit BEFORE overwriting it, so we
        // can highlight everything posted since. First-ever visit highlights nothing.
        var seenKey = 'hn-seen-' + (itemId || 'x');
        var lastSeen = 0;
        try { lastSeen = parseInt(localStorage.getItem(seenKey), 10) || 0; } catch (e) { lastSeen = 0; }

        var newCount = 0;

        // --- SINGLE PASS over comments: time, new badge, OP badge, reply badge ---
        commentRows.forEach(function (row) {
            var ageSpan = row.querySelector('.age');
            var ageLink = ageSpan ? ageSpan.querySelector('a') : null;
            var time = parseRowTime(ageSpan, ageLink);
            row._hnTime = time; // cache for the sort feature below

            var comhead = row.querySelector('.comhead');
            var userEl = row.querySelector('.hnuser');
            var userName = userEl ? userEl.textContent.trim() : null;

            // New comment?
            if (lastSeen && time > lastSeen) {
                row.classList.add('hn-new-comment');
                newCount++;
                if (comhead) {
                    var nb = document.createElement('span');
                    nb.className = 'hn-new-badge';
                    nb.textContent = 'new';
                    comhead.appendChild(nb);
                }
            }

            // OP badge
            if (submitter && userName === submitter && userEl) {
                var ob = document.createElement('span');
                ob.className = 'hn-op-badge';
                ob.textContent = 'OP';
                userEl.insertAdjacentElement('afterend', ob);
            }

            // Reply-to-you badge (this comment's parent was written by me)
            if (me) {
                var parent = parentOf(row);
                var parentUser = parent ? parent.querySelector('.hnuser') : null;
                if (parentUser && parentUser.textContent.trim() === me && comhead) {
                    var rb = document.createElement('span');
                    rb.className = 'hn-reply-badge';
                    rb.textContent = 'reply to you';
                    comhead.appendChild(rb);
                }
            }
        });

        // Update our "last seen" stamp to now for the next visit
        try { localStorage.setItem(seenKey, String(Date.now())); } catch (e) { /* ignore */ }

        // --- COLLAPSIBLE COMMENT TEXTAREA ---
        var textarea = document.querySelector('textarea#text')
                    || document.querySelector('textarea[name="text"]')
                    || document.querySelector('form textarea');
        if (textarea) {
            textarea.classList.add('hn-textarea-collapsed');
            textarea.addEventListener('focus', function () {
                textarea.classList.remove('hn-textarea-collapsed');
                textarea.classList.add('hn-textarea-expanded');
            });
            textarea.addEventListener('blur', function () {
                if (textarea.value.trim() === '') {
                    textarea.classList.remove('hn-textarea-expanded');
                    textarea.classList.add('hn-textarea-collapsed');
                }
            });
        }

        // --- STICKY STORY HEADER ---
        initStickyHeader(newCount);

        // --- FLOATING NEXT-PARENT BUTTON ---
        var parentComments = Array.from(document.querySelectorAll('.comtr[data-depth="0"]'));

        var nextBtn = document.createElement('button');
        nextBtn.id = 'hn-next-parent-btn';
        nextBtn.title = 'Next top-level comment';
        nextBtn.setAttribute('aria-label', 'Scroll to next top-level comment');
        nextBtn.textContent = '↓';
        document.body.appendChild(nextBtn);

        function goNextParent() {
            var scrollY = window.scrollY + 10;
            var next = null;
            for (var i = 0; i < parentComments.length; i++) {
                if (!isVisible(parentComments[i])) continue;
                var topEdge = parentComments[i].getBoundingClientRect().top + window.scrollY;
                if (topEdge > scrollY) { next = parentComments[i]; break; }
            }
            if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
            else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
        nextBtn.addEventListener('click', function () {
            goNextParent();
            nextBtn.blur(); // release focus so j/k keyboard nav keeps working
        });

        // Shift+ArrowDown mirrors the button
        document.addEventListener('keydown', function (e) {
            if (e.shiftKey && e.key === 'ArrowDown' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (isTyping()) return;
                e.preventDefault();
                goNextParent();
            }
        });

        // --- COMMENT SORT BAR ---
        buildSortBar(commentRows, function (newParents) { parentComments = newParents; });
    }


    // =========================================================================
    // COLLAPSE / EXPAND ALL
    // Reuses HN's own per-comment toggle links (a.togg) — the exact mechanism
    // the per-comment `c` keyboard shortcut clicks — so collapse-all and
    // per-comment collapse never disagree about what "collapsed" means.
    // =========================================================================
    function setAllCollapsed(collapse) {
        Array.from(document.querySelectorAll('.comtr a.togg')).forEach(function (togg) {
            // HN renders toggles as "[–]" when expanded and "[+N]" when
            // collapsed; only click the ones that need to change state.
            var isCollapsed = togg.textContent.indexOf('+') !== -1;
            if (isCollapsed !== collapse) togg.click();
        });
    }

    // Appended to the sort bar, so it exists only on item pages (where
    // comments — and the sort bar — exist). The label tracks live state so it
    // stays correct even after per-comment `c` toggles or thread re-sorts.
    function initCollapseAll(sortBar) {
        var btn = document.createElement('button');
        btn.id = 'hn-collapse-all-btn';
        btn.className = 'hn-sort-btn';

        function anyExpanded() {
            var toggs = document.querySelectorAll('.comtr a.togg');
            for (var i = 0; i < toggs.length; i++) {
                if (toggs[i].textContent.indexOf('–') !== -1) return true;
            }
            return false;
        }
        function syncLabel() {
            btn.textContent = anyExpanded() ? 'Collapse all' : 'Expand all';
        }
        btn.addEventListener('click', function () {
            setAllCollapsed(anyExpanded());
            syncLabel();
            btn.blur(); // release focus so j/k keyboard nav keeps working
        });

        syncLabel();
        sortBar.appendChild(btn);
    }


    // =========================================================================
    // STICKY STORY HEADER
    // =========================================================================
    function initStickyHeader(newCount) {
        var titleLink = document.querySelector('.fatitem .titleline a') || document.querySelector('.titleline a');
        if (!titleLink) return;

        var titleEl = titleLink.closest('.titleline') || titleLink;

        var bar = document.createElement('div');
        bar.id = 'hn-sticky';

        var top = document.createElement('span');
        top.className = 'hn-sticky-top';
        top.textContent = '▲ top';
        top.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        var title = document.createElement('span');
        title.className = 'hn-sticky-title';
        var titleAnchor = document.createElement('a');
        titleAnchor.setAttribute('href', titleLink.getAttribute('href'));
        titleAnchor.textContent = titleLink.textContent;
        title.appendChild(titleAnchor);

        bar.appendChild(top);
        bar.appendChild(title);

        if (newCount > 0) {
            var newEl = document.createElement('span');
            newEl.className = 'hn-sticky-new';
            newEl.textContent = newCount + ' new';
            bar.appendChild(newEl);
        }

        document.body.appendChild(bar);

        // Show the bar once the original title has scrolled out of view.
        var threshold = titleEl.getBoundingClientRect().bottom + window.scrollY;
        var ticking = false;
        function onScroll() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                bar.classList.toggle('hn-sticky-visible', window.scrollY > threshold);
                ticking = false;
            });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
    }


    // =========================================================================
    // COMMENT SORT BAR
    // CAVEAT: HN does not expose per-comment scores in its HTML *or* via its
    // public APIs, so true score-based sorting is impossible. Proxies used:
    //   Best          HN's original order (restored)
    //   New           post timestamp
    //   Top           total reply count
    //   Controversial replies per hour
    // =========================================================================
    function buildSortBar(allRows, onReorder) {
        var firstComtr = document.querySelector('.comtr');
        if (!firstComtr) return;
        var commentTbody = firstComtr.parentElement;

        // Group each depth-0 root with all of its descendant rows
        var groups = [];
        var currentGroup = null;
        allRows.forEach(function (row) {
            var depth = parseInt(row.getAttribute('data-depth'), 10);
            if (depth === 0) {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = { root: row, children: [], timestamp: row._hnTime || 0, replyCount: 0 };
            } else if (currentGroup) {
                currentGroup.children.push(row);
                currentGroup.replyCount++;
            }
        });
        if (currentGroup) groups.push(currentGroup);

        // Snapshot of the original order. Deep-copy the group objects (not
        // just the array) so the copy stays intact even if the group objects
        // are ever mutated later (e.g. replyCount updated by a future feature).
        var originalGroups = groups.map(function (g) {
            return { root: g.root, children: g.children.slice(), timestamp: g.timestamp, replyCount: g.replyCount };
        });

        function sortByNew(g) {
            return g.slice().sort(function (a, b) { return b.timestamp - a.timestamp; });
        }
        function sortByTop(g) {
            return g.slice().sort(function (a, b) { return b.replyCount - a.replyCount; });
        }
        function sortByControversial(g) {
            var now = Date.now();
            return g.slice().sort(function (a, b) {
                var ageA = Math.max((now - a.timestamp) / 3600000, 0.1);
                var ageB = Math.max((now - b.timestamp) / 3600000, 0.1);
                return (b.replyCount / ageB) - (a.replyCount / ageA);
            });
        }

        function applySort(sortedGroups) {
            allRows.forEach(function (row) {
                if (row.parentElement) row.parentElement.removeChild(row);
            });
            sortedGroups.forEach(function (group) {
                commentTbody.appendChild(group.root);
                group.children.forEach(function (child) { commentTbody.appendChild(child); });
            });
            onReorder(sortedGroups.map(function (g) { return g.root; }));
        }

        var sortBarRow = document.createElement('tr');
        var sortBarCell = document.createElement('td');
        sortBarCell.setAttribute('colspan', '2');

        var sortBar = document.createElement('div');
        sortBar.id = 'hn-sort-bar';

        var sortLabel = document.createElement('span');
        sortLabel.textContent = 'Sort by:';
        sortBar.appendChild(sortLabel);

        var sortOptions = [
            { label: 'Best',          fn: null },
            { label: 'New',           fn: sortByNew },
            { label: 'Top',           fn: sortByTop },
            { label: 'Controversial', fn: sortByControversial }
        ];

        sortOptions.forEach(function (option) {
            var btn = document.createElement('button');
            btn.className = 'hn-sort-btn';
            btn.textContent = option.label;
            if (option.label === 'Best') btn.classList.add('active');

            btn.addEventListener('click', function () {
                sortBar.querySelectorAll('.hn-sort-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                applySort(option.fn ? option.fn(groups) : originalGroups.slice());
                sortBarRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            sortBar.appendChild(btn);
        });

        initCollapseAll(sortBar);

        sortBarCell.appendChild(sortBar);
        sortBarRow.appendChild(sortBarCell);
        commentTbody.insertBefore(sortBarRow, firstComtr);
    }


    // =========================================================================
    // LIST PAGE: visited-story dimming
    // =========================================================================
    function initListPage() {
        var visited = getVisited();

        // Dim stories already visited, and record new clicks as they happen.
        document.querySelectorAll('tr.athing[id]').forEach(function (row) {
            if (visited[row.id]) row.classList.add('hn-visited');
            var link = row.querySelector('.titleline a');
            if (link) {
                link.addEventListener('click', function () {
                    markVisited(row.id);
                    row.classList.add('hn-visited');
                });
            }
        });

        // Clicking a "N comments" link also counts as visiting that story.
        document.querySelectorAll('a[href^="item?id="]').forEach(function (a) {
            a.addEventListener('click', function () {
                var m = a.getAttribute('href').match(/id=(\d+)/);
                if (!m) return;
                markVisited(m[1]);
                var r = document.getElementById(m[1]);
                if (r) r.classList.add('hn-visited');
            });
        });
    }


    // =========================================================================
    // KEYBOARD NAVIGATION  (j/k move · p parent · c collapse · o/Enter open)
    // =========================================================================
    function isTyping() {
        var el = document.activeElement;
        if (!el) return false;
        var tag = el.tagName;
        return tag === 'TEXTAREA' || tag === 'INPUT' || el.isContentEditable;
    }

    function initKeyboardNav(isItemPage) {
        var current = null;

        function navItems() {
            var sel = isItemPage ? 'tr.comtr' : 'tr.athing[id]';
            return Array.from(document.querySelectorAll(sel)).filter(isVisible);
        }

        function setCurrent(el) {
            if (current) current.classList.remove('hn-nav-current');
            current = el;
            if (current) {
                current.classList.add('hn-nav-current');
                current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function move(dir) {
            var items = navItems();
            if (!items.length) return;
            var idx = current ? items.indexOf(current) : -1;
            if (idx === -1) {
                // No current row yet — pick the first one at/below the viewport top
                for (var i = 0; i < items.length; i++) {
                    if (items[i].getBoundingClientRect().top > -5) { idx = i; break; }
                }
                if (idx === -1) idx = 0;
            } else {
                idx = Math.min(Math.max(idx + dir, 0), items.length - 1);
            }
            setCurrent(items[idx]);
        }

        function collapseCurrent() {
            if (!current) return;
            var togg = current.querySelector('a.togg');
            if (togg) togg.click();
        }

        function gotoParent() {
            if (!current || !isItemPage) return;
            var p = parentOf(current);
            if (p) setCurrent(p);
        }

        function openCurrent() {
            if (!current) return;
            var link = isItemPage
                ? current.querySelector('.commtext a')
                : current.querySelector('.titleline a');
            if (link) window.open(link.href, '_blank', 'noopener,noreferrer');
        }

        document.addEventListener('keydown', function (e) {
            if (!settings.keyboardNav) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            // Don't hijack keys while typing, or while a link/button/select has
            // focus — Enter should still activate a focused control normally.
            var ae = document.activeElement;
            if (isTyping()) return;
            if (ae && /^(A|BUTTON|SELECT)$/.test(ae.tagName)) return;

            switch (e.key) {
                case 'j': e.preventDefault(); move(1); break;
                case 'k': e.preventDefault(); move(-1); break;
                case 'p': e.preventDefault(); gotoParent(); break;
                case 'c': e.preventDefault(); collapseCurrent(); break;
                case 'o':
                case 'Enter':
                    // Only consume the key when we actually have a row to open
                    if (current) { e.preventDefault(); openCurrent(); }
                    break;
                default: break;
            }
        });
    }


    // =========================================================================
    // SETTINGS UI: gear button + panel
    // =========================================================================
    function buildSettingsUI() {
        var btn = document.createElement('div');
        btn.id = 'hn-settings-btn';
        btn.title = 'HN Enhancer settings';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Open HN Enhancer settings');
        btn.textContent = '⚙';
        document.body.appendChild(btn);

        var panel = document.createElement('div');
        panel.id = 'hn-settings-panel';
        document.body.appendChild(panel);

        var heading = document.createElement('h3');
        heading.textContent = 'HN Enhancer';
        panel.appendChild(heading);

        // Dark mode select
        var darkField = document.createElement('div');
        darkField.className = 'hn-field';
        var darkLabel = document.createElement('span');
        darkLabel.textContent = 'Dark mode';
        var darkSelect = document.createElement('select');
        [['on', 'On'], ['off', 'Off'], ['auto', 'Auto (match system)']].forEach(function (opt) {
            var o = document.createElement('option');
            o.value = opt[0];
            o.textContent = opt[1];
            if (settings.darkMode === opt[0]) o.selected = true;
            darkSelect.appendChild(o);
        });
        darkSelect.addEventListener('change', function () {
            settings.darkMode = darkSelect.value;
            saveSettings(settings);
            applySettings(settings);
        });
        darkField.appendChild(darkLabel);
        darkField.appendChild(darkSelect);
        panel.appendChild(darkField);

        // Boolean feature toggles
        var toggles = [
            ['depthColors',  'Comment depth colours'],
            ['newComments',  'Highlight new comments'],
            ['opHighlight',  'Highlight OP & replies to you'],
            ['keyboardNav',  'Keyboard navigation'],
            ['sortBar',      'Comment sort bar'],
            ['navButton',    'Floating next-parent button'],
            ['stickyHeader', 'Sticky story header'],
            ['visitedDim',   'Dim visited stories'],
            ['hideVisited',  'Hide visited stories (instead of dimming)']
        ];
        toggles.forEach(function (t) {
            var label = document.createElement('label');
            label.className = 'hn-check';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!settings[t[0]];
            cb.addEventListener('change', function () {
                settings[t[0]] = cb.checked;
                saveSettings(settings);
                applySettings(settings);
            });
            label.appendChild(cb);
            label.appendChild(document.createTextNode(t[1]));
            panel.appendChild(label);
        });

        panel.appendChild(document.createElement('hr'));

        // Sliders: font size, line height, content width
        function addSlider(key, label, min, max, step, fmt) {
            var field = document.createElement('div');
            field.className = 'hn-field';
            var span = document.createElement('span');
            span.textContent = label;
            var val = document.createElement('span');
            val.className = 'hn-val';
            span.appendChild(val);
            var range = document.createElement('input');
            range.type = 'range';
            range.min = min; range.max = max; range.step = step;
            range.value = settings[key];
            function render() { val.textContent = fmt(parseFloat(range.value)); }
            render();
            range.addEventListener('input', function () {
                settings[key] = parseFloat(range.value);
                render();
                saveSettings(settings);
                applySettings(settings);
            });
            field.appendChild(span);
            field.appendChild(range);
            panel.appendChild(field);
        }
        addSlider('fontSize',   'Font size',    11, 20,  1,   function (v) { return v + 'px'; });
        addSlider('lineHeight', 'Line height',  1.2, 2.0, 0.1, function (v) { return v.toFixed(1); });
        addSlider('width',      'Content width', 0, 1600, 50,  function (v) { return v === 0 ? 'Native' : v + 'px'; });

        panel.appendChild(document.createElement('hr'));

        var hint = document.createElement('div');
        hint.className = 'hn-hint';
        hint.innerHTML = 'Keys: <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>p</kbd> parent · ' +
                         '<kbd>c</kbd> collapse · <kbd>o</kbd> open · <kbd>Shift</kbd>+<kbd>↓</kbd> next thread';
        panel.appendChild(hint);

        // Toggle the panel open/closed; close when clicking elsewhere
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            panel.classList.toggle('hn-open');
        });
        document.addEventListener('click', function (e) {
            if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('hn-open');
        });
        panel.addEventListener('click', function (e) { e.stopPropagation(); });
    }

})();
