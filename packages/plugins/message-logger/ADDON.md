---
banner: media/banner.png
---

## :sparkle: What it does

- :trash: Deleted messages stay where they were, in red, marked **This message was deleted**.
- :pen: Edited messages show their earlier versions above the current text.
- :clock-rotate-clockwise: **View Edit History** in the long-press menu lists every version and when it changed.
- :broom: **Clear Message History** and **Clear Message Log** tidy up one message or a whole channel.

## :gear: Settings

Pick how logged messages look, what gets logged, and who to ignore. Bots are ignored by default.

## :floppy-disk: Local archive

Enable persistent capture to keep captured edits and deletions across restarts. Search or clear the archive in settings, choose retention from 1 to 30 days and 50 to 2,000 events, and restore retained deleted text in its channel when history loads. Change the deleted-message color in settings.

Message text and attachment names stay in local files; attachment contents are not saved. Only messages captured while the plugin is running can be retained. It cannot recover messages deleted before capture. Archive writes may still be interrupted by an immediate force-close. Ignore and channel controls apply to capture and restoration.
