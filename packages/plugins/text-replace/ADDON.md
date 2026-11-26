---
media:
    - image: media/tester.jpg
      alt: Text Replace's rule tester rewriting an example message with the saved rules.
    - image: media/text-rules.jpg
      alt: Text Replace's Text rule list, expanding abbreviations like idk and brb.
---

## :sparkle: What it does

- :text: Text rules replace every match of their text. They run first.
- :brackets-curly: Regex rules take a JavaScript pattern like `/hello/gi`. Without slashes, a pattern uses the `g` flag.
- :filter: Any rule can have a condition, so it runs only when the message contains some other text.

## :gear: Settings

There are no rules until you add one.

- :sliders-3: **Rule type** switches between the **Text** and **Regex** lists. **Text** by default.
- :plus: **Add text rule** and **Add regex rule** open the editor. Fill in **Find text** or **Pattern**, **Replace with** (`\n` for a new line, blank to remove), and the optional **Only when the message contains**.
- :msg-check: Type into **Example message** and **Result** shows it after your rules run.
- :share-up-right: **Export & share** copies both rule lists as JSON and opens the share sheet.
- :import: **Import clipboard** loads a ruleset from the clipboard.
