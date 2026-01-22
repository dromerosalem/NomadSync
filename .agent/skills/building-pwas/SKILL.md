---
name: building-pwas
description: Guides the creation of high-performance, offline-capable Progressive Web Apps (PWAs). Use when the user requests PWA features, offline support, or mobile-first web optimization.
---

# Building PWAs (Progressive Web Apps)

## When to use this skill
- When building a web application that needs to be installable.
- When offline functionality or "offline-first" architecture is required.
- When optimizing for mobile performance and "app-like" behavior.
- When configuring Service Workers or Web App Manifests.

## Workflow
1.  **Architecture Setup**: Confirm use of Vite and `vite-plugin-pwa`.
2.  **Asset Audit**: Identify critical assets for the "App Shell" (HTML, CSS, JS, logo).
3.  **Strategy Selection**: Choose caching strategies (Cache-First for static, Network-First for dynamic).
4.  **Implementation**:
    - Configure `manifest.json` (icons, theme, display mode).
    - Register Service Worker.
    - Implement IndexedDB for offline data persistence.
5.  **Validation**: Use Lighthouse or browser DevTools to verify PWA status and offline load.
6.  **UX Polish**: Add "Add to Home Screen" prompts and custom offline pages.

## Instructions
- **Performance First**: Prioritize Core Web Vitals (LCP, CLS, FID). Use lazy loading and code splitting.
- **Offline Reliability**: 
    - Use **Stale-While-Revalidate** for content that updates frequently but needs to be fast.
    - Use **Background Sync** for form submissions while offline.
- **Mobile Fidelity**: Ensure touch targets are at least 48x48px. Use system fonts for a native feel.
- **Vite Configuration**:
    - Root: `vite-plugin-pwa` in `vite.config.ts`.
    - Workbox options: Define `runtimeCaching` for external fonts or APIs.

## Checklist
- [ ] Web App Manifest configured with valid icons.
- [ ] Service Worker registered and active.
- [ ] At least one caching strategy implemented via Workbox.
- [ ] Custom offline page or fallback UI exists.
- [ ] HTTPS is enforced (or localhost used for dev).

## Resources
- [Vite PWA Documentation](https://vite-pwa-org.netlify.app/)
- [Workbox Caching Strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies/)
