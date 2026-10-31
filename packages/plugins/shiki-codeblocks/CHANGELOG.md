# Changelog

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
