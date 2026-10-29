Mention Avatars puts a small image inside each user mention and role mention in chat messages. A user mention shows the user's avatar, cropped to a circle, in front of the name. A role mention shows the role's icon after the name.

On iOS, a role without a custom icon shows a two-person symbol instead. The symbol takes the role's color, or the normal text color when the role has no color.

## Platforms

Mention Avatars runs on iOS and Android. Some images show only on iOS:

- On Android, a role mention without a custom icon gets no image.
- On Android, a user with Discord's default avatar gets no image. iOS reads the default avatar from the Discord app.
- On Android, the plugin skips an avatar or role icon file larger than 12,000 bytes.

## Known issues

- The plugin downloads each avatar and role icon from Discord's image servers as a 32-pixel PNG.
- A mention shows its image only after the download finishes. On iOS, the plugin tries a failed download again after 5 seconds.
- If the plugin cannot find Discord's role data, role mentions get no image.
