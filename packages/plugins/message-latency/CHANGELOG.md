# Changelog

## [1.1.0]

### Changed

- On iOS, a reused message's latency icon is hidden on the UI thread as the message is reused, so it never shows on the wrong message while scrolling.

## [1.0.2]

### Fixed

- The plugin starts again when installed from the store: its published manifest now lists the native features it uses.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-25

### Added

- Initial release.

### Fixed

- Find Discord's Android message rows on builds that rename their internal classes, and stop drawing the icon on Android messages that hide the author name.
