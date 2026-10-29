Expression Tools adds a row of buttons to the sheet that opens when you tap a custom emoji or a sticker. The row also appears on the sticker sheet that opens from a message. Unicode emojis get no buttons.

For a custom emoji, the row has these buttons:

- **Copy URL** copies the emoji's image link at 160 pixels, as a GIF for an animated emoji and a PNG otherwise.
- **Copy markup** copies the text that renders the emoji in a message, such as `<:name:id>`, or `<a:name:id>` for an animated emoji.
- **Clone** uploads a copy of the emoji to one of your servers.

For a sticker, the row has these buttons:

- **Copy URL** copies the sticker's page link on `discord.com`.
- **Favorite** adds the sticker to your favorite stickers. When the sticker is already a favorite, the button reads **Unfavorite** and removes it.
- **Clone** uploads a copy of the sticker to one of your servers.

Each button closes the sheet. When the action finishes, a toast confirms it, such as "URL copied to the clipboard." If an action fails, the toast shows Discord's error message.

**Clone** opens a **Clone to a server** sheet. The **NAME** field starts with the expression's name. Under **YOUR SERVERS**, a search field filters the list of your servers. Tap a server to upload the copy with the name you entered.

## Known issues

- **Clone** lists only the servers you own. Servers where you only have permission to manage expressions do not appear.
- A cloned sticker keeps its description. It keeps its tags too, or uses its name as the tag when it has none.
- If this Discord build lacks the module that a button needs, that button shows an error toast instead, such as "Favorites are unavailable on this client build."
