# Changelog

## [1.1.2]

### Fixed

- Scrolling on Android is smooth again: an avatar that is already rounded is no longer rounded again every time it scrolls into view.

## [1.1.1]

### Fixed

- Code that runs on the UI thread no longer fails on type checks and destructuring, which left some views unpainted.

## [1.1.0]

### Changed

- Avatars are rounded as they are laid out, on the UI thread, so none is drawn as a circle first and scrolling no longer waits on the JavaScript thread.

## [1.0.2]

### Fixed

- The plugin starts again when installed from the store: its published manifest now lists the native features it uses.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-29

### Added

- Initial release.
