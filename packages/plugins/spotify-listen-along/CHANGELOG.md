# Changelog

## [1.1.0] - 2026-11-13

### Fixed

- Listen Along joins at the host's position and stays in sync: it follows track changes and seeks, and pauses and resumes with them, through Spotify's API instead of Discord's desktop-only player sync.
- When Spotify isn't running, it opens Spotify and waits for your phone to show up, and never plays on an idle speaker or computer.

### Added

- Tap the button again to stop listening along.
## [1.0.5] - 2026-11-11

### Changed

- Needs Unbound 3.0.0 or newer. The plugin was reorganised for it and works the same as before.

## [1.0.4] - 2026-11-05

### Changed

- The button labels, the Spotify attachment button and the messages it shows are now translatable. The plugin works the same as before.

## [1.0.3] - 2026-11-03

### Changed

- Rewrite the plugin's page on unbound.rip in a shorter style. The plugin works the same as before.

## [1.0.2] - 2026-11-01

### Changed

- Starts once Discord has drawn its first frame, so it no longer delays Discord opening.

## [1.0.1] - 2026-11-01

### Changed

- Finds the media keyboard's actions through a cached filter, so later launches skip the module scan.

## [1.0.0] - 2026-11-01

### Added

- Initial release, ported from the Add Listen Along and Send Spotify invite modules of nexpid's NexxUtils.
