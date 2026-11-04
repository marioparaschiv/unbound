## :sparkle: What it does

- :file: Files you upload are sent under an anonymous name, so the original name never reaches Discord.
- :puzzle-piece: The extension is kept, including both parts of tarballs such as `.tar.gz`, so files still open and preview as usual.
- :eye-slash: Tap a file waiting in the chat input and its sheet gets an **Anonymise File Name** switch, to keep the original name for that one file or anonymise it when the default is off.
- :paperclip: Files other plugins upload, such as those from Add Attachments, are anonymised too.
- :code-fork: A port of Vencord's AnonymiseFileNames.

## :gear: Settings

- :toggle-on: **Anonymise by Default**: on by default. Turn it off to anonymise only the files you switch on.
- :list: **Method**:
    - **Random Characters**, the default: a random name, `7` characters long unless you set **Length**, from 1 to 32.
    - **Consistent**: every file gets the same **File Name**, `image` unless you change it. A blank name falls back to `image`.
    - **Timestamp**: the time of the upload in milliseconds, such as `1730000000000.png`.

## :circle-info: Differences from Vencord

- :mobile: The per-file switch lives in the file's preview sheet instead of a button over the attachment, since mobile has no hover bar.
- :wrench: Vencord takes any number for the random length; here it is a slider from 1 to 32.
- :image: When Discord converts a file before sending it, such as a HEIC photo saved as JPG, the anonymous name keeps Discord's new extension, and switching anonymising off brings back the real name with that extension.
