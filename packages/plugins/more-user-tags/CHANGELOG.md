# Changelog

## [1.0.3]

### Fixed

- Painting tag gradients on iOS reuses colors instead of creating them again for every label.

## [1.0.2]

### Fixed

- Scrolling the chat on iOS no longer stalls: labels whose text matches no tag are skipped without reading them back from the main thread, and a reused cell's tag labels are found with one native search instead of a walk of every view.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-25

### Added

- Initial release.
- Draw gradient role colors behind tags on Android.
