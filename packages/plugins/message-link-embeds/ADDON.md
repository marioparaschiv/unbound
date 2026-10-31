Message Link Embeds shows a preview of a linked message inside the message that links to it. When a message contains a link to another Discord message, the plugin draws the linked message as a Discord chat row. The preview sits on a new line after the channel mention that Discord renders for the link.

The plugin reads links from discord.com and discordapp.com, including their subdomains. If Discord has not loaded the linked message yet, the plugin asks Discord for it and adds the preview when it arrives.

Inside a preview, GIFs, animated emoji, and animated stickers play without a tap, and Lottie animations loop. On iOS, if the chat is at its bottom when a preview loads or changes height, the plugin keeps the chat at its bottom.

## Known issues

- A message gets a preview only for the first message it links to.
- A preview does not show the linked message's reactions.
