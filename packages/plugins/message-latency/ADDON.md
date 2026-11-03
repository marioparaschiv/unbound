## :sparkle: What it does

- :stopwatch: Measures the gap between the time in the message ID and the nonce the sender's client created. Bots and messages without a nonce are skipped.
- :signal: Two warning-colored bars mean the delay reached the threshold. One danger-colored bar means twice the threshold.
- :clock: Three muted bars mean two minutes or more, or a sender clock that runs ahead of Discord's.
- :mobile: Two positive-colored bars mark a sender on an old Discord Android client.
- :msg: Tap the icon for a tooltip like "This message was sent with a delay of 3 seconds." It closes on your next touch or after three seconds.

## :gear: Settings

- :timer: **Latency threshold** sets the shortest delay that gets an icon. Tap to step through 1, 2, 3, 5 and 10 seconds. 2 seconds by default.
- :hourglass: **Show milliseconds** adds milliseconds to the tooltip instead of rounding to the second. Off by default.
- :user: **Ignore my messages** marks only messages other people send. Off by default.
- :magnifier: **Detect legacy Android clients** marks messages with the fixed time offset older Android clients add. On by default.

Delay wording and thresholds follow Vencord's MessageLatency plugin.
