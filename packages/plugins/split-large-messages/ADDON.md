---
media:
    - image: media/parts.jpg
      alt: Split Large Messages sending a draft over the length limit as several messages in order, with the code block reopened in each part.
---

## :sparkle: What it does

- :msgs: A message over Discord's length limit is sent as several messages, in order, instead of being refused.
- :puzzle-piece: Parts break at blank lines, lines, sentences or words, and a code block that spans parts is closed and reopened so each part still renders.

## :gear: Settings

- **Most parts**: how many messages one draft may become; longer drafts are refused as usual.
