# Changelog

## [1.2.8] - 2026-11-11

### Changed

- Needs Unbound 3.0.0 or newer. The plugin was reorganised for it and works the same as before.

## [1.2.7] - 2026-11-05

### Changed

- The settings screen, the tooltip text and the screen reader label can now be translated.
- **Latency threshold** is now a slider from 1 to 10 seconds instead of stepping through 1, 2, 3, 5 and 10. Your saved threshold carries over.

## [1.2.6] - 2026-11-03

### Changed

- On iOS, the plugin reads a message cell's views only when that message has a latency record, and checks whether a cell left the screen without reading its views at all.

### Fixed

- On iOS, the icon also shows for authors with a short name and server tags or role badges next to it, whose header the plugin used to give up on.

## [1.2.5] - 2026-11-03

### Changed

- Publish the plugin's native capabilities in the current manifest format, so Unbound keeps granting them. The plugin works the same as before.

## [1.2.4] - 2026-11-03

### Changed

- Remove the opening line from the plugin's page on unbound.rip. The plugin works the same as before.

## [1.2.3] - 2026-11-03

### Changed

- Rewrite the plugin's page on unbound.rip in a shorter style. The plugin works the same as before.

## [1.2.2]

### Changed

- On Android, a row shown again for the message its latency icon is already placed on no longer repositions the icon three times, which saves main-thread work while scrolling.

## [1.2.1]

### Fixed

- Latency icons no longer blink on Android when a row is shown again for the same message.

## [1.2.0]

### Changed

- On Android, a reused row's latency icon is hidden on the UI thread as soon as the row shows a different message, so the old message's latency never shows on the new one.

## [1.1.1]

### Fixed

- Code that runs on the UI thread no longer fails on type checks and destructuring, which left some views unpainted.

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
