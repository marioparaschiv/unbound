# Changelog

## [1.2.0] - 2026-11-17

### Added

- AVIF, HEIC/HEIF, TIFF, BMP, ICO and JPEG XL attachments show as pictures too, decoded on the device: by ImageIO on iOS, and by Android's decoder on Android, which reads all but TIFF and JPEG XL. The plugin is now called Image Embeds.

## [1.1.0] - 2026-11-14

### Added

- Android: SVG attachments show as pictures too, drawn in an off-screen web view.
- A self-test that draws a sample SVG.

## [1.0.0] - 2026-11-14

### Added

- SVG attachments show in chat as pictures, like any other image, drawn on your device with the system's SVG renderer after scripts and embedded HTML are stripped.
