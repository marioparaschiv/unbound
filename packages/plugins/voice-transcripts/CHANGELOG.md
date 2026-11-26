# Changelog

## [1.2.5] - 2026-11-26

### Fixed

- Text renders in Discord's font again. Discord renamed its text styles, so text using the old names fell back to the system font.

## [1.2.4] - 2026-11-26

### Fixed

- On Android, Discord stays responsive while a long voice message is transcribed, instead of freezing until the transcript is ready.

## [1.2.3] - 2026-11-25

### Changed

- Its action sheet rows sit in their own section below Discord's rows, together with other plugins' rows, instead of inside Discord's group.

## [1.2.2] - 2026-11-24

### Fixed

- The store page shows the plugin's screenshots, which 1.2.1 published without. The plugin works the same as before.

## [1.2.1] - 2026-11-24

### Changed

- The store page shows screenshots of the plugin instead of a banner. The plugin works the same as before.

## [1.2.0] - 2026-11-24

### Changed

- The transcript page lists passages, Stop and Copy as Discord settings rows; the passage playing shows a speaker icon.

## [1.1.0] - 2026-11-16

### Added

- On iOS the transcript is split into timed passages; tapping one plays the voice message from there. Android's speech recognizer doesn't time words, so Android keeps the plain transcript.

## [1.0.1] - 2026-11-15

### Changed

- Checks the speech recognition usage key through the shared Info.plist helper.

## [1.0.0] - 2026-11-15

### Added

- Transcribe in the long-press menu of voice messages and audio files, using the phone's speech recognition.
