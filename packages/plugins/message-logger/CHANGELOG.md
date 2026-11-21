# Changelog

## [1.4.1] - 2026-11-21

### Fixed

- Deleted threads are logged in Deleted Channels too, with the channel they were in.

## [1.4.0] - 2026-11-21

### Added

- **Deleted channels:** lists server channels deleted while Discord is open, with their server, category, topic and when they went, in the settings under Deleted Channels.

## [1.3.1] - 2026-11-19

### Fixed

- Messages that `ubd debug message add` made only on the device are no longer kept as deleted when the command removes them.

## [1.3.0] - 2026-11-14

### Added

- **Highlight deleted messages:** draws deleted messages with a highlight and a side bar like mentions, in colours you pick.
- **Edited label:** replace the (edited) after each earlier version of an edited message with your own text.

## [1.2.3] - 2026-11-14

### Fixed

- Messages you delete yourself are no longer logged, so they stop flashing as deleted before they disappear.

## [1.2.2] - 2026-11-14

### Fixed

- Its rows show in action sheets alongside other plugins' rows, including iOS server and profile sheets.

## [1.2.1] - 2026-11-14

### Added

- The device check fails when the open chat shows a message twice, so a Discord update that changes how chat rows rebuild is caught before users see duplicates.

## [1.2.0] - 2026-11-13

### Changed

- Ignored users, channels and servers each have their own page. Pick them from a search instead of typing IDs, or paste an ID to see what it names.

## [1.1.1] - 2026-11-11

### Changed

- Needs Unbound 3.0.0 or newer. The plugin was reorganised for it and works the same as before.

## [1.1.0] - 2026-11-10

### Added

- A **Keep the log after restarts** setting, on by default. Deleted messages, earlier versions of edited messages and deleted attachments are saved, so they still show after Discord restarts. A deleted message comes back when Discord loads its channel. Turning the setting off removes the saved log.

### Changed

- Earlier versions of an edited message now show above its current text as small subtext, each ending with `(edited)`, without blank lines or indents.

## [1.0.4] - 2026-11-05

### Changed

- The settings screen, the long-press rows, the deleted marker and the edit history sheet can now be translated. Your saved settings stay as they are.

## [1.0.3] - 2026-11-03

### Changed

- Remove the opening line from the plugin's page on unbound.rip. The plugin works the same as before.

## [1.0.2] - 2026-11-03

### Changed

- Rewrite the plugin's page on unbound.rip in a shorter style. The plugin works the same as before.

## [1.0.1]

### Changed

- Shorten the plugin description.
- Build the long-press rows with the shared action sheet helper. The plugin works the same as in 1.0.0.

## [1.0.0] - 2026-10-31

### Added

- Initial release, ported from Vencord's MessageLogger.
