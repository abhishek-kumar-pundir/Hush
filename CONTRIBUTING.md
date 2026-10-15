# Contributing to Hush

Thank you for your interest in contributing to **Hush**! We welcome community contributions, bug reports, and suggestions to make browser audio management cleaner and quieter.

---

## Code of Conduct

Please be respectful, constructive, and helpful when participating in discussions, opening issues, or submitting pull requests.

---

## How to Contribute

### 1. Reporting Bugs
- Before creating a new issue, check the [existing issues](https://github.com/abhishek-kumar-pundir/Hush/issues) to ensure the bug hasn't already been reported.
- When opening a bug report, include:
  - Your browser version (e.g., Chrome 129, Brave 1.70).
  - Your Operating System (Windows, macOS, Linux).
  - Clear, reproducible steps to trigger the bug.
  - Expected vs. actual behavior.
  - Any relevant console errors from the extension popup or service worker (`chrome://extensions` → Hush → Inspect views: `service worker`).

### 2. Suggesting Features
- Open an issue labeled `enhancement` with a clear description of the problem your idea solves.
- Explain how the proposed feature fits Hush's single-purpose focus (per-tab audio control, intelligent audio coordination, and tab organization).
- Note: Hush has a strict **privacy-first, local-only** design constraint. Features that require remote telemetry, external AI cloud APIs, or tracking will not be accepted.

### 3. Submitting Pull Requests
1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Make your changes adhering to the repository's architectural patterns.
4. Run all verification checks before submitting:
   ```bash
   # Type check
   npx tsc -b --noEmit

   # Unit test suite
   npm test

   # Linter
   npm run lint

   # Production build verification
   npm run build
   ```
5. Commit your changes with clear, descriptive commit messages.
6. Push to your fork and open a Pull Request against `main`.

---

## Architectural & Design Guidelines

- **Manifest V3 & Local Privacy**:
  - Never introduce external network calls (`fetch`, `XMLHttpRequest`, `WebSocket`, or third-party analytics SDKs).
  - All state must persist strictly via `chrome.storage.local`.
- **Audio Interception**:
  - HTML5 media adjustments happen in `src/content.ts`.
  - Web Audio API interventions happen in `src/main-world.ts` via smoothed `GainNode` insertion.
  - Automatic audio ducking logic must stay decoupled in `src/priority/` and be covered by unit tests in `src/priority/__tests__/`.
- **UI Design System**:
  - Follow the established Smoky Glass palette: near-black surfaces (`#0B0D12`), frosted graphite cards (`rgba(22, 26, 36, 0.68)`), muted periwinkle accents (`#B6B8D0`), and cool mint active states (`#7BE0CA`).
  - Use unified design system classes (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.text-input`, `.select-input`, `.segmented-control`, `.slider`).
  - Do not introduce TailwindCSS, Bootstrap, or heavy component UI frameworks.

---

## License

By contributing to Hush, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
