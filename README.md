# 314Block Userscripts: Enhance Your Browsing Experience

Welcome to the 314Block Userscripts collection! These scripts were designed to improve my Safari browsing experience by redirecting and enhancing popular websites. Here's how to get started and what each script does.

## Getting Started

1. **Install wBlock**:
   - Download and install the [wBlock app](https://apps.apple.com/us/app/wblock/id1529867649) from the App Store.
   - Enable wBlock in Safari by going to `Settings → Extensions` and toggling it on.

2. **Import Userscripts**:
   - Find the URL to the `.user.js` file(s) you want to import.
   - Open the wBlock app, go to the `Userscripts` tab, and import the script(s).
   - Grant Userscripts permission to run on the relevant sites when Safari prompts you.

## Scripts

### reddit-to-redlib.user.js

**Description**: Redirects all Reddit pages to a Redlib instance, preserving the full URL path and query parameters.

**Configuration**:
- Open the script and change the `destination` variable to point to your preferred Redlib instance.
- A list of public instances is available at [github.com/redlib-org/redlib-instances](https://github.com/redlib-org/redlib-instances).

### youtube-to-invidious.user.js

**Description**: Redirects YouTube to an Invidious instance, handling all YouTube URL types.

**Configuration**:
- Open the script and change the `invidious` variable to your preferred instance.
- A list of public instances is available at [docs.invidious.io/instances](https://docs.invidious.io/instances).
- You can also set `videoParams` and `pageParams` to append Invidious URL parameters (e.g., to disable comments or related videos) to every page you visit.

### hackernews-dark-mode.user.js

**Description**: Enhances the Hacker News reading experience with visual and navigational upgrades.

**Features**:
- **Dark mode**: Replaces HN's default theme with a dark, Reddit-inspired color scheme.
- **Comment depth colors**: Distinct colored borders for each level of comment nesting.
- **Collapsible comment box**: Expands and collapses smoothly based on user interaction.
- **Comment sort bar**: Allows reordering comments without reloading the page.
- **Next-parent button**: Skips past child replies to the next top-level comment.

**Notes**:
- All scripts use `@run-at document-start` to minimize the flash of the original page before redirecting.
- Redirect scripts use `window.location.replace()` to avoid adding redirected pages to your browser history.
- These scripts only run on the domains specified in their `@match` headers and do not collect or transmit any data.

Happy browsing! 🚀
