# Changelog

## [1.1.4] - 2026-11-26

### Fixed

- Text renders in Discord's font again. Discord renamed its text styles, so text using the old names fell back to the system font.

## [1.1.3] - 2026-11-25

### Changed

- Its action sheet rows sit in their own section below Discord's rows, together with other plugins' rows, instead of inside Discord's group.

## [1.1.2] - 2026-11-24

### Fixed

- The store page shows the plugin's screenshots, which 1.1.1 published without. The plugin works the same as before.

## [1.1.1] - 2026-11-24

### Changed

- The store page shows screenshots of the plugin instead of a banner. The plugin works the same as before.

## [1.1.0] - 2026-11-24

### Changed

- The sheet uses Discord's sheet header and settings rows: a Start field, a Length stepper, Size and Crop pickers, a Caption field and one Make GIF button.

## [1.0.2] - 2026-11-16

### Changed

- Reads video frames straight from native memory instead of through base64 text, so making a GIF is quicker.

## [1.0.1] - 2026-11-16

### Fixed

- Keeps all of a clip's colours when one colour covers most of the frame, instead of flattening the rest to a few.

## [1.0.0] - 2026-11-16

### Added

- Turns part of a video in chat into a GIF, cropped and captioned as you like, and attaches it to your message.
