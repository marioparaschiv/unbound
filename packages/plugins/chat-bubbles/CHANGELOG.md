# Changelog

## [1.4.4] - 2026-11-01

### Fixed

- On iOS, a message measured before it finished laying out, such as a reply still loading its preview, no longer stays without a bubble: the plugin measures it again.

## [1.4.3] - 2026-11-01

### Changed

- Listens only to message rows laying out, so scrolling other lists no longer wakes the plugin.

## [1.4.2]

### Changed

- On Android, a row shown again for a message whose bubble is already drawn at the same size skips measuring it again, which roughly halves the plugin's JavaScript allocations while scrolling.

## [1.4.1]

### Fixed

- The plugin starts again on the current client, which no longer provides the old settings API.

## [1.4.0]

### Changed

- On Android, a message whose bubble was already measured gets its bubble the moment its row is bound, so bubbles no longer pop in when scrolling back over messages.

## [1.3.0]

### Changed

- On iOS, a message whose bubble was already measured gets its bubble in the same pass that lays it out, so bubbles no longer pop in when scrolling back over messages.

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
