Message Logger keeps deleted and edited messages in the chat until Discord restarts. It is a port of Vencord's MessageLogger.

A deleted message stays where it was, with its text in red and **This message was deleted** under it, like an ephemeral message. Tap **Dismiss message** to remove it. An edited message shows its earlier versions above its current text, each marked **(edited)**. An attachment an edit removed stays on the message with **(deleted)** before its name.

The plugin adds rows to these long-press menus:

- **View Edit History** on an edited message opens a sheet with every earlier version and when it was replaced.
- **Clear Message History** on a logged message removes a deleted message from the chat, or drops an edited message's earlier versions and deleted attachments.
- **Clear Message Log** on a channel or thread clears the log of every loaded message in it.

## Settings

- **Red text**, **Deleted marker** and **Show edits inline** choose how logged messages look.
- **Log deleted messages**, **Log edited messages** and **Log deleted attachments** choose what is logged.
- **Ignore bots** and **Ignore yourself** skip those messages. Bots are ignored by default.
- **Ignored users**, **Ignored channels** and **Ignored servers** take IDs separated by commas or spaces. An ignored channel ID also covers the channels in that category.

## Known issues

- The log lives in memory. Restarting Discord or turning the plugin off clears it, and turning the plugin off removes the deleted messages from the chat.
- Deleted messages can't be collapsed the way Vencord collapses them on desktop.
