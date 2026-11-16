---
banner: media/banner.png
---

## :sparkle: What it does

- :calendar: `/cron 30 9 * * MON-FRI` explains the schedule, "At 09:30, on Monday–Friday", and lists its next runs.
- :globe: Pick a **timezone** to read the schedule there, or leave it empty for yours. Daylight saving changes are handled the way cron handles them.
- :eye-slash: The answer is only shown to you, unless you turn on **send**.

## :bullet-list: What it reads

- Five fields: minute, hour, day of month, month and weekday, with lists, ranges, steps and names like `JAN` or `MON`.
- Macros such as `@hourly`, `@daily`, `@weekly`, `@monthly` and `@yearly`.
