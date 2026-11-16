---
banner: media/banner.png
---

## :sparkle: What it does

- :shield: Before a message goes out, checks it for what looks like a secret: private keys, Discord, GitHub, Slack, Stripe, AWS, Google and AI service keys or tokens, login tokens (JWTs), and values written after words like `password:`.
- :triangle-warning: When it finds one, it asks first and names what it found.
- :eye-slash: **Redact and send** replaces each secret with `[redacted]` and sends the rest.
- :pen: **Keep editing** puts the message back in the chat input, with its reply.
- :mobile: Everything is checked on your phone; nothing leaves it until you choose.
