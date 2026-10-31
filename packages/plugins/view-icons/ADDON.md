View Icons adds rows that open a user's or a server's images in Discord's media viewer. The plugin asks Discord's CDN for each image at 4096 pixels, as a GIF when the image is animated.

The plugin adds these rows to the action sheet of a user profile and of a server, and to the long-press menu of a user, a server, or a group DM:

- **View Avatar** and **View Banner** for a user.
- **View Server Avatar** for a user who has a server avatar, when you view them in that server.
- **View Server Icon** and **View Server Banner** for a server.
- **View Group DM Icon** for a group DM.

A row appears only when the user, server, or group DM has that image set.

## Known issues

- The plugin shows no rows for a user that Discord has not loaded on your device.
- If Discord's theme module is missing, the plugin does not add rows to long-press menus. The rows in profile and server action sheets still work.
