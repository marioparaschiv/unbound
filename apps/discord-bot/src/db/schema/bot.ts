import { pgSchema } from 'drizzle-orm/pg-core';

/** The bot's own schema in the web's database; the web owns `public`, which the bot only reads. */
export const botSchema = pgSchema('bot');
