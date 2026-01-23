# Contributing to Unbound Translations

Thank you for your interest in helping translate Unbound! This guide will help you contribute translations in your language.

## Table of Contents

- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Translation Guidelines](#translation-guidelines)
- [Adding a New Language](#adding-a-new-language)
- [Translation Keys](#translation-keys)
- [Quality Checklist](#quality-checklist)

## Getting Started

### Prerequisites

- Basic knowledge of JSON format
- Familiarity with your target language
- A text editor (VS Code recommended)

## How to Contribute

### 1. Fork & Clone

```bash
git clone https://github.com/marioparaschiv/unbound.git
cd unbound/packages/i18n
```

### 2. Choose What to Translate

- **Update existing translations**: Edit files in `locales/`
- **Add missing keys**: Compare your locale with `en-US.json` (optional - untranslated keys fall back to English)
- **Add new language**: See [Adding a New Language](#adding-a-new-language)

### 3. Edit Translation Files

Open the locale file you want to edit:

```bash
# Example: Edit Spanish translations
code locales/es-ES.json
```

### 4. Follow the Format

```json
{
  "UNBOUND_KEY_NAME": "Your translated text here",
  "UNBOUND_WITH_VARIABLE": "Text with {variable} placeholder"
}
```

### 5. Submit a Pull Request

```bash
git checkout -b translations/your-language
git add locales/
git commit -m "feat(i18n): add/update [language] translations"
git push origin translations/your-language
```

Then open a PR on GitHub!

## Translation Guidelines

### General Rules

1. **Keep variables intact**: Don't translate `{variable}` placeholders
   ```json
   ✅ "UNBOUND_BY_AUTHORS": "Por {authors}"
   ❌ "UNBOUND_BY_AUTHORS": "Por {autores}"
   ```

2. **Maintain formatting**: Keep `\n` for line breaks
   ```json
   "UNBOUND_ADDONS_EMPTY": "No se encontraron {type}.\nIntenta instalar algunos?"
   ```

3. **Preserve tone**: Unbound uses a friendly, casual tone
   - Use informal language where appropriate
   - Keep error messages clear and helpful

4. **Context matters**: Consider where the text appears
   - Button labels should be concise
   - Descriptions can be more detailed

5. **Stay consistent**: Use the same terms throughout
   - Pick one word for "plugin" and stick with it
   - Match Discord's terminology when applicable

### Variables You'll See

Common placeholders (DO NOT TRANSLATE):
- `{name}` - Addon/plugin name
- `{type}` - Type of addon (plugin/theme)
- `{error}` - Error message
- `{authors}` - Author names
- `{amount}` - Numbers/counts
- `{source}` - Source name
- `{version}` - Version number

## Adding a New Language

### 1. Create the Locale File

```bash
# Use the locale code format: language-COUNTRY
cp locales/en-US.json locales/fr-FR.json
```

### 2. Translate Keys

Translate the strings in your new file. Use `en-US.json` as reference. You can translate as many or as few keys as you want - any missing keys will fall back to English.

### 3. Register the Locale

Add your locale to `index.ts`:

```typescript
import frFR from './locales/fr-FR.json';

const locales = {
	'en-US': enUS,
	'en-GB': enGB,
	'de-DE': deDE,
	'es-ES': esES,
	'fr-FR': frFR, // Add your locale here
};
```

## Translation Keys

Keys follow this naming convention:

```
UNBOUND_[CATEGORY]_[SPECIFIC_NAME]
```

### Categories

- `UNBOUND_ADDON_*` - Addon/plugin related
- `UNBOUND_THEME_*` - Theme related
- `UNBOUND_SETTINGS_*` - Settings pages
- `UNBOUND_ERROR_*` - Error messages
- `UNBOUND_TOAST_*` - Toast notifications
- `UNBOUND_DIALOG_*` - Dialog boxes

## Quality Checklist

Before submitting your translation, verify:

- [ ] Variables `{like_this}` are unchanged
- [ ] Formatting (`\n`, quotes) is preserved
- [ ] Text reads naturally in your language
- [ ] Technical terms are consistent
- [ ] JSON syntax is valid (no trailing commas, quotes matched)
- [ ] No English text remains in translated keys (except proper nouns like "Unbound")

**Note:** You don't need to translate every key! Missing keys will automatically fall back to English.

## FAQ

### Q: Do I need to translate every key?

**A:** No! You can translate as many or as few keys as you want. Any keys you don't translate will automatically fall back to English. It's better to have high-quality partial translations than rushed complete ones.

### Q: Can I use machine translation?

**A:** Machine translation is a good starting point, but please review and refine it. Native-sounding translations are much better than literal ones.

### Q: What if a translation is too long?

**A:** Try to keep translations similar in length to English, especially for buttons and labels. If needed, use common abbreviations in your language.

### Q: Should I translate "Unbound"?

**A:** No, "Unbound" is a proper name and should not be translated.

### Q: What locale code should I use?

**A:** Use the format `language-COUNTRY` (e.g., `pt-BR` for Brazilian Portuguese, `zh-CN` for Simplified Chinese). Follow [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) for language codes.

### Q: How do I handle plurals?

**A:** Currently, Unbound uses simple string replacement. Try to write translations that work for both singular and plural, or use generic terms.

## Need Help?

- **Found missing keys?** Check if they exist in `en-US.json` first
- **Unsure about context?** Ask in the PR or open an issue
- **Technical issues?** See the main [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Thank You!

Every translation makes Unbound accessible to more people. Your contribution is greatly appreciated!

---

**Note:** By contributing translations, you agree to license your contributions under the same license as the project.
