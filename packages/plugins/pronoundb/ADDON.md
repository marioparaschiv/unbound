---
media:
    - image: media/after-time.jpg
      alt: PronounDB showing each author's pronouns after the time in message headers.
    - image: media/pill.jpg
      alt: PronounDB with the Pill style, showing pronouns as tags beside names.
    - image: media/custom-pill.jpg
      alt: PronounDB with the Custom pill style in pink.
    - image: media/settings.jpg
      alt: PronounDB's settings for pronoun format, source, style and showing your own.
---

## :sparkle: What it does

- :msg-user: Shows pronouns from PronounDB and from the author's Discord profile in the message header.
- :text: Fits up to 12 characters in the header, and leaves them out when there's no room. The timestamp's accessibility label always gets the full pronouns.
- :user-xmark: Skips bots, system messages and messages without an author header.
- :globe: Sends message authors' Discord user IDs to `pronoundb.org` to look up their pronouns.

## :gear: Settings

- :text-size-change: **Pronouns** picks **Lowercase** (`he/him`) or **Capitalized** (`He/Him`). Lowercase by default.
- :swap: **Source** picks which source wins when both have pronouns. **Prefer PronounDB** by default.
- :user: **Show for Yourself** shows pronouns on your own messages. On by default.
