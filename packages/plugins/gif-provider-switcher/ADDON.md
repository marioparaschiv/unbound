---
banner: media/banner.png
---

## :sparkle: What it does

- :magnifier: Searches GIFs on **Tenor** or **Giphy** instead of Klipy, Discord's own GIF provider.
- :photo: The whole GIF picker follows the provider you pick: search results, search suggestions, trending categories and the trending GIFs.
- :msg: The `/gif` command searches the same provider.
- :refresh: A button next to the GIF search field shows the current provider. Tap it to switch to the next one: Tenor, Giphy, then Klipy. If you typed a search, it runs again with the new provider.
- :text: The search field names the provider you picked instead of Klipy.
- :video: GIFs load as MP4, which Discord on iOS and Android plays.
- :globe: Results follow your Discord language.
- :code-fork: A port of Vencord's GifProviderSwitcher.

## :gear: Settings

- :toggle: **Provider**: **Tenor**, **Giphy** or **Klipy**. Tenor by default. Klipy leaves Discord's GIF search unchanged.

## :circle-info: Good to know

- :globe: Tenor and Giphy are called straight from your device, so they see your IP address and searches. Tenor also gets the GIF you send, as Tenor asks apps to report it.
- :toggle: Turning the plugin off with the GIF picker open removes the button and the renamed search field right away. What you typed stays in the field.
- :ban: Vencord's extra `/tenor` command isn't added. On mobile, Discord decides how its built-in GIF commands run in code a plugin can't change, so a `/tenor` command wouldn't work. Use `/gif` instead.
