---
banner: media/banner.png
---

## :sparkle: What it does

- :bell-slash: Adds a bell button to the chat input. Tap it to send your next message as a silent message, which skips push and desktop notifications.
- :bell: The button shows a crossed-out bell while it is on and a plain bell while it is off. A toast confirms each tap.
- :at: Sending silently sets the same flag Discord sets when you type `@silent ` yourself, so your text is sent unchanged and the message shows Discord's silent marker.
- :paperclip: Messages with attachments and stickers are sent silently too.
- :mobile: On iOS the button sits with the other buttons on the right of the chat input. On Android it sits next to the send button, so it shows up once you start typing.
- :code-fork: A port of Vencord's SilentMessageToggle.

## :gear: Settings

- :thumbtack: **Persist State**: keeps the toggle on when you open another channel. Off by default, so the toggle turns off when you leave the channel.
- :rotate: **Auto Disable**: turns the toggle off again after one silent message. On by default.

## :circle-info: Differences from Vencord

- :flag: Vencord adds `@silent ` to the text and lets Discord turn it into the silent flag. Here the flag is set directly on the message, so nothing depends on where mobile reads the prefix.
- :hand-pointer: Mobile has no hover, so a toast replaces the tooltip.
