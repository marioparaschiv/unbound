import { defineConfig } from 'drizzle-kit';

// Migrations take the direct url; `generate` needs no connection, so an unset url is left out.
const url = process.env.DATABASE_DIRECT_URL;

// The web owns `public` in the same database, so the bot's schema and history stay in `bot`.
export default defineConfig({
	dialect: 'postgresql',
	schema: './src/db/schema/index.ts',
	out: './drizzle',
	schemaFilter: ['bot'],
	migrations: { schema: 'bot' },
	...(url ? { dbCredentials: { url } } : {}),
});
