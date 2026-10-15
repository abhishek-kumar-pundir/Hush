# Changelog

All notable changes to the **Hush** Chrome Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-15

### Added
- **Per-Tab Audio Volume Control**:
  - Independent volume adjustment (0% to 100%) for individual browser tabs.
  - Keyboard navigation stepping (±1% fine step, ±10% shift step).
  - Mouse-wheel scrubbing over volume sliders (±5% per tick).
  - Quick active-tab mute toggle with keyboard shortcut (`Alt+M` on Windows/Linux, `Cmd+Shift+M` on macOS).
- **Dual-Engine Audio Interception**:
  - HTML5 media control targeting standard `<audio>` and `<video>` DOM elements.
  - Web Audio API integration injecting a master `GainNode` directly into page audio contexts before `destination`, supporting complex web apps, DAWs, and games without clipping.
- **Intelligent Audio Priority (Local Sound Intelligence)**:
  - Real-time conflict detection across competing media sources with a 250ms anti-oscillation buffer.
  - 4 Acoustic Scenes:
    - *Deep Work*: Meetings and communications prioritized; background entertainment media suppressed.
    - *Study*: Educational lectures prioritized; ambient music lowered to 25%.
    - *Entertainment*: Active video and stream audio takes priority.
    - *Custom*: User-defined priority scores and response behavior.
  - Conflict Response modes: *Duck audio*, *Pause media*, and *Notify only*.
  - Ducking presets: *Subtle (40%)*, *Balanced (25%)*, and *Whisper (10%)*.
  - Action Ownership Journal: In-memory ring buffer tracking pre-conflict baseline volumes and ensuring safe restoration without overwriting manual user adjustments.
  - Protected sites list: User-defined domains immune to automated volume reduction or pausing.
  - Custom domain priorities: Configurable priority scores (10–100) per domain.
  - Local heuristic suggestions: Contextual proposals ("Make this your default rule?") based on repeated manual adjustments, running 100% locally.
- **Tab Organization & Native Chrome Tab Groups**:
  - Deterministic domain classification into 8 categories: *Entertainment*, *Music*, *Work*, *Study*, *Gaming*, *Communication*, *Social*, and *Other*.
  - Native Chrome Tab Groups synchronization via `chrome.tabGroups`.
  - Drag-and-drop tab reclassification with continuous viewport auto-scrolling.
  - Dedicated "Organize Tabs" workspace with group previews and search filtering.
  - Category master volume sliders and one-click Focus Mode presets (*Study*, *Gaming*, *Meeting*).
  - "Reset All Tabs" action for returning open tabs to default states.
- **Performance & Design**:
  - Translucent smoky glass product design with near-black/graphite surfaces, muted lavender/periwinkle accents, and cool mint indicators.
  - Priority scheduling and favicon caching via `react-fastload` to prevent UI lag on tab-heavy windows.
  - 100% client-side privacy architecture with persistent settings stored exclusively in `chrome.storage.local`.
