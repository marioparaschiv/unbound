# Plugin conventions

Plugin folders use lowercase kebab-case, such as `message-link-embeds`. They are limited to 48 characters and must contain only lowercase letters, numbers, and single hyphens.

Plugin IDs use a lowercase namespace followed by the folder name, such as `unbound.message-link-embeds` or `adrian.aussie-speech`. The final ID segment must exactly match the folder name.

Display names are short human-readable names made from title-case words separated by spaces. Established brand names may use a final uppercase acronym, such as `PronounDB` or `ReviewDB`; standalone acronyms are also allowed, such as `GIF Paste`. They must be 64 characters or fewer, with no leading or trailing whitespace or control characters.

Descriptions are concise, user-facing sentences with a maximum of 160 characters. They must be single-line text with no leading or trailing whitespace or control characters.

The pre-commit hook validates every plugin folder, manifest, naming collision, and description limit before allowing a commit.
