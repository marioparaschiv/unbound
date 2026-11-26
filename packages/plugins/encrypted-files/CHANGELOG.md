# Changelog

## [1.1.4] - 2026-11-26

### Fixed

- When the device's native bridge cannot give secure random bytes, the plugin stays off with a warning instead of failing to start with "The native bridge is unavailable."

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

- Forgetting a key is a trash button that asks first, and the decrypt sheet uses Discord's sheet header.

## [1.0.3] - 2026-11-21

### Fixed

- On a loader without the native features it needs, the plugin stays off with a warning instead of failing to start.

## [1.0.2] - 2026-11-18

### Fixed

- A failed save of a decrypted file shows the save toast with the error, which also fixes the plugin build that held back publishing.

## [1.0.1] - 2026-11-18

### Changed

- Shows as a row in the Plugin Shortcut Panel that closes the panel before it runs, and can stay beside the chat input from the panel's Edit list.

## [1.0.0] - 2026-11-17

### Added

- Initial release: encrypts attachments for the people in a chat, with keys kept on the device.
