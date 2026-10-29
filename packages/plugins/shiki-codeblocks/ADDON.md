Shiki Codeblocks replaces the fenced code blocks in chat messages with highlighted code cards. Each card has a header with a language icon, the language name, and a **Copy** button. Below the header, the card shows the code with line numbers and syntax colors from a VS Code theme.

**Copy** copies the code exactly as it was written between the fences, and a toast shows "Code copied to clipboard." If the copy fails, the toast shows "Could not copy code." A code block with no language tag, or a tag the plugin does not know, shows as plain text with the label "Text". A card grows with its code up to a fixed maximum height. Taller code scrolls inside the card. When you change a setting, the cards already in the chat update.

## Settings

- **Language icons**: shows a Devicon mark for the language in the card header. Tap the row to cycle through `disabled`, `greyscale`, and `colored`. A greyscale icon takes the theme's text color. Default: `greyscale`.
- **Theme**: the VS Code theme for syntax colors. Tap the row to open a searchable list of 61 themes. Default: Dark Plus.
- **Custom theme URL**: an HTTPS link to a VS Code theme JSON file. When it is set, it overrides **Theme**. The plugin saves the link only if it starts with `https://` and ends in `.json`. The file can contain comments and can include other theme files. Default: empty.
- **Background opacity (%)**: the opacity of the card background, from 0 to 100. Default: 100.
- **Long lines**: **Wrap** wraps long lines. **Horizontal scroll** keeps each line on one row and lets you scroll the code sideways. Default: **Wrap**.
- **Highlighting preference**: chooses when Highlight.js colors a code block instead of Shiki. **Never** always uses Shiki. **Prefer Shiki** uses Highlight.js only for languages that Shiki does not know. **Prefer Highlight.js** uses Highlight.js for every language it knows. **Always use Highlight.js** uses it for every block. Highlight.js uses fixed light or dark colors based on GitHub's themes, not the selected theme. Default: **Prefer Shiki**.

## Known issues

- A code block longer than 6,000 characters keeps Discord's own look.
- On iOS, a message keeps Discord's code blocks when the plugin cannot match each code block to the text that Discord shows.
- The plugin downloads grammars and themes from jsDelivr when a code block first needs them. It saves the grammars for common languages on this device. Themes other than Dark Plus and Light Plus also come from jsDelivr, and Material Candy comes from raw.githubusercontent.com. On iOS, the plugin also downloads a list of language names from the Vencord ShikiPluginAssets repository on jsDelivr. These requests name only the language or the theme. A custom theme downloads from the URL that you enter.
