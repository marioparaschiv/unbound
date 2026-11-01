# Changelog

## [1.2.1]

### Fixed

- Reactor avatars no longer disappear on Android when a row is shown again for the same message.

## [1.2.0]

### Changed

- On Android, a reused row's reactor avatars are hidden on the UI thread as soon as the row shows a different message, so the old message's reactors never show on the new one.

## [1.1.0]

### Changed

- On iOS, message cells are measured with the height their reactions need on the UI thread, so measuring a cell no longer waits on the JavaScript thread.

## [1.0.5]

### Fixed

- The plugin starts again when installed from the store: its published manifest now lists the native features it uses.

## [1.0.4]

### Fixed

- A reaction pill no longer shrinks to its avatars, or covers its emoji, after the plugin restarts with the message on screen: a pill that measures zero wide gets its width from the reaction layout.
- Turning the plugin off on iOS puts every reaction pill and the add-reaction button back where Discord placed them.

## [1.0.3]

### Fixed

- Scrolling the chat on iOS no longer stalls when a cell with reaction avatars is reused: its reaction layout is restored and its avatar surfaces are updated without waiting on the main thread.

## [1.0.2]

### Fixed

- Scrolling the chat on iOS stalls less: avatar surfaces of a reused cell are unmounted asynchronously.

## [1.0.1]

### Changed

- Add a description and a changelog to the plugin's page on unbound.rip. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-25

### Added

- Initial release.

### Fixed

- Show reactor avatars on Android in Discord 352, which renamed the views the plugin looks for.
- Finish turning the plugin off on Android within three seconds, even when removing the avatars stalls.
