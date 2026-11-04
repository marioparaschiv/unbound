# Changelog

## [1.0.9] - 2026-11-03

### Changed

- On iOS, the plugin indexes only messages that are new or changed, skips cells whose message has no mentions, and redraws a waiting cell only when one of its mentions resolved. A mention that never resolves stops being retried after 20 store changes, so cells redraw about 40% less while scrolling. It is checked again whenever its message comes back on screen.
- On Android, a store change rechecks only the selected channel's unresolved messages instead of indexing the whole channel again.

## [1.0.8] - 2026-11-03

### Changed

- Publish the plugin's native capabilities in the current manifest format, so Unbound keeps granting them. The plugin works the same as before.

## [1.0.7] - 2026-11-03

### Changed

- Rewrite the plugin's page on unbound.rip in a shorter style. The plugin works the same as before.

## [1.0.6]

### Changed

- On Android, texts without a tappable span are skipped before their text is read.

## [1.0.5]

### Changed

- Rebuilt with the updated shared Android helpers; behavior is unchanged.

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
