Translate adds a **Translate** row to the long-press menu on a message. Tap it to translate the message's text into your target language. The plugin copies the translation to your clipboard and shows it in a toast titled "Translated". If the translation fails, a "Translate Error" toast shows the reason.

The row appears only on messages that have text. Before you can translate, connect your Discord account in the plugin's settings.

## Settings

- **Connect Discord account** opens Discord's authorize screen to sign you in to the translate service. After you sign in, the row reads **Reconnect Discord account**.
- **Source Language** is the language of the messages you translate. The default is `auto`, which detects the language.
- **Target Language** is the language to translate into. The default is `en` (English).

Both language rows open a searchable list of 35 languages. They stay off until you connect your account.

## Known issues

- The plugin sends the text of each message you translate, with your source and target language codes, to the translate service at `translate.unbound.rip`.
- Signing in asks Discord for the `identify`, `email`, and `guilds` scopes. The plugin keeps the service's tokens in its settings on your device.
- If the service rejects your saved sign-in, the plugin signs you out. Connect your account again to keep translating.
