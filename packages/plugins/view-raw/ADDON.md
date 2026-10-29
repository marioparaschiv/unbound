View Raw adds a **View Raw** row that shows the data Discord holds for a message, a user profile, a channel, or a server. The row appears in the long-press menu on a message, in the action sheets of a user profile, a channel, and a server, in a server's long-press menu, and in the overflow menu of a profile.

The row opens a sheet titled, for example, **Raw Message Data**. It shows the data as JSON with its keys in alphabetical order. For a message, the sheet also shows the message's text under **Message Content**. Use **Copy data** to copy the JSON, **Copy content** to copy a message's text, and **Close** to close the sheet.

The message data leaves out the author's `email`, `phone`, `mfaEnabled`, and `personalConnectionId` fields. It also leaves out the `editHistory`, `deleted`, and `firstEditTimestamp` fields that Discord keeps only in the app.
