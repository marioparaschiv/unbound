import * as z from 'zod/mini';

// Unlike classic zod, zod/mini registers no locale, so issues would read "Invalid input" without it.
z.config(z.locales.en());

export { z };
