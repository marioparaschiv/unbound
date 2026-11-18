# Changelog

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
