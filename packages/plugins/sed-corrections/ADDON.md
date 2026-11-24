---
media:
    - image: media/corrected.jpg
      alt: Sed Corrections editing your last message in place instead of sending a new one.
    - image: media/draft.jpg
      alt: 'Sed Corrections: typing s/teh/the/g to fix a typo in your last message.'
---

## :sparkle: What it does

- :pen: Send `s/teh/the/` and your last message in the channel is corrected instead of a new message going out.
- :brackets-curly: Add `g` to fix every match and `i` to ignore case. The pattern is a regular expression; `&` and `\1` put the match back.
- :circle-info: When nothing matches, a toast says so and nothing is sent.
