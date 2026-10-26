import { migrateDatabase } from '~/db/migrate';
import { createTestDatabase } from './tests/helpers/database';

const out = process.argv[2]!;
const database = await createTestDatabase();

try {
	await migrateDatabase(database.url);
	const dump = Bun.spawnSync([
		'pg_dump',
		'--schema-only',
		'--no-owner',
		'--exclude-schema=drizzle',
		'-f',
		out,
		database.url,
	]);
	if (dump.exitCode !== 0) throw new Error(dump.stderr.toString());
} finally {
	await database.drop();
}
