# Changelog

## [1.1.3] - 2026-11-19

### Fixed

- On iOS, clearing an emoji's spacing from what you type next no longer fails with an error in the log.

## [1.1.2] - 2026-11-19

### Fixed

- On iOS, custom emoji in the message box draw again after Discord restyles their names, so emoji side by side show as images without typing a space.
- On iOS, deleting into an emoji's text no longer leaves that text invisible, and what you type next no longer inherits the emoji's spacing, which pushed the message box onto extra lines.

## [1.1.1] - 2026-11-18

### Fixed

- Custom emoji show in the message box after Discord starts, instead of only after you switch channels: the plugin now picks up your servers' emoji once Discord has loaded them.
- A draft's custom emoji show without tapping into the message box, and turning the plugin off shows their text again.

## [1.1.0] - 2026-11-18

### Added

- Custom emoji show as their images in the message box, animated when they are: picked ones (`:name:`) and pasted `<:name:id>`. The text you send doesn't change.

## [1.0.2] - 2026-11-17

### Fixed

- Leaves underscores in emoji names and inside words alone, as Discord does, instead of styling them as italics or underline.

## [1.0.1] - 2026-11-17

### Fixed

- No longer logs an error for work cut short while the plugin is stopping.

## [1.0.0] - 2026-11-14

### Added

- The message box draws markdown as you type: headings, subtext, quotes, bold, italics, underline, strikethrough, inline and block code, and spoilers, with the markers dimmed.
