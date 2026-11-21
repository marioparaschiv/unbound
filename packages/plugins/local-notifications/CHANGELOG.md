# Changelog

## [1.1.3] - 2026-11-21

### Fixed

- Starting the silent player no longer blocks Discord while iOS starts audio playback.

## [1.1.2] - 2026-11-21

### Fixed

- Starting the background keep-alive no longer freezes Discord while iOS sets up the audio session.

## [1.1.1] - 2026-11-21

### Fixed

- On older loaders that cannot hook the notification delegate, the plugin starts without notification actions instead of failing to start.

## [1.1.0] - 2026-11-18

### Added

- Reply and Mark as read buttons on its notifications: a reply is sent to the channel and both mark it read, without opening Discord.

## [1.0.0] - 2026-11-15

### Added

- Local notifications for mentions and DMs on installs without push, kept alive in the background.
