# Changelog

## [1.0.5] - 2026-11-26

### Fixed

- On iOS, making a GIF no longer risks crashing Discord when the source image is freed while it is being read.

## [1.0.4] - 2026-11-25

### Changed

- Its action sheet rows sit in their own section below Discord's rows, together with other plugins' rows, instead of inside Discord's group.

## [1.0.3] - 2026-11-24

### Fixed

- The store page shows the plugin's screenshots, which 1.0.2 published without. The plugin works the same as before.

## [1.0.2] - 2026-11-24

### Changed

- The store page shows screenshots of the plugin instead of a banner. The plugin works the same as before.

## [1.0.1] - 2026-11-16

### Changed

- Reads image pixels straight from native memory instead of through base64 text, so making a GIF is quicker.

## [1.0.0] - 2026-11-16

### Added

- Turns someone's avatar or an image into a head-patting GIF and adds it to your message.
