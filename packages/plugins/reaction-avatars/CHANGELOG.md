# Changelog

## [1.0.3]

### Fixed

- Scrolling the chat on iOS no longer stalls when a cell with reaction avatars is reused: its reaction layout is restored and its avatar surfaces are updated without waiting on the main thread.

## [1.0.2]

### Fixed

- Scrolling the chat on iOS stalls less: avatar surfaces of a reused cell are unmounted asynchronously.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-25

### Added

- Initial release.

### Fixed

- Show reactor avatars on Android in Discord 352, which renamed the views the plugin looks for.
- Finish turning the plugin off on Android within three seconds, even when removing the avatars stalls.
