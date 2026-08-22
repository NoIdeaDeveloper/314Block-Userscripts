# 314Block Userscripts: Enhance Your Browsing Experience

A small collection of userscripts that redirect privacy-hostile sites to
lightweight front-ends (Redlib, Invidious, Scribe) and improve a couple of
sites I read often. They run entirely in your browser.

## Getting Started

Each script can be installed in **one of two ways** — pick whichever fits your
browser. The full installation steps are written at the top of each script
file, but here's the overview.

### Option A — Userscript manager (any browser, recommended)

1. Install a userscript manager:
   - **Tampermonkey** — [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo), [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/), [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   - **Violentmonkey** (open source) or, on macOS Safari, the [Userscripts](https://github.com/quoid/userscripts) extension also work.
2. Open the raw URL of any `*.user.js` file in this repo. Your userscript
   manager will detect the `==UserScript==` header and offer a one-click
   install.
3. Grant the script permission to run on the relevant sites when prompted.

> The scripts include `@downloadURL` / `@updateURL` headers, so Tampermonkey
> and Violentmonkey will pick up new versions automatically.

### Option B — Brave Scriptlets (no extension required)

Brave can run these as built-in scriptlets via `brave://settings/shields/filters`
(enable *Developer mode*). Each script's header comment contains the exact
scriptlet code and the custom-filter lines to add. This path requires Brave
Shields to be enabled on the target site.

## Scripts

> **Naming:** files prefixed `user-` are the **full-featured** versions.
> The shorter `reddit-to-redlib.user.js` / `youtube-to-invidious.user.js`
> files are **simpler** fallbacks. All installable files end in `.user.js`.
>
> **One-click install:** with a userscript manager installed, click any
> **Install** link below — your manager detects the `==UserScript==` header and
> offers to install it.

### user-reddit-to-redlib.user.js (Recommended) — [Install](https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-reddit-to-redlib.user.js)

**Description**: Redirects all Reddit pages to a randomly selected, **reachable**
Redlib instance, preserving the full URL path and query parameters. Strips
tracking parameters before redirecting.

**Features**:
- Random instance selection from a curated list of 9 Redlib instances
- **Real reachability probing** — instances are shuffled and probed; you're sent
  to the first one that actually responds, and the script rolls on to the next
  if one is down. If all are unreachable, a fallback page with a link to the
  instance list is shown.
- Tracking parameter stripping (UTM, ref, correlation_id, share_id)
- Loop prevention (won't redirect if already on a Redlib instance)
- Iframe-safe (won't break Reddit embeds on third-party sites)
- Matches all Reddit subdomains (`www`, `old`, `np`, bare `reddit.com`, …)

**Configuration**: Edit the `INSTANCES` array to add or remove instances. A list
of public instances is at [github.com/redlib-org/redlib-instances](https://github.com/redlib-org/redlib-instances).

### reddit-to-redlib.user.js (Simple) — [Install](https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/reddit-to-redlib.user.js)

> The single-instance version. For random selection and automatic failover
> across instances, use `user-reddit-to-redlib.user.js` instead.

**Description**: Redirects Reddit to a single configured Redlib instance,
preserving the URL path and query parameters. Probes the instance before
redirecting and shows a fallback page if it's down. Edit the `destination`
variable to choose your instance.

### user-youtube-to-invidious.user.js (Recommended) — [Install](https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-youtube-to-invidious.user.js)

**Description**: Redirects YouTube to a configured Invidious instance, preserving
video IDs, timestamps, search queries, and playlists. Replaces YouTube embeds
with a privacy-friendly overlay and adds Invidious branding to DuckDuckGo Videos
tab results.

**Features**:
- 6 URL pattern rules (watch, youtu.be, search, Shorts, playlists, catch-all)
- Tracking parameter stripping (UTM, si, pp, feature, ab_channel)
- YouTube embed iframe replacement with a privacy overlay
- DuckDuckGo Videos tab integration (on `duckduckgo.com` and `noai.duckduckgo.com`)
- SPA navigation detection
- Reachability probing — if the instance is down you get a clear message with a
  link to find another, instead of a silent browser error page
- Configured instance is validated and forced to HTTPS

**Configuration**: Change the `invidious` variable to your preferred instance.
A list of public instances is at [api.invidious.io](https://api.invidious.io).

### youtube-to-invidious.user.js (Simple) — [Install](https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/youtube-to-invidious.user.js)

> The simpler, older version. For embed replacement, DuckDuckGo integration,
> and SPA navigation handling, use `user-youtube-to-invidious.user.js`.

**Description**: Redirects YouTube to an Invidious instance, handling all
YouTube URL types. Probes the instance before redirecting and shows a fallback
page if it's down. Set `invidious`, `videoParams`, and `pageParams` to taste.

### user-medium-to-scribe.user.js — [Install](https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/user-medium-to-scribe.user.js)

**Description**: Redirects Medium articles to Scribe (scribe.rip), preserving the
URL path. Strips tracking parameters and handles SPA navigation.

**Features**:
- Article detection via URL pattern matching (trailing-slash tolerant)
- Tracking parameter stripping (UTM, ref, sk, source)
- SPA navigation handling via History API patching (low overhead)
- Matches `*.medium.com` subdomain publications as well as `medium.com`
- Configured Scribe instance is validated and forced to HTTPS

### hackernews-dark-mode.user.js — [Install](https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/hackernews-dark-mode.user.js)

**Description**: Enhances the Hacker News reading experience with visual,
navigational, and reading-state upgrades. Every feature can be toggled live from
an in-page settings panel (the ⚙ button, bottom-right).

**Features**:
- **Dark mode**: a dark, Reddit-inspired colour scheme. Choose On, Off, or Auto
  (follow your OS `prefers-color-scheme`).
- **Comment depth colors**: distinct colored borders per nesting level.
- **New-comment highlighting**: comments posted since your last visit to a thread
  are tinted and badged (with a count shown in the sticky header).
- **OP & reply highlighting**: the story submitter is badged "OP" throughout the
  thread, and direct replies to your own comments are badged too.
- **Keyboard navigation**: `j`/`k` to move between comments (or stories on list
  pages), `p` to jump to the parent comment, `c` to collapse/expand, `o`/`Enter`
  to open links, and `Shift+ArrowDown` to skip to the next top-level comment.
- **Collapsible comment box**: the reply textarea expands/collapses on focus.
- **Comment sort bar**: reorder comments (Best/New/Top/Controversial) without
  reloading. *(Top/Controversial use reply-count proxies — HN exposes no
  per-comment scores, in its HTML or its APIs.)*
- **Sticky story header**: keeps the title (and a "top" jump) in view while you
  read deep threads.
- **Collapse-all / expand-all**: one click in the sort bar collapses or expands
  every top-level comment thread at once.
- **Visited-story dimming**: stories you've already opened are dimmed on the
  front page and other listings, persisted across sessions. An optional
  "Hide visited stories" setting removes them from listings entirely instead.
- **Reading controls**: adjustable font size, line height, and content width.
- **Next-parent button**: a floating button to skip to the next top-level comment.

All state (settings, visited stories, per-thread last-visit timestamps) is stored
locally in your browser via `localStorage`; nothing is sent anywhere.

### tophn-co-element-removal.user.js — [Install](https://raw.githubusercontent.com/NoIdeaDeveloper/314Block-Userscripts/main/tophn-co-element-removal.user.js)

**Description**: Removes specific UI elements from TopHN.co using DOM observation
and polling (debounced to one pass per animation frame).

## Shared features (all redirect scripts)

The five redirect scripts (`reddit-to-redlib`, `user-reddit-to-redlib`,
`youtube-to-invidious`, `user-youtube-to-invidious`, `user-medium-to-scribe`)
share these behaviors:

- **Reachability probe** — before navigating away, the target instance is
  probed; if it's down you get a clear fallback page instead of a browser error.
- **Update-proof configuration** — change the target instance and toggle the
  script on/off from a ⚙ settings panel shown on the front-end instance (e.g. on
  the Redlib/Invidious/Scribe page itself). Settings are saved in your
  userscript manager's storage, so they survive script auto-updates.
  (In Brave scriptlets they fall back to `localStorage`, applying per-domain.)
- **Per-visit bypass** — append `#noredirect` to a URL to skip the redirect for
  that one navigation (the fragment is never sent to any server).
- **Enable/disable toggle** — turn a script off from its settings panel (or the
  manager's menu command) without uninstalling it.

`user-reddit-to-redlib.user.js` additionally **auto-updates its Redlib instance
list** from the official
[instances.json](https://github.com/redlib-org/redlib-instances) every few days,
caching it locally and falling back to the embedded list if the fetch fails.
This can be turned off in that script's settings panel (it makes a periodic
request to GitHub).

## Notes

- Redirect scripts use `@run-at document-start` to minimize the flash of the
  original page before redirecting, and `window.location.replace()` so the
  original page doesn't end up in your browser history.
- Each script only runs on the domains in its `@match` headers.
- **Privacy note:** these scripts don't collect, store, or phone home with any
  data. They do, however, send the page path and query string to whichever
  public front-end instance you (or the random picker) land on. Those instances
  are operated by independent third parties — choose ones you trust, and be
  aware that the random Redlib picker spreads your requests across several
  operators.

## License

MIT — see [LICENSE](LICENSE).

Happy browsing!
