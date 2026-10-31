File Size On Picker shows each file's size on the thumbnails of the media picker that opens from the chat input. The size appears in the top-left corner of each photo and video, in 1024-based units with up to two decimals, such as `1.5 MB`. A thumbnail without a known size shows no badge.

## Platforms

The plugin runs on iOS and Android. On Android, Discord's picker does not report file sizes, so the plugin reads each size from Android through the loader's Java bridge. If the loader does not offer the Java bridge, thumbnails on Android show no sizes.
