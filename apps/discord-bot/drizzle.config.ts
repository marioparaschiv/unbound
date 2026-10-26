import { defineConfig } from 'drizzle-kit';

// Migrations take the direct url; `generate` needs no connection, so an unset url is left out.
const url = process.env.DATABASE_DIRECT_URL;

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/db/schema/index.ts',
	out: './drizzle',
	...(url ? { dbCredentials: { url } } : {}),
});
