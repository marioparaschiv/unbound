## :sparkle: What it does

- :video: Adds a picture in picture button to the header of Discord's media viewer, next to the share and download buttons, for videos and GIF videos.
- :clone: Tap it and the video moves into the system's floating window, so it keeps playing when you leave Discord. Tap it again to close the window.
- :mobile: On iOS the window is the system's picture in picture player, with its own play, pause and close buttons. Tapping its expand button brings you back to the media viewer.
- :mobile: On Android Discord's screen shrinks into a floating window shaped like the video. Expand it to get back to the media viewer.
- :pause: On Android, closing the floating window pauses the video until you come back to Discord.
- :circle-xmark: If the system refuses to open the window, a toast tells you so.
- :code-fork: A port of Vencord's PictureInPicture.

## :gear: Settings

- :repeat: **Loop**: loops the video while it plays in the floating window. On by default.

## :circle-info: Differences from Vencord

- :video: Discord mobile plays videos in the media viewer, so the button lives in the media viewer's header instead of on the video in chat.
- :ban: The window closes when you close the media viewer. Vencord copies the video into a new player that outlives the message, but mobile has no player outside the media viewer to hand the video to.
- :mobile: Android has no picture in picture for a single video inside an app, only for a whole screen, so on Android the floating window shows Discord's media viewer with the video in it.
