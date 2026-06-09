// ==UserScript==
// @name         Hacker News — Dark Mode & Reddit-Style Comments
// @namespace    https://github.com/NoIdeaDeveloper/314Block-Userscripts
// @version      2.0
// @description  Adds dark mode, Reddit-style colour-coded comment threads, and a next-parent navigation button
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
    // SECTION 1: INJECT CSS
    // All visual styling is handled here — dark mode colours, comment indent
    // colour coding, and the floating navigation button.
    // =========================================================================
    var style = document.createElement('style');
    style.textContent = `

        /* --- DARK MODE BASE --- */
        /* Override HN's default white/orange with a dark background palette */
        html, body {
            background-color: #1a1a1b !important;
            color: #d7dadc !important;
        }

        /* The main page table that wraps everything */
        body > center > table,
        body > center > table td {
            background-color: #1a1a1b !important;
        }

        /* The orange header bar — darken it to a deep charcoal */
        #hnmain > tbody > tr:first-child td,
        .pagetop,
        .pagetop a,
        td[bgcolor="#ff6600"] {
            background-color: #272729 !important;
            color: #d7dadc !important;
        }

        /* Nav links in the header */
        .pagetop a {
            color: #818384 !important;
        }
        .pagetop a:hover {
            color: #d7dadc !important;
        }

        /* The thin spacer line between header and content */
        .pagetop + tr td {
            background-color: #343536 !important;
        }

        /* Story list rows */
        .athing {
            background-color: #1a1a1b !important;
        }

        /* Story titles */
        .titleline > a,
        .titleline > a:visited {
            color: #d7dadc !important;
            font-size: 14px !important;
        }

        /* Site domain label next to story title e.g. (github.com) */
        .sitebit a, .sitestr {
            color: #818384 !important;
        }

        /* Story metadata row — points, author, age, comments link */
        .subtext, .subtext a {
            color: #818384 !important;
        }

        /* Hover colour for metadata links */
        .subtext a:hover {
            color: #d7dadc !important;
            text-decoration: underline;
        }

        /* FIX 1: Force ALL text inside comment rows to be light coloured.
           HN sometimes inlines color="black" or color="#000000" directly on
           <font> tags inside comments, which overrides class-level CSS.
           Targeting every element inside .comtr ensures nothing slips through. */
        .comtr * {
            color: #d7dadc !important;
        }

        /* Re-apply specific colour overrides that the wildcard above would flatten */

        /* Commenter username — orange accent */
        .hnuser, a.hnuser {
            color: #ff6314 !important;
            font-weight: 600;
        }

        /* Comment age / timestamp and reply link — muted grey */
        .age a, .reply a {
            color: #818384 !important;
        }
        .reply a:hover, .age a:hover {
            color: #d7dadc !important;
        }

        /* Links inside comment bodies — blue accent */
        .comment a {
            color: #4fbdff !important;
        }

        /* Vote arrow buttons — keep them visible on dark background */
        .votearrow {
            filter: invert(60%) !important;
        }

        /* The footer bar background */
        #hnmain > tbody > tr:last-child td {
            background-color: #272729 !important;
        }

        /* FOOTER FIX: HN's footer contains a <span class="yclinks"> with plain <a> tags
           and also bare text nodes. The wildcard selector ensures every element inside
           the footer row is forced to white, overriding any inherited grey. */
        #hnmain > tbody > tr:last-child td,
        #hnmain > tbody > tr:last-child td *,
        .yclinks,
        .yclinks * {
            color: #d7dadc !important;
        }
        .yclinks a:hover {
            color: #ffffff !important;
            text-decoration: underline;
        }

        /* Text input fields (e.g. search, submit) */
        input, textarea {
            background-color: #272729 !important;
            color: #d7dadc !important;
            border: 1px solid #343536 !important;
        }

        /* Buttons */
        input[type="submit"] {
            background-color: #343536 !important;
            color: #d7dadc !important;
            border: 1px solid #818384 !important;
            cursor: pointer;
        }

        /* More / pagination link */
        a.morelink {
            color: #ff6314 !important;
        }

        /* --- COLLAPSIBLE COMMENT TEXTAREA ---
           The main reply textarea starts compact at 4 rows tall.
           When the user clicks into it, it smoothly expands to 8 rows.
           HN's default textarea font is roughly 16px with ~1.4 line-height,
           so 1 row ≈ 22px. We add a little padding on top to account for
           the textarea's internal padding (~8px top + 8px bottom = 16px). */

        /* Collapsed state: 4 rows = (4 × 22px) + 16px padding = ~104px
           Uses a plain textarea selector (no id) so it matches regardless of
           what name attribute HN assigns to the element. */
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

        /* Expanded state: 8 rows = (8 × 22px) + 16px padding = ~192px.
           An orange focus ring signals that the field is active. */
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

        /* --- COMMENT DEPTH COLOUR CODING ---
           The coloured border is now applied to the .commtext div (the actual
           comment content block) rather than the outer table. This places the
           border right beside the comment text instead of at the screen edge. */
        .comtr .commtext {
            padding-left: 8px !important;
            border-left: 3px solid transparent;
        }

        /* Each depth level gets its own colour. The data-depth attribute is set
           by our JavaScript below based on HN's indentation spacer widths. */
        [data-depth="0"] .commtext { border-left-color: transparent !important; }
        [data-depth="1"] .commtext { border-left-color: #ff4500 !important; }
        [data-depth="2"] .commtext { border-left-color: #0dd3bb !important; }
        [data-depth="3"] .commtext { border-left-color: #ffb000 !important; }
        [data-depth="4"] .commtext { border-left-color: #46d160 !important; }
        [data-depth="5"] .commtext { border-left-color: #cc69b9 !important; }
        [data-depth="6"] .commtext { border-left-color: #0079d3 !important; }
        [data-depth="7"] .commtext { border-left-color: #ff585b !important; }
        /* Cycle back for very deep threads */
        [data-depth="8"] .commtext { border-left-color: #ff4500 !important; }
        [data-depth="9"] .commtext { border-left-color: #0dd3bb !important; }

        /* --- COMMENT SORT BAR ---
           A row of sort buttons inserted above the comment list.
           Styled to blend with the dark theme. */
        #hn-sort-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 4px;
            margin-bottom: 4px;
            border-bottom: 1px solid #343536;
        }

        /* Label text before the buttons */
        #hn-sort-bar span {
            font-size: 12px;
            color: #818384 !important;
            margin-right: 4px;
        }

        /* Each sort button */
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

        .hn-sort-btn:hover {
            border-color: #818384;
            color: #d7dadc !important;
        }

        /* The currently active sort button gets an orange highlight */
        .hn-sort-btn.active {
            background-color: #ff6314;
            border-color: #ff6314;
            color: #ffffff !important;
        }


        /* --- FLOATING NEXT-PARENT BUTTON ---
           A circular button fixed to the bottom-right corner of the screen.
           Clicking it scrolls down to the next top-level (depth 0) comment. */
        #hn-next-parent-btn {
            position: fixed;
            bottom: 28px;
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

        #hn-next-parent-btn:hover {
            background-color: #e55a10;
            transform: scale(1.08);
        }

        #hn-next-parent-btn:active {
            transform: scale(0.95);
        }

    `;
    document.documentElement.appendChild(style);


    // =========================================================================
    // SECTION 2: WAIT FOR THE PAGE TO LOAD BEFORE RUNNING JS
    // document-start fires before the DOM exists, so we wait for DOMContentLoaded
    // =========================================================================
    document.addEventListener('DOMContentLoaded', function () {

        // Only run the comment features on thread/item pages, not the front page
        var isItemPage = window.location.pathname === '/item';
        if (!isItemPage) return;

        // =====================================================================
        // SECTION 3: CALCULATE COMMENT DEPTH
        // HN uses indentation via a spacer <img> whose width tells us how deep
        // each comment is nested. We read that width and convert it to a depth
        // number, stored as a data-depth attribute on each comment row so our
        // CSS colour rules can target it.
        // =====================================================================

        // Grab all comment rows — HN gives each one the class "comtr"
        var commentRows = document.querySelectorAll('.comtr');

        // Collect all unique indent widths using a Set for O(1) dedup
        var indentSet = new Set();
        commentRows.forEach(function (row) {
            var indentImg = row.querySelector('td.ind img');
            var indentWidth = indentImg ? parseInt(indentImg.getAttribute('width'), 10) : 0;
            indentSet.add(indentWidth);
        });

        // Sort the unique widths to create a stable depth mapping, then build a
        // width → depth lookup map. Using the map gives O(1) lookups per comment
        // below, instead of an O(n) indexOf scan for every single row.
        var indentLevels = Array.from(indentSet).sort(function (a, b) { return a - b; });
        var depthByWidth = new Map();
        indentLevels.forEach(function (width, depth) {
            depthByWidth.set(width, depth);
        });

        // Assign depth to each comment row
        commentRows.forEach(function (row) {
            var indentImg = row.querySelector('td.ind img');
            var indentWidth = indentImg ? parseInt(indentImg.getAttribute('width'), 10) : 0;
            var depth = depthByWidth.get(indentWidth);
            row.setAttribute('data-depth', depth);
        });


        // =====================================================================
        // SECTION 4: COLLAPSIBLE COMMENT TEXTAREA
        // Finds the main comment submission textarea and starts it in a compact
        // collapsed state. Expands on focus, collapses on blur if empty.
        // =====================================================================

        var commentTextarea = document.querySelector('textarea#text')
                           || document.querySelector('textarea[name="text"]')
                           || document.querySelector('form textarea');

        if (commentTextarea) {
            // Start the textarea in the collapsed state
            commentTextarea.classList.add('hn-textarea-collapsed');

            // Expand when the user clicks in
            commentTextarea.addEventListener('focus', function () {
                commentTextarea.classList.remove('hn-textarea-collapsed');
                commentTextarea.classList.add('hn-textarea-expanded');
            });

            // Collapse back if the user clicks away and left it empty
            commentTextarea.addEventListener('blur', function () {
                if (commentTextarea.value.trim() === '') {
                    commentTextarea.classList.remove('hn-textarea-expanded');
                    commentTextarea.classList.add('hn-textarea-collapsed');
                }
            });
        }


        // =====================================================================
        // SECTION 5: FLOATING NEXT-PARENT BUTTON
        // Creates a circular arrow button fixed to the bottom-right of the
        // screen. Each click scrolls to the next depth-0 comment below the
        // current scroll position.
        // =====================================================================

        // Declared with var so the sort section below can reassign it after
        // reordering the DOM, keeping navigation in sync with the new order.
        var parentComments = Array.from(document.querySelectorAll('.comtr[data-depth="0"]'));

        // Create and append the button to the page body
        var nextBtn = document.createElement('button');
        nextBtn.id = 'hn-next-parent-btn';
        nextBtn.title = 'Next top-level comment';
        nextBtn.setAttribute('aria-label', 'Scroll to next top-level comment');
        nextBtn.textContent = '↓';
        document.body.appendChild(nextBtn);

        // Keyboard shortcut: Shift+ArrowDown scrolls to next parent comment
        document.addEventListener('keydown', function (e) {
            if (e.shiftKey && e.key === 'ArrowDown' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                // Don't hijack keyboard when user is typing in an input
                var tag = document.activeElement.tagName;
                if (tag === 'TEXTAREA' || tag === 'INPUT') return;
                e.preventDefault();
                nextBtn.click();
            }
        });

        nextBtn.addEventListener('click', function () {
            // Add a small offset so a comment already at the top still counts as passed
            var scrollY = window.scrollY + 10;

            // Find the first parent comment whose top edge is below the current scroll
            var nextParent = null;
            for (var i = 0; i < parentComments.length; i++) {
                var topEdge = parentComments[i].getBoundingClientRect().top + window.scrollY;
                if (topEdge > scrollY) {
                    nextParent = parentComments[i];
                    break;
                }
            }

            if (nextParent) {
                nextParent.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                // No more parent comments — scroll to bottom
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        });


        // =====================================================================
        // SECTION 6: COMMENT SORT BAR
        // Inserts a row of sort buttons above the comment list. Sorts are
        // applied by reordering comment groups (root + its children) in the DOM.
        //
        // CAVEAT: HN does not expose comment scores in its HTML so true
        // score-based sorting is impossible. Proxies used instead:
        //   Best:          HN's original order (restored, no change)
        //   New:           timestamp from the .age span title attribute
        //   Top:           total reply count (most replied = most popular)
        //   Controversial: replies per hour (fast discussion = divisive topic)
        // =====================================================================

        // Only proceed if there are actually comments on this page
        var firstComtr = document.querySelector('.comtr');
        if (!firstComtr) return;

        // HN's comment rows all live inside a single <tbody>
        var commentTbody = firstComtr.parentElement;

        // --- Build comment groups ---
        // Walk all comment rows and group each depth-0 root with all its
        // child rows so they can be moved together as a unit when sorting.
        var allRows = Array.from(commentTbody.querySelectorAll('.comtr'));
        var groups  = [];
        var currentGroup = null;

        allRows.forEach(function (row) {
            var depth = parseInt(row.getAttribute('data-depth'), 10);

            if (depth === 0) {
                // Save the previous group before starting a new one
                if (currentGroup) groups.push(currentGroup);

                // Read the post timestamp using two strategies:
                //
                // Strategy 1: Read the ISO datetime from the title attribute on
                // the <span class="age"> e.g. title="2024-03-01T14:22:05"
                // Safari's Date parser requires a strict ISO 8601 format, so we
                // manually ensure the string is valid before using it.
                //
                // Strategy 2: If Strategy 1 fails or gives an invalid date, fall
                // back to parsing the relative link text ("3 hours ago", "2 days ago")
                // by subtracting the stated duration from the current time.
                var ageSpan  = row.querySelector('.age');
                var ageLink  = ageSpan ? ageSpan.querySelector('a') : null;
                var timestamp = new Date(0); // Default fallback: epoch

                if (ageSpan && ageSpan.title) {
                    // Strategy 1: parse title attribute, replacing space with T if needed
                    var isoStr = ageSpan.title.replace(' ', 'T');
                    var parsed = new Date(isoStr);
                    if (!isNaN(parsed.getTime())) {
                        timestamp = parsed; // Valid date — use it
                    }
                }

                // Strategy 2: if we still have epoch (strategy 1 failed), parse
                // the human-readable link text like "3 hours ago" or "2 days ago"
                if (timestamp.getTime() === 0 && ageLink) {
                    var text = ageLink.textContent.trim();
                    var now   = Date.now();
                    var m;
                    if      ((m = text.match(/(\d+)\s+minute/)))  timestamp = new Date(now - m[1] * 60000);
                    else if ((m = text.match(/(\d+)\s+hour/)))    timestamp = new Date(now - m[1] * 3600000);
                    else if ((m = text.match(/(\d+)\s+day/)))     timestamp = new Date(now - m[1] * 86400000);
                    else if ((m = text.match(/(\d+)\s+month/)))   timestamp = new Date(now - m[1] * 30 * 86400000);
                    else if ((m = text.match(/(\d+)\s+year/)))    timestamp = new Date(now - m[1] * 365 * 86400000);
                }

                currentGroup = {
                    root:        row,
                    children:    [],
                    timestamp:   timestamp,
                    replyCount:  0
                };
            } else if (currentGroup) {
                currentGroup.children.push(row);
                currentGroup.replyCount++;
            }
        });
        // Push the last group after the loop ends
        if (currentGroup) groups.push(currentGroup);

        // Keep a copy of the original order so "Best" can restore it
        var originalGroups = groups.slice();

        // --- Sort functions ---

        // NEW: most recently posted root comment first
        function sortByNew(g) {
            return g.slice().sort(function (a, b) {
                return b.timestamp - a.timestamp;
            });
        }

        // TOP: most total replies first
        function sortByTop(g) {
            return g.slice().sort(function (a, b) {
                return b.replyCount - a.replyCount;
            });
        }

        // CONTROVERSIAL: highest replies-per-hour ratio first
        function sortByControversial(g) {
            var now = Date.now();
            return g.slice().sort(function (a, b) {
                var ageA   = Math.max((now - a.timestamp) / 3600000, 0.1);
                var ageB   = Math.max((now - b.timestamp) / 3600000, 0.1);
                var scoreA = a.replyCount / ageA;
                var scoreB = b.replyCount / ageB;
                return scoreB - scoreA;
            });
        }

        // --- Apply a sort to the DOM ---
        // Removes all comment rows then re-inserts them in the new order.
        // Also refreshes parentComments so the ↓ button stays in sync.
        function applySort(sortedGroups) {
            // Detach every comment row from the DOM
            allRows.forEach(function (row) {
                if (row.parentElement) row.parentElement.removeChild(row);
            });

            // Re-insert in new order: root first, then its children
            sortedGroups.forEach(function (group) {
                commentTbody.appendChild(group.root);
                group.children.forEach(function (child) {
                    commentTbody.appendChild(child);
                });
            });

            // Refresh the next-parent list to match the new visual order
            parentComments = sortedGroups.map(function (g) { return g.root; });
        }

        // --- Build sort bar UI ---
        var sortBarRow  = document.createElement('tr');
        var sortBarCell = document.createElement('td');
        sortBarCell.setAttribute('colspan', '2');

        var sortBar = document.createElement('div');
        sortBar.id  = 'hn-sort-bar';

        var sortLabel = document.createElement('span');
        sortLabel.textContent = 'Sort by:';
        sortBar.appendChild(sortLabel);

        // Button definitions — fn: null means restore original HN order
        var sortOptions = [
            { label: 'Best',          fn: null },
            { label: 'New',           fn: sortByNew },
            { label: 'Top',           fn: sortByTop },
            { label: 'Controversial', fn: sortByControversial }
        ];

        sortOptions.forEach(function (option) {
            var btn = document.createElement('button');
            btn.className   = 'hn-sort-btn';
            btn.textContent = option.label;

            // "Best" is active by default as it reflects HN's original order
            if (option.label === 'Best') btn.classList.add('active');

            btn.addEventListener('click', function () {
                // Update active state on buttons
                sortBar.querySelectorAll('.hn-sort-btn').forEach(function (b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');

                // Apply the chosen sort, or restore original for "Best"
                applySort(option.fn ? option.fn(groups) : originalGroups.slice());

                // Scroll back to the sort bar so the user sees the reordered list
                sortBarRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            sortBar.appendChild(btn);
        });

        sortBarCell.appendChild(sortBar);
        sortBarRow.appendChild(sortBarCell);

        // Insert the sort bar row immediately before the first comment
        commentTbody.insertBefore(sortBarRow, firstComtr);

    }); // end DOMContentLoaded

})();
