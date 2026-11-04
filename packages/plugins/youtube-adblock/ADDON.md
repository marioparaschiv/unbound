## :sparkle: What it does

- :video: YouTube videos you open from a message play without ads. Ads are removed before the player sees them, and an ad that still starts is skipped.
- :eye-slash: Ad banners and overlays on the player are hidden.
- :users: Watch Together plays without ads too. This only changes your own player, so others in the activity still see ads.
- :link: Works with Fix Youtube Embeds: its fallback player is covered as well.
- :circle-info: Other pages Discord shows in the app, such as sign-in pages and other activities, are left alone. The blocker only runs on youtube.com and youtube-nocookie.com.
- :code-fork: A port of Vencord's YoutubeAdblock, which uses a modified version of AdGuard's Block YouTube Ads. Vencord injects it into YouTube frames from Discord's desktop window. Discord mobile plays YouTube in web views instead, so this plugin adds the same script to every web view that shows YouTube.

## :circle-info: Limits

- :mobile: On Android, YouTube inside Watch Together sits in a frame of the activity's page. Android web views add scripts to frames only through Android System WebView's document-start script support. Where the installed web view lacks it, Watch Together on Android shows ads, and only the media viewer's player is ad-free.
- :refresh: A player that is already open when you turn the plugin on or off keeps its previous state until you open it again.

## :gear: Settings

None, like on Vencord.
