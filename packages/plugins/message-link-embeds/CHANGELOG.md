# Changelog

## [1.1.4] - 2026-11-11

### Changed

- Needs Unbound 3.0.0 or newer. The plugin was reorganised for it and works the same as before.

## [1.1.3] - 2026-11-03

### Changed

- Publish the plugin's native capabilities in the current manifest format, so Unbound keeps granting them. The plugin works the same as before.

### Fixed

- On iOS, a linked message taller than the embed's limit is cut off at that height instead of spilling over the rest of the message and the messages below it.
- On Android, a message whose text is not laid out yet when it is bound is tried again shortly after, instead of staying without its embed.

## [1.1.2] - 2026-11-03

### Changed

- Remove the opening line from the plugin's page on unbound.rip. The plugin works the same as before.

## [1.1.1] - 2026-11-03

### Changed

- Rewrite the plugin's page on unbound.rip in a shorter style. The plugin works the same as before.

## [1.1.0]

### Changed

- On iOS, a reused message's embed is removed on the UI thread as the message is reused, so it never shows on the wrong message while scrolling.

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

- Show previews on Android builds of Discord that obfuscate the names of their message views.
