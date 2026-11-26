# Changelog

## [1.0.10] - 2026-11-26

### Fixed

- Text renders in Discord's font again. Discord renamed its text styles, so text using the old names fell back to the system font.

## [1.0.9] - 2026-11-25

### Fixed

- On Android, the row of roles and members at the top of the permissions sheet scrolls sideways, so every entry can be reached.

### Changed

- The permissions sheets use Discord's own sheet title, scrolling and rows, and the entry chips look like Discord's filter tags. A shadow fades each end of the chip row while more chips hide past it.
- The View Permissions row sits in its own section below Discord's rows, together with other plugins' rows, instead of inside Discord's group.

## [1.0.8] - 2026-11-24

### Fixed

- The store page shows the plugin's screenshots, which 1.0.7 published without. The plugin works the same as before.

## [1.0.7] - 2026-11-24

### Changed

- The store page shows screenshots of the plugin instead of a banner. The plugin works the same as before.

## [1.0.6] - 2026-11-14

### Fixed

- Its rows show in action sheets alongside other plugins' rows, including iOS server and profile sheets.

## [1.0.5] - 2026-11-14

### Fixed

- On iOS, the View Permissions row can show in the server sheet, which keeps its rows in a nested section.

## [1.0.4] - 2026-11-13

### Fixed

- Allowed, denied, owner and role icons take their colors from the theme.

## [1.0.3] - 2026-11-11

### Changed

- Needs Unbound 3.0.0 or newer. The plugin was reorganised for it and works the same as before.

## [1.0.2] - 2026-11-04

### Changed

- Every label, the permission names, the settings and the copy toasts can now be translated. The Roles Card Button setting now takes effect on a profile that is already open.

## [1.0.1] - 2026-11-04

### Fixed

- View Permissions in context menus shows an icon like the other rows.

## [1.0.0] - 2026-11-03

### Added

- Initial release, ported from Vencord's PermissionsViewer.
