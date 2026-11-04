import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { findFile } from '~/rollup/source-alias';
import { migrateEntry } from '~/codemods/entry';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	what: Type.Enum(['entry'], { description: 'What to migrate: entry.' }),
	dir: defaulted(
		Type.String({
			description:
				'A plugin folder, or a folder of plugins, whose src/index entries to migrate.',
		}),
		'.',
	),
});

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

const migrateCommand: CommandDefinition<typeof schema> = {
	name: 'migrate',
	description:
		"Rewrite source to the current addon API. `entry` turns a plugin entry's `export default { start, stop, " +
		'getSettingsPanel }` into named exports: `export function start`, `stop` and `SettingsPanel`, keeping comments.',
	summary: 'Migrate plugin source to the current API.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	cli: { positionals: ['what', 'dir'] },
	async handler({ dir }) {
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
	},
};

export default migrateCommand;
