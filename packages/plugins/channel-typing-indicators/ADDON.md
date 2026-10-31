Channel Typing Indicators shows who is typing in each channel and thread of the channel list. In a channel row, the indicator sits before the channel's own info. In a thread row, it sits after the thread's info. It shows the avatars of up to three people who are typing, a `+N` badge for anyone past three, and three animated dots.

Tap the dots, or long-press an avatar, to see a tooltip that names who is typing, such as "Alice and Bob are typing...". For four or more people, the tooltip reads "Several people are typing...". The tooltip uses Discord's own text in your language when Discord has it. Each name is the person's server nickname, display name, or username. Tap an avatar to open that user's profile.

The indicator never shows you. By default, it also hides blocked users, ignored users, and muted channels.

## Settings

- **Include current channel** shows typing activity in the channel you have open. On by default.
- **Include muted channels** shows typing activity in muted channels. Off by default.
- **Include ignored users** shows typing activity from users you ignored. Off by default.
- **Include blocked users** shows typing activity from users you blocked. Off by default.
- **Appearance** picks what the indicator shows, either **Avatars and animated dots**, **Animated dots**, or **Avatars**. The default is **Avatars and animated dots**.

## Known issues

- If the plugin cannot find Discord's theme module, it does not start.
- If Discord's channel or thread row has a layout the plugin does not expect, the plugin skips that kind of row.
- If an indicator fails to render, it hides itself and the channel row stays as it was.
