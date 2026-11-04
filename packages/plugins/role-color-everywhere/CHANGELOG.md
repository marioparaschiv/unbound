# Changelog

## [1.2.5] - 2026-11-05

### Changed

- The settings labels can now be translated. The plugin works the same as before.

### Fixed

- Names in the member list, reaction details, poll results and typing indicator return to plain colors when the plugin stops, including in lists that were already open.
- A feature that fails to start no longer stops the others.

## [1.2.4] - 2026-11-03

### Changed

- Publish the plugin's native capabilities in the current manifest format, so Unbound keeps granting them. The plugin works the same as before.

### Fixed

- Keep the role color on mentions typed in the Android chat input after Discord rebuilds the input's mention styling a moment later.

## [1.2.3] - 2026-11-03

### Changed

- Remove the opening line from the plugin's page on unbound.rip. The plugin works the same as before.

## [1.2.2] - 2026-11-03

### Changed

- Rewrite the plugin's page on unbound.rip in a shorter style. The plugin works the same as before.

## [1.2.1]

### Fixed

- Scrolling no longer stalls the JavaScript thread: colors are sent to the UI thread only when they actually change.

## [1.2.0]

### Changed

- On iOS, mentions in messages are painted on the UI thread in the same pass that sets the message text, so they no longer flash in the default color while scrolling.

## [1.1.1]

### Fixed

- Code that runs on the UI thread no longer fails on type checks and destructuring, which left some views unpainted.

## [1.1.0]

### Changed

- Mentions in the chat input are painted in the same pass that changes the text, on the UI thread, so they no longer flash in the default color first.

## [1.0.2]

### Fixed

- The plugin starts again when installed from the store: its published manifest now lists the native features it uses.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-25

### Added

- Initial release.
- Color mentions in the Android chat input as you type.

### Fixed

- Color mentions in the iOS chat input as you type.
