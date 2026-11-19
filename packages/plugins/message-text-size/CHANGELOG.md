# Changelog

## [1.1.1] - 2026-11-19

### Fixed

- On iOS, messages laid out while Discord was still starting, before the size could be applied, redraw at the chosen size a few seconds later.
- Changing the size redraws the open chat at once instead of only new messages.

## [1.1.0] - 2026-11-18

### Added

- iOS support: message text is scaled before YYText lays it out, so rows grow or shrink with it. Rows already on screen take the new size when they are laid out again.

## [1.0.0] - 2026-11-15

### Added

- A size for the text of chat messages alone, on Android.
