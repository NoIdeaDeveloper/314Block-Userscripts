# 314Block Userscripts — Comprehensive Review

Date: 2026-06-09

A thorough review of all 7 userscripts covering stability, performance,
usability, security, and code quality.

---

## STABILITY

### youtube-to-invidious.user.js (simple)

- **No reachability probe.** If Invidious is down, the user sees a blank page
  because the body is hidden (line 60) but no redirect or fallback is shown.
  The `user-` version already has probe logic — port it here or document this
  as intentional.
- **Missing `@downloadURL` / `@updateURL`.** Add the raw GitHub URLs matching
  the `user-` version so Tampermonkey/Violentmonkey can auto-update.
- **Generic `@namespace`.** Currently `http://tampermonkey.net/`. Change to
  `https://github.com/NoIdeaDeveloper/314Block-Userscripts`.
- **`@author` is "You".** Update to `NoIdeaDeveloper`.

### reddit-to-redlib.user.js (simple)

- **No reachability probe.** Same issue as above — user gets a browser error
  page if the single instance is down.
- **Missing `@downloadURL` / `@updateURL`.**
- **Generic `@namespace`.** Update to the repo URL.
- **`@author` is "You".** Update to `NoIdeaDeveloper`.

### hackernews-dark-mode.user.js

- **Missing `@downloadURL` / `@updateURL`.** Add raw GitHub URLs.
- **Generic `@namespace`.** Update to the repo URL.
- **Shallow copy of `originalGroups`.** Line 510: `groups.slice()` copies
  array references, not the group objects themselves. Currently safe because
  `applySort` only reads from groups, but fragile if the code evolves.
- **`Shift+ArrowDown` shortcut.** Lines 392-399: already guards against
  `TEXTAREA`/`INPUT` but doesn't check `contentEditable` elements.

### tophn-co-element-removal.user.js

- **Missing `@downloadURL` / `@updateURL`.**
- **Generic `@namespace`.**
- **No `@run-at` specified.** Defaults to `document-end`. Consider
  `document-start` for faster removal.
- **`setInterval` and `MutationObserver` run simultaneously.** The interval
  (lines 35-44) polls every 200ms for 5s while the observer (lines 55-65)
  watches for future mutations. The interval is redundant once the observer
  starts. Clear it on first successful removal or after a short delay.

### user-medium-to-scribe.user.js

- **Generic `@namespace`.** Change from `http://tampermonkey.net/` to
  `https://github.com/NoIdeaDeveloper/314Block-Userscripts`.
- **History API patching could conflict.** If another userscript also patches
  `history.pushState`/`replaceState`, the two could interfere. No fix needed
  but worth documenting.

### user-reddit-to-redlib.user.js

- **Generic `@namespace`.** Already has `@downloadURL`/`@updateURL` — good.
- **Otherwise stable.** Good error handling, fallback page, probe logic.

### user-youtube-to-invidious.user.js

- **Generic `@namespace`.** Already has `@downloadURL`/`@updateURL` — good.
- **Otherwise stable.** Good probe logic, fallback page, embed overlay.

---

## PERFORMANCE

### hackernews-dark-mode.user.js

- **Wildcard `.comtr *` selector (line 90).** Forces CSS recalculation on
  every descendant of every comment row. On a page with 500+ comments this
  is expensive. Replace with targeted selectors:
  ```css
  .comtr .commtext, .comtr .age, .comtr .hnuser, .comtr .reply,
  .comtr .votearrow, .comtr .default { color: #d7dadc !important; }
  ```
- **`indentLevels.indexOf()` is O(n) per comment (line 337).** Use a `Map`
  or plain object for O(1) lookup:
  ```js
  var indentMap = {};
  indentLevels.forEach(function(w, i) { indentMap[w] = i; });
  // then: depth = indentMap[indentWidth]
  ```

### tophn-co-element-removal.user.js

- **`setInterval` polls every 200ms for up to 5s (lines 35-44).** The
  `MutationObserver` already handles dynamically loaded elements. The
  interval is only needed for elements that exist at page load but after
  the script runs. Consider reducing `MAX_WAIT` to 2000ms or stopping
  the interval once the observer fires for the first time.

### user-youtube-to-invidious.user.js

- **`processAllCards()` queries entire DOM on every mutation batch
  (line 686).** The `data-invidious-injected` attribute prevents
  re-processing, so this is safe but could be scoped to a subtree if
  DDG's video container has a stable ancestor.
- **`isVideosTab()` creates new `URLSearchParams` on every call
  (line 706).** Cache the parsed params and invalidate on navigation.

---

## USABILITY

### youtube-to-invidious.user.js (simple)

- **No fallback if Invidious is unreachable.** The body is hidden (line 60)
  but if the redirect fails or the instance is down, the user sees a blank
  page. Add an unreachable-instance message page like the `user-` version.

### reddit-to-redlib.user.js (simple)

- **No fallback if instance is down.** Same blank-page problem.

### hackernews-dark-mode.user.js

- **`Shift+ArrowDown` may conflict with text selection.** Lines 392-399
  guard against `TEXTAREA`/`INPUT` but not `contentEditable` elements.
- **No way to disable individual features.** Consider a
  `@grant GM_registerMenuCommand` toggle or localStorage flags for dark
  mode, sort bar, and floating button.

### tophn-co-element-removal.user.js

- **No `@run-at` specified.** Add `@run-at document-start` for consistency
  with the redirect scripts.

### All scripts

- **No way to temporarily disable without uninstalling.** A
  `GM_registerMenuCommand` enable/disable toggle would help.
- **`@author` is "You" in simple scripts.** Update to `NoIdeaDeveloper`.

---

## SECURITY

### youtube-to-invidious.user.js (simple)

- **`url.includes()` matching is loose.** Lines 95, 118, 127, 134, 141:
  `url.includes("youtube.com/watch")` could false-positive if
  "youtube.com/watch" appears in a query parameter value. Use
  `window.location.hostname` + `window.location.pathname` checks instead.
- **URL built with string concatenation.** Lines 99-101, 111, 121, 129, 146:
  `invidious + "/watch?v=" + videoID`. Use `new URL()` for safe URL
  building, matching the pattern in `reddit-to-redlib.user.js`.

### All redirect scripts

- **No validation of destination instances.** Instances are third-party
  operators. The README mentions this but scripts could add a warning on
  first use or when using random instance selection.
- **`window.location.replace()` with user-influenced path.** The `new URL()`
  constructor in most scripts prevents injection, but the simple scripts
  build URLs with string concatenation — switch to `new URL()`.

### General

- **No CSP considerations documented.** The scripts inject `<style>` elements
  and modify the DOM. If a site has a strict CSP that blocks inline styles,
  the body-hiding technique may fail. Document this limitation.
- **No Subresource Integrity.** The `@downloadURL` URLs point to
  `raw.githubusercontent.com`. If the GitHub account is compromised,
  malicious code could be served. Consider signing releases or using
  a CDN with integrity checks (not practical for userscripts, but worth
  noting).

---

## CODE QUALITY / CONSISTENCY

### Mixed ES5/ES6

- `tophn-co-element-removal.user.js` uses `const`, `let`, arrow functions,
  and template literals.
- All other scripts use `var` and `function` expressions.
- **Recommendation:** Either modernize all scripts to ES6+ (dropping IE11
  support, which is already EOL) or standardize on ES5 for maximum compat.

### Duplicated functions

- `stripTrackingParams()` is duplicated across 5 scripts.
- `probe()` is duplicated across 2 scripts.
- This is intentional for standalone installability — document it.

### Inconsistent header formatting

- Simple scripts lack Brave instructions, download URLs, and detailed
  config docs. This is intentional per README but the simple scripts
  should at minimum have `@downloadURL`/`@updateURL`.

### Missing `@license` headers

- Add `@license MIT` to all scripts for license discoverability.

---

## PRIORITY CHANGES (Highest Impact)

1. **Add reachability probes to simple scripts** to prevent blank pages
2. **Use `new URL()` for URL construction** in `youtube-to-invidious.user.js`
3. **Replace wildcard `.comtr *` CSS selector** in `hackernews-dark-mode.user.js`
4. **Add `@downloadURL`/`@updateURL`** to all scripts that lack them
5. **Update `@author` and `@namespace`** across simple scripts
6. **Use pathname-based matching** instead of `url.includes()` in
   `youtube-to-invidious.user.js`
