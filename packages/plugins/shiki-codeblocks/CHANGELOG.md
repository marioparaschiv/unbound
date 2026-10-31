# Changelog

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
