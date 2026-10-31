# Changelog

## [1.2.0]

### Changed

- On Android, a reused row gives back its own background on the UI thread as soon as it shows a different message, so the old bubble is never drawn behind it.

## [1.1.1]

### Fixed

- Code that runs on the UI thread no longer fails on type checks and destructuring, which left some views unpainted.

## [1.1.0]

### Changed

- On iOS, message backgrounds are kept clear and a reused message's old bubble is hidden on the UI thread, in the same pass as Discord's change, so neither flashes while scrolling.

## [1.0.3]

### Fixed

- The plugin starts again when installed from the store: its published manifest now lists the native features it uses.

## [1.0.2]

### Fixed

- Scrolling the chat on iOS no longer stalls alongside other plugins: message and separator cells are kept transparent after UIKit sets their background, so UIKit never waits on JavaScript.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-29

### Added

- Initial release.
