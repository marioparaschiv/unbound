---
banner: media/banner.png
---

## :sparkle: What it does

- :video: Adds a picture in picture button to the header of Discord's media viewer for every video: attachments, video links and embeds, and web players such as YouTube.
- :clone: Tap it and the video moves into the system's floating window, so it keeps playing when you leave Discord. Tap it again, or use the window's own close button, to bring it back.
- :circle-play: The video carries on from where it was, keeps playing while Discord is in the background, and the window's own play and pause buttons are respected.
- :mobile: On iOS the window is the system's picture in picture player, with its own play, pause and close buttons.
- :mobile: On Android the floating window shows just the video, without the media viewer's controls. Expanding it returns to the media viewer at the point the window reached.
- :circle-xmark: If the system refuses to open the window, a toast tells you so.
- :code-fork: A port of Vencord's PictureInPicture.

## :circle-info: Differences from Vencord

- :video: Discord mobile plays videos in the media viewer, so the button lives in the media viewer's header instead of on the video in chat.
- :ban: Links Discord shows without a playable embed, such as Instagram reels, have no video to put in the window.
