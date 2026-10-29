Role Color Everywhere paints member names and mentions with their role colors in parts of Discord that show them in plain text. When a role has two or three colors, the plugin paints the name one character at a time across those colors.

The plugin colors these places:

- Mentions in chat messages, in embed descriptions, and in the preview of the message that a reply answers.
- Mentions that you type in the chat input.
- Names in the typing indicator.
- Role section titles in the member list.
- Names in the reaction details list.
- Voter names in poll results.
- Member names in voice channel user lists.

It can also tint the text of each message with the author's role color. This option is off by default.

## Settings

The settings panel has a **Chat** group and a **People and Roles** group.

- **Color Mentions** (on by default) colors mentions in chat and in the chat input with the mentioned member's role colors.
- **Color Message Content** (off by default) tints message text with the author's role color.
- **Message color intensity** (30% by default) is a slider from 0% to 100%, in steps of 10, that sets how far message text moves toward the author's role color. It applies only when **Color Message Content** is on. At 0%, message text keeps its normal color. The panel shows this slider only when Discord's slider component is available.
- **Typing Names** (on by default) colors names in the typing indicator.
- **Member List Role Headers** (on by default) colors role section titles in the member list.
- **Reaction Users** (on by default) colors names in the reaction details list.
- **Poll Voters** (on by default) colors voter names in poll results.
- **Voice Users** (on by default) colors member names in voice channel user lists.

## Platforms

The plugin runs on iOS and Android. Some mention coloring differs by platform:

- On iOS, the plugin also paints each mention in message text with the role's colors, one character at a time.
- On iOS, a mention in the chat input takes its colors after Discord shows it in bold as a completed mention.
- On Android, a mention in the chat input takes only the role's first color.

## Known issues

- In the chat input and the typing indicator, the plugin does not color a name that two members share. This keeps it from coloring the wrong person.
- In the chat input, the plugin matches names against the first 5,000 members that Discord has loaded for the server.
- The typing indicator colors the names of up to 8 members who are typing.
- A member list section title takes a color only when it contains the name of the first member's hoisted role in that section.
- If a Discord update changes a screen that the plugin patches, the plugin stops coloring that screen and keeps coloring the others.
