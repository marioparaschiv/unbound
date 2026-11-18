---
banner: media/banner.png
---

## :sparkle: What it does

- :language: Adds a **Translate** row to the long-press menu on messages that have text.
- :clipboard: Copies the translation to your clipboard and shows it in a "Translated" toast, or shows it under the message's text with the language codes, such as `(en -> de)`.
- :undo: On a message translated in the chat, **Show Original** in the long-press menu removes the translation again.
- :circle-xmark: If it fails, a "Translate Error" toast says why.
- :globe: Translations go through the service you pick, which gets the message text and your language codes: Unbound's `translate.unbound.rip` once you connect Discord, or Google Translate and MyMemory, which need no account.

## :gear: Settings

- :server: **Translation Service** picks where translations go. **Automatic** (the default) uses Unbound's service once you connect Discord, and until then Google, falling back to MyMemory if Google fails.
- :user-key: **Connect Discord account** signs you in to Unbound's service. Only Automatic and Unbound show it.
- :magnifier: **Source Language** is the language you translate from. `auto` by default, which detects it.
- :language: **Target Language** is the language you translate into. `en` (English) by default.
- :eye: **Show Translations** picks where translations go: copied and in a toast (the default), or in the message, under its text until you pick **Show Original**.

Both language rows search a list of 35 languages.
