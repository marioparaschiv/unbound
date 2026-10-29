PronounDB shows a message author's pronouns after the timestamp in the message header, for example `• he/him`. It reads pronouns from PronounDB and from the pronouns field of the author's Discord profile.

The header shows at most 12 characters of the pronouns. When the header has no room for them, the plugin leaves them out of the header. The plugin always adds the full pronouns to the timestamp's accessibility label. The plugin skips bots, system messages, and messages without an author header.

## Settings

- **Pronouns** sets how PronounDB pronouns look, **Lowercase** (`he/him`) or **Capitalized** (`He/Him`). The default is **Lowercase**.
- **Source** sets which source wins when both have pronouns. **Prefer PronounDB** falls back to Discord profile pronouns. **Prefer Discord** falls back to PronounDB. The default is **Prefer PronounDB**.
- **Show for Yourself** shows pronouns on your own messages. The default is on.

## Known issues

- The plugin sends the Discord user IDs of message authors to `pronoundb.org`, in batches of up to 50, one batch every 2 seconds.
- The plugin keeps the pronouns it fetched for the session. A change to **Pronouns** applies only to users the plugin has not fetched yet.
