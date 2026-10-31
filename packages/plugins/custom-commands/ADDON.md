Custom Commands lets you make your own slash commands. Each command sends a saved response, with up to 10 images or videos attached. Your commands appear in Discord's slash-command list in the chat input, next to Discord's built-in commands. If you are replying to a message when you run a command, the response goes out as a reply.

A response can take arguments. Write `{{name}}` for a required argument, or `{{name = default}}` for an optional one with a default value. Each argument becomes a text option on the command. Type `\n` in the response for a line break.

Every command also has an `ephemeral` option. Turn it on to show the response only to you, as a message from Discord's bot, instead of sending it. The plugin cannot send a command with attachments this way.

## Settings

The settings panel lists your commands under **Registered commands**, each with **Edit** and **Delete** buttons. Tap **Create command** to add a new one. You have no commands until you create one. The command form has these fields:

- **Command name** takes 1 to 32 lowercase letters, numbers, hyphens, or underscores. The name cannot match one of Discord's built-in commands or another of your commands.
- **Description (optional)** takes up to 100 characters and shows in the slash-command list. Without a description, a command named `greet` shows "Send the greet command".
- **Response** holds the text the command sends, with its arguments. The argument name `ephemeral` is reserved. A command needs a response, an attachment, or both.
- **Attach media** opens Discord's photo picker. You can attach local images and videos.

## Known issues

- The plugin saves your commands in its settings on this device. It copies attached files into the app's documents folder on this device. Deleting a command deletes its files.
- If the plugin cannot find Discord's command or message modules, it does not start.
- On a Discord build without the photo picker, **Attach media** shows "The media picker is unavailable on this Discord build."
