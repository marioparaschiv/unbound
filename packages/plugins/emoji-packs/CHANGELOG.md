# Changelog

## [1.2.7] - 2026-11-26

### Fixed

- On Android, finding the emoji picker's image method at start no longer freezes Discord; the search runs in small steps and stops when the plugin stops. On a loader without the native bridge the plugin needs, it logs one warning and stays off instead of failing to start.

## [1.2.6] - 2026-11-24

### Fixed

- The store page shows the plugin's screenshots, which 1.2.5 published without. The plugin works the same as before.

## [1.2.5] - 2026-11-24

### Changed

- The store page shows screenshots of the plugin instead of a banner. The plugin works the same as before.

## [1.2.4] - 2026-11-19

### Fixed

- On iOS, reactions draw their emoji from your pack too.

## [1.2.3] - 2026-11-18

### Fixed

- The pack's emoji in the message box move back over their place after the text around them re-lays out.

## [1.2.2] - 2026-11-18

### Fixed

- On iOS a draft in the message box shows the pack's emoji as soon as the chat opens, instead of Apple's until you tap into it.
- Turning the plugin off or switching packs brings back the emoji it covered, instead of leaving gaps.

## [1.2.1] - 2026-11-18

### Fixed

- On iOS the message box no longer draws Apple's emoji behind the pack's, and the pack's emoji line up with the text, also next to Live Markdown's custom emoji.
- Turning the plugin off removes its emoji from the message box.

## [1.2.0] - 2026-11-18

### Added

- The message box draws emoji from the chosen pack as you type. The text you send doesn't change.

## [1.1.0] - 2026-11-17

### Added

- The emoji picker draws unicode emoji from the chosen pack too.

## [1.0.0] - 2026-11-17

### Added

- Initial release: draws message and embed emoji from Microsoft's Fluent or Google's Noto emoji, animated where the pack is, keeping Discord's for emoji a pack lacks. Animated Fluent loads as WebP from castdrian/fluent-emoji-webp.
