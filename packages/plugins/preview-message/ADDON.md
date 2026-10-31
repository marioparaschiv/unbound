Preview Message adds an eye button to the chat input. The button appears once your draft has text or a staged sticker. On iOS it sits in front of the chat input's right-hand buttons. On Android it sits in front of the send button, because Android hides the right-hand buttons once you type.

Tap the eye button to close the keyboard and open a **Message Preview** card. The card renders your draft with Discord's own message row, as the message will look when you send it. Tap outside the card to close it. If Discord's message row cannot render the draft, the card shows "Preview failed:" and the error.

The preview includes:

- Link previews for up to four links in the draft. Links in angle brackets, such as `<https://example.com>`, get no preview, as in Discord.
- Stickers you staged with the Sticker Preview plugin.
- Your Text Replace rules, when the Text Replace plugin is running, so the preview shows the text that will be sent.

## Known issues

- The plugin asks Discord's link embed service for each link preview. If Discord cannot resolve a link, your device downloads the linked page and reads its Open Graph and Twitter card tags.
- A link preview from Discord's link embed service shows the title, description, image, thumbnail, and video. It leaves out the author, footer, fields, site name, and timestamp, so the sent message can show more than the preview.
