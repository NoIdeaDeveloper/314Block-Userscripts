# 314Block Userscripts: Enhance Your Browsing Experience

Welcome to the 314Block Userscripts collection! These scripts were designed to improve my Safari browsing experience by redirecting and enhancing popular websites. Here's how to get started and what each script does.

## Getting Started

1. **Install wBlock**:
   - Download and install the [wBlock app](https://github.com/0xCUB3/wBlock) from the App Store.
   - Enable wBlock in Safari by going to `Settings → Extensions` and toggling it on.

2. **Import Userscripts**:
   - Find the URL to the `.user.js` file(s) you want to import.
   - Open the wBlock app, go to the `Userscripts` tab, and import the script(s).
   - Grant Userscripts permission to run on the relevant sites when Safari prompts you.

## Scripts

### user-reddit-to-redlib.js (Recommended)

**Description**: Redirects all Reddit pages to a randomly selected Redlib instance, preserving the full URL path and query parameters. Strips tracking parameters before redirecting.

**Features**:
- Random instance selection from a curated list of 9 Redlib instances
- Tracking parameter stripping (UTM, ref, correlation_id, share_id)
- Loop prevention (won't redirect if already on a Redlib instance)
- Unreachable instance fallback (tries another instance if the first is down)

**Configuration**:
- Edit the `INSTANCES` array to add or remove Redlib instances.
- A list of public instances is available at [github.com/redlib-org/redlib-instances](https://github.com/redlib-org/redlib-instances).

### reddit-to-redlib.user.js (Simple)

> **Note**: This is the simpler, single-instance version. For random instance selection and tracking param stripping, use `user-reddit-to-redlib.js` instead.

**Description**: Redirects all Reddit pages to a single Redlib instance, preserving the full URL path and query parameters.

**Configuration**:
- Open the script and change the `destination` variable to point to your preferred Redlib instance.

### user-youtube-to-invidious.js (Recommended)

**Description**: Redirects YouTube to a configured Invidious instance, preserving video IDs, timestamps, search queries, and playlists. Replaces YouTube embeds with a privacy-friendly overlay and adds Invidious branding to DuckDuckGo Videos tab results.

**Features**:
- 6 URL pattern rules (watch, youtu.be, search, Shorts, playlists, catch-all)
- Tracking parameter stripping (UTM, si, pp, feature, ab_channel)
- YouTube embed iframe replacement with privacy overlay
- DuckDuckGo Videos tab integration
- SPA navigation detection
- Error handling for unreachable instances

**Configuration**:
- Open the script and change the `invidious` variable to your preferred instance.
- A list of public instances is available at [api.invidious.io](https://api.invidious.io).

### youtube-to-invidious.user.js (Simple)

> **Note**: This is the simpler, older version. For embed replacement, DuckDuckGo integration, and error handling, use `user-youtube-to-invidious.js` instead.

**Description**: Redirects YouTube to an Invidious instance, handling all YouTube URL types.

**Configuration**:
- Open the script and change the `invidious` variable to your preferred instance.
- You can also set `videoParams` and `pageParams` to append Invidious URL parameters to every page you visit.

### user-medium-to-scribe.js

**Description**: Redirects Medium articles to Scribe (scribe.rip), preserving the URL path. Strips tracking parameters and handles SPA navigation.

**Features**:
- Article detection via URL pattern matching
- Tracking parameter stripping (UTM, ref, sk)
- SPA navigation handling via MutationObserver
- HTTPS enforcement on the Scribe instance

### hackernews-dark-mode.user.js

**Description**: Enhances the Hacker News reading experience with visual and navigational upgrades.

**Features**:
- **Dark mode**: Replaces HN's default theme with a dark, Reddit-inspired color scheme.
- **Comment depth colors**: Distinct colored borders for each level of comment nesting.
- **Collapsible comment box**: Expands and collapses smoothly based on user interaction.
- **Comment sort bar**: Allows reordering comments without reloading the page.
- **Next-parent button**: Skips past child replies to the next top-level comment (also accessible via `Shift+ArrowDown` keyboard shortcut).

### tophn-co-element-removal.user.js

**Description**: Removes specific UI elements from TopHN.co using DOM observation and polling.

## Notes

- All scripts use `@run-at document-start` to minimize the flash of the original page before redirecting.
- Redirect scripts use `window.location.replace()` to avoid adding redirected pages to your browser history.
- These scripts only run on the domains specified in their `@match` headers and do not collect or transmit any data.

Happy browsing!
