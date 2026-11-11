# Changelog

## [1.1.6] - 2026-11-11

### Changed

- Needs Unbound 3.0.0 or newer. The plugin was reorganised for it and works the same as before.

## [1.1.5] - 2026-11-04

### Changed

- The settings screen, the Copy button and the copy toasts can now be translated. The plugin works the same as before.

## [1.1.4] - 2026-11-03

### Changed

- Publish the plugin's native capabilities in the current manifest format, so Unbound keeps granting them. The plugin works the same as before.

## [1.1.3] - 2026-11-03

### Changed

- Remove the opening line from the plugin's page on unbound.rip. The plugin works the same as before.

## [1.1.2] - 2026-11-03

### Changed

- Rewrite the plugin's page on unbound.rip in a shorter style. The plugin works the same as before.

## [1.1.1]

### Changed

- On Android, only message texts that hold a code block background are read, instead of every text Discord sets, so scrolling past messages without code blocks costs almost nothing.

## [1.1.0]

### Changed

- On iOS, a reused message's code card is removed on the UI thread as the message is reused, so it never shows on the wrong message while scrolling.

## [1.0.5]

### Fixed

- The plugin starts again when installed from the store: its published manifest now lists the native features it uses.

## [1.0.4]

### Fixed

- Scrolling the chat on iOS stalls less when a code card appears: the row is re-measured with one asynchronous table update per tick instead of synchronous calls for every card.

## [1.0.3]

### Fixed

- Scrolling the chat on iOS no longer stalls in channels with code blocks: message text is checked for code on the JavaScript thread, so only text that can show a code block waits on the main thread.

## [1.0.2]

### Fixed

- Scrolling the chat on iOS no longer stalls in channels without code blocks: message text is skipped unless a loaded message in the channel has a code block, and leftover cards in a reused cell are removed asynchronously.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-25

### Added

- Initial release.

### Fixed

- Draw code cards on Android builds of Discord that obfuscate the names of their text views and code block spans.
- Size Android code cards to the height of their code lines.
- Resize Android code cards when the message row changes width.
- Show the correct card on Android when two messages differ only inside their code blocks.
