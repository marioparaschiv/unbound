# Changelog

## [1.0.4]

### Fixed

- The plugin starts again when installed from the store: its published manifest now lists the native features it uses.

## [1.0.3]

### Fixed

- Scrolling the chat on iOS stalls less: a message cell's text views are found with one native search, and only text that can hold a mention is read on the main thread.

## [1.0.2]

### Fixed

- Scrolling the chat on iOS no longer stalls: a reused message cell drops only the text views the plugin already knows instead of searching the whole cell on the main thread.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-25

### Added

- Initial release.

### Fixed

- Show avatars in mentions on newer Android Discord builds.
