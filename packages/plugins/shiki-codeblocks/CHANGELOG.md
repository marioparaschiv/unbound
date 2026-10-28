# Changelog

## [1.0.0] - 2026-10-28

### Added

- Find obfuscated Discord members by shared shapes
- Consume the unified native bridge contract
- Draw iOS-style code cards on Android
- Show linked messages as rows on Android
- Highlight code blocks on Android
- Scope plugin capabilities by platform

### Changed

- Load highlight.js and Shiki on the first code block
- Parse bundled grammars only when a code block needs them

### Fixed

- Keep Android cards at the shown row's width
- Size Android cards to their code lines
- Mark the class names Discord 352 dropped as legacy
- Find obfuscated Discord views by their shape
- Keep code cards and embeds in place while scrolling
- Remount code cards and embeds that lost their surface
- Render Android rows once they have a size
- Embed links on Discord's current text view
- Draw code cards on Discord's current text view
