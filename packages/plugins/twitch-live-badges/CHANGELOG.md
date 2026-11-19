# Changelog

## [1.0.2] - 2026-11-19

### Changed

- Cached lookups are dropped when the phone runs low on memory, and fetched again as needed.

## [1.0.1] - 2026-11-19

### Fixed

- The status is written into the chat rows Discord draws instead of the stored messages, so turning the plugin off leaves no badge behind in Discord's message cache.
- Messages already loaded when the plugin starts get their badge once the chat redraws.

## [1.0.0] - 2026-11-19

### Added

- Initial release: Twitch channel embeds show whether the stream is live.
