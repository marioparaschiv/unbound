Moyai plays a thud when the Moyai emoji appears in a message in the channel you have open. It counts the Unicode Moyai and custom emojis whose name contains "moyai" or "moai", static or animated. A message with several Moyai plays the sound once for each, 350 milliseconds apart.

Moyai also plays the sound when someone adds a Moyai reaction to a message in the open channel. Repeated reaction events for the same message and emoji within half a second play it only once.

## Settings

- **Play on reactions**. Plays the sound when someone reacts with Moyai. On by default.

## Known issues

- Moyai downloads the sound file from GitHub (`raw.githubusercontent.com`, the MeguminSama/VencordPlugins repository) when it starts, and plays it through Discord's own sound manager.
- If the sound has not finished loading, or failed to load, the next Moyai starts loading it again instead of playing it.
