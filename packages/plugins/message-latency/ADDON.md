Message Latency puts a small three-bar signal icon in front of the author name in a message header when that message took a long time to send. The plugin measures the gap between the time in the message ID and the time in the nonce that the sender's client created. It skips messages from bots and messages that have no nonce.

The bars show how late the message was:

- Two bars in Discord's warning color mean the delay reached the threshold.
- One bar in Discord's danger color means the delay reached twice the threshold.
- Three muted bars mean the delay reached two minutes, or the sender's clock is ahead of Discord's.
- Two bars in Discord's positive color mark a sender on an old Discord Android client.

Tap the icon to open a tooltip such as "This message was sent with a delay of 3 seconds." or "This user's clock is 5 seconds ahead." The tooltip closes on your next touch or after three seconds. The icon shows only on messages whose header shows the author name.

## Settings

- **Latency threshold**: the shortest delay that gets an icon. Tap the row to step through 1, 2, 3, 5, and 10 seconds. Default 2 seconds.
- **Show milliseconds**: adds milliseconds to the delay in the tooltip. When this is off, the plugin rounds each delay to the nearest second. Default off.
- **Ignore my messages**: marks only messages that other people send. Default off.
- **Detect legacy Android clients**: marks messages whose nonce has the fixed time offset that older Discord Android clients add. Default on.

## Known issues

- The plugin keeps measurements for the 500 most recent messages it has seen.
- If the plugin cannot find Discord's tooltip component, the icon still shows, but tapping it opens nothing.

## Credits

The delay wording and the bar thresholds follow Vencord's MessageLatency plugin.
