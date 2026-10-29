Text Replace rewrites each message you send, using rules you write in its settings. A rule finds a piece of text and replaces it with other text. The plugin runs the text rules first and the regex rules second, before Discord sends the message.

A text rule replaces every match of its text. A regex rule takes a JavaScript pattern such as `/hello/gi`. A pattern without slashes uses the `g` flag. Any rule can have a condition, so that it runs only when the message contains some other text.

## Settings

The settings panel has a rule tester, an import and export area, and the two rule lists. There are no rules until you add one.

- **Test your rules** shows or hides the tester. Type into **Example message**, and **Result** shows the message after your rules run. The tester is open by default.
- **Export & share** copies both rule lists to the clipboard as JSON and opens the share sheet.
- **Import clipboard** reads a ruleset from the clipboard and saves it.
- **Import pasted** saves the ruleset that you paste into the **Paste JSON** field.
- **Rule type** picks which list the panel shows, **Text** or **Regex**. The default is **Text**.
- **Add text rule** and **Add regex rule** open the rule editor. Tap a rule in the list to edit it, or to remove it with **Delete rule**.

The rule editor has three fields:

- **Find text** (for a text rule) or **Pattern** (for a regex rule) is what to replace. **Save rule** stays off while this field is blank.
- **Replace with** is the new text. Write `\n` for a new line. Leave it blank to remove the match.
- **Only when the message contains** is an optional condition. Leave it blank to apply the rule to every message.

## Known issues

- An import replaces both of your rule lists with the imported rules.
- A regex rule with an invalid pattern does nothing when you send a message.
- The plugin does not rewrite messages that you send to the Vencord Text Replace rules channel, because the messages there are shared rules.
