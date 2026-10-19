# Chrome Web Store Listing for Hush

This document contains the verified metadata, copy, permission justifications, and category settings published on the Chrome Web Store Developer Dashboard.

**Official Store URL**: [https://chromewebstore.google.com/detail/hush/dbbkabhnlodiikoebjiijgcfoeiakiop](https://chromewebstore.google.com/detail/hush/dbbkabhnlodiikoebjiijgcfoeiakiop)

---

## 1. Store Metadata

- **Extension Name (Max 45 chars)**:  
  `Hush — Tab Volume Control & Audio Manager`
  
- **Short Description (Max 132 chars)**:  
  `Control individual tab volume, mute noisy background tabs, manage audio, and organize your Chrome workspace with Hush.`

- **Category**:  
  `Productivity` (Secondary: `Accessibility` or `Photos & Video / Media`)

- **Language**:  
  `English (United States)`

- **Privacy Policy URL**:  
  `https://abhishek-kumar-pundir.github.io/Hush/privacy.html`

- **Support / Website URL**:  
  `https://github.com/abhishek-kumar-pundir/Hush`

---

## 2. Detailed Description (Plain text formatted for CWS)

```text
Hush brings precision acoustic control and tab organization to your browser. Adjust volume for individual Chrome tabs, mute noisy background media with zero latency, organize open tabs into native groups, and focus with one-click presets.

Whether you're listening to music while watching a tutorial, managing multiple meeting calls, or balancing background audio while gaming, Hush gives you full independent sound control over every browser tab.

KEY FEATURES

🎚️ INDIVIDUAL TAB VOLUME CONTROL
• Adjust any tab's volume independently from 0% to 100%.
• Precision sliders with keyboard arrow stepping (±1% fine step, ±10% shift step).
• Mouse-wheel scrubbing: hover over any slider and scroll up/down to adjust.
• Quick mute toggle for the active tab (Alt+M on Windows/Linux, Cmd+Shift+M on macOS).

🔊 DUAL-ENGINE AUDIO INTERCEPTION
• HTML5 Media: Direct zero-latency control over standard <audio> and <video> tags.
• Web Audio API: Automatically injects a smoothed master GainNode into complex web audio contexts (DAWs, Spotify Web, HTML5 games) to prevent clipping or popping.

📂 AUTOMATIC TAB CATEGORIZATION
• Intelligently categorizes open tabs into 8 activity domains: Entertainment, Music, Work, Study, Gaming, Communication, Social, and Other.
• Master Group Sliders: Lower or mute an entire category (e.g., mute all Social tabs) while preserving relative offsets.
• Drag-and-drop reclassification with automatic viewport autoscrolling and persistent domain memory.

🎯 ONE-CLICK FOCUS MODES
• Instantly activate acoustic presets tailored for your workflow:
  - Study: Maximizes study audio (100%), lowers work (50%) and music (20%), mutes distractions.
  - Gaming: Prioritizes game audio (100%) and communication (80%).
  - Meeting: Focuses 100% on communication tabs, automatically muting all background tabs.
• Live hover previews show you exactly which tabs will play or mute before you click.

📑 NATIVE CHROME TAB GROUPS
• Click "Organize tabs" to automatically bundle loose browser tabs into native, color-coded Chrome Tab Groups using the chrome.tabGroups API.

🚀 ULTRA-FAST & RESOURCE-EFFICIENT
• Powered by react-fastload with prioritized scheduling and favicon deduplication.
• Zero UI freeze or popup lag even with 50+ open tabs.

PRIVACY & SECURITY

Hush operates 100% locally on your machine:
• No user data, audio samples, or browsing history is ever collected, transmitted, or stored on remote servers.
• No third-party trackers, analytics, or background telemetry.
• Settings are saved locally via chrome.storage.local.
• Fully open-source under the MIT License: https://github.com/abhishek-kumar-pundir/Hush
```

---

## 3. Chrome Web Store Permission Justifications

When submitting to the Chrome Developer Dashboard, Chrome requires specific justification for requested permissions:

### Permission: `tabs`
> **Justification**:  
> "Requested to read the titles, URLs, and audible playback states of open tabs so users can identify noisy tabs in the popup, adjust their individual volume levels, and jump directly to playing tabs in the Now Playing HUD."

### Permission: `storage`
> **Justification**:  
> "Used strictly to save user volume preferences (0% to 100%), category master volumes, and custom domain categorization overrides locally on the user's device via `chrome.storage.local`."

### Permission: `tabGroups`
> **Justification**:  
> "Used strictly when the user explicitly clicks the 'Organize tabs' button to group open tabs into native, color-coded Chrome Tab Groups based on activity."

---

## 4. Single-Purpose Description

> "Hush serves a single, unified purpose: enabling users to control the audio volume of individual browser tabs and organize open tabs into native groups for acoustic focus."

---

## 5. Listing Asset Checklist

- **Icon**: `icon-128.png` (128×128 px, PNG format).
- **Store Screenshots** (Minimum 1, recommended 4-5 at 1280×800 or 640×400):
  1. Main Popup View (Current Tab Card with volume slider + Now Playing HUD).
  2. Tab Categories & Master Volume Sliders.
  3. Focus Modes with Hover Preview Popover.
  4. Smart Organize native Chrome Tab Groups dialog.
- **Small Promo Tile** (Optional): 440×280 px.
- **Marquee Promo Tile** (Optional): 1400×560 px.
