Character Counter shows a small counter above the chat input while you type a message. It reads as the message length over your limit, for example `120/2000`. The limit is 4000 characters when your account has Nitro and 2000 otherwise. The counter hides while the chat input is empty.

The counter sits above the chat input without changing its layout. In a channel with slowmode, it moves up to clear the slowmode notice.

## Settings

- **Color thresholds**. Colors the counter as the message approaches the limit. Below 50% of the limit it uses the normal text color, from 50% it turns yellow, from 75% orange, and from 90% red. When the setting is off, the counter stays in Discord's brand color. On by default.

## Known issues

- Discord's chat input does not report text changes, so the counter checks the text every 200 milliseconds. The number can trail your typing by that much.
