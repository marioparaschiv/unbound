---
banner: media/banner.png
---

## :sparkle: What it does

- :music: While Last.fm or ListenBrainz says you are playing something, your Discord activity shows the track, artist and album cover, like it does on desktop.
- :refresh: It checks every 16 seconds, and right after you change a setting. A slow lookup is allowed to finish before the next check starts. The activity clears when the music stops, when the lookup fails, and when you turn the plugin off.
- :link: The track, artist and album names link to their pages on the scrobbler, and a **Profile** button can link to yours.
- :headphones: It stays out of the way of Spotify, or any other app that already shows what you are listening to.
- :code-fork: A port of Vencord's MusicRichPresence.

## :gear: Settings

- :music: **Scrobbler** picks **Last.fm**, **ListenBrainz** or a self-hosted **ListenBrainz Compatible** instance. Last.fm by default.
- :user: **Username** is your name on that scrobbler. Nothing shows until it is set.
- :lock: **API Key** is your own Last.fm API key, which avoids the rate limit of the shared key. Its description links the Last.fm page that makes one.
- :server: **Instance URL** and **API URL** point at a self-hosted ListenBrainz. Both are needed.
- :text: **Custom Status Text** is the activity name, with `{artist}`, `{album}` and `{title}` for the playing track. "some music" by default.
- :pen: **Activity Name** uses the custom text, the music service name, **Artist - Song**, **Song - Artist**, the artist, the song, or the album.
- :users: **Member List Shows** the activity name, the artist or the track next to your name. The artist by default.
- :photo: **Without Album Art** shows the large scrobbler logo or a generic placeholder.
- :toggle: **Listening Status**, **Clickable Links**, **Profile Button**, **Album Cover**, **Scrobbler Logo**, **Hide With Spotify** and **Hide With Other Activities** match the Vencord options. Clickable links, album cover, logo and hiding with Spotify are on by default.

## :circle-info: Limits

- :mobile: Discord only sends your activity while it is open. When you switch away, the system pauses the checks, and Discord's connection closes after a while, so the activity stays as it was or disappears until you come back.
- :globe: Mobile Discord has no connection allowlist, so a self-hosted instance works as soon as both URLs are set. Vencord's **Allow Instance** prompt is not needed.
