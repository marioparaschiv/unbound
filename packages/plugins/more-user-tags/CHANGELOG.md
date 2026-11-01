# Changelog

## [1.3.0]

### Changed

- Tag gradients appear at once on iOS and Android: tags seen before their colors were known are painted the moment the colors arrive, and the colors are remembered across launches.

## [1.2.1]

### Fixed

- Scrolling no longer stalls the JavaScript thread: colors are sent to the UI thread only when they actually change.

## [1.2.0]

### Changed

- On Android, tag gradients are painted on the UI thread right after Discord binds each tag, so a tag is never drawn with its flat color first.

## [1.1.1]

### Fixed

- Code that runs on the UI thread no longer fails on type checks and destructuring, which left some views unpainted.

## [1.1.0]

### Changed

- On iOS, tag gradients are painted on the UI thread in the same pass that sets the tag's text or color, so a tag is never drawn flat first.

## [1.0.4]

### Fixed

- The plugin starts again when installed from the store: its published manifest now lists the native features it uses.

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
