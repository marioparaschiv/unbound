# Changelog

## [1.2.0] - 2026-11-14

### Added

- Hidden keywords: messages containing any of them disappear. One per line, and a line wrapped in slashes is a regular expression.

## [1.1.5] - 2026-11-14

### Added

- The device check fails when the open chat shows a message twice, so a Discord update that changes how chat rows rebuild is caught before users see duplicates.

## [1.1.4] - 2026-11-14

### Fixed

- Messages no longer show twice: the plugin no longer rebuilds the open chat itself, which could add every row a second time. Hiding someone now applies at the chat's next update, as when a message arrives or you reopen it.

## [1.1.3] - 2026-11-14

### Fixed

- Messages no longer show twice on Discord 353: the chat is rebuilt from each item once, and only from the open chat's own rows.

## [1.1.2] - 2026-11-14

### Fixed

- Messages no longer show twice after the plugin starts or a setting changes: the open chat is rebuilt from the same items Discord built it from.

## [1.1.1] - 2026-11-13

### Changed

- Credits Samwich, KamiRu, who made Equicord's ClientSideBlock, which this ports.

## [1.1.0] - 2026-11-13

### Changed

- Hidden users are picked from a searchable list of people, shown with their avatars and names, instead of typed ids.

## [1.0.1] - 2026-11-13

### Changed

- Takes over from No Blocked Messages: clients that still have it move to Client Side Block, keeping it on or off.

## [1.0.0] - 2026-11-13

### Added

- Replaces No Blocked Messages: hides the placeholder rows of blocked users' messages, as before.
- Hides messages from users you ignore on Discord, and from users you pick in the settings without blocking them.
- Hides replies to anyone it hides.
