import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import type { CommandHandler } from '~/lib/lazy-handler';
import { findFile } from '~/rollup/source-alias';
import { migrateEntry } from '~/codemods/entry';

import type entryCommand from './entry';

// The plugin's own entry, or each child plugin's when `dir` holds several.
function entriesIn(dir: string): string[] {
	const own = findFile(resolve(dir, 'src', 'index'));

	if (own) {
		return [own];
	}

	if (!existsSync(dir)) {
		return [];
	}

	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = entry.isDirectory()
			? findFile(resolve(dir, entry.name, 'src', 'index'))
			: null;

		return file ? [file] : [];
	});
}

const handler: CommandHandler<typeof entryCommand.schema> = async ({ dir }) => {
	const root = resolve(dir);
	const entries = entriesIn(root);

	if (entries.length === 0) {
		return { ok: false, text: `No src/index entry in ${root} or its folders.` };
	}

	const migrated: string[] = [];
	const problems: string[] = [];

	for (const file of entries) {
		const result = migrateEntry(readFileSync(file, 'utf8'), file);

		problems.push(...result.problems);

		if (!result.changed) {
			continue;
		}

		writeFileSync(file, result.code);
		migrated.push(relative(process.cwd(), file));
	}

	const lines = [
		`Migrated ${migrated.length} of ${entries.length} entries.`,
		...migrated.map((file) => `  ${file}`),
		...problems,
	];

	return { ok: problems.length === 0, text: lines.join('\n') };
};

export default handler;
