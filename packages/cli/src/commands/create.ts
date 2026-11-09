import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { outro, note } from '@clack/prompts';
import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';

import type { CreateInput } from '~/lib/create-prompts';
import { resolveOptions } from '~/lib/create-prompts';
import type { ScaffoldResult } from '~/lib/create';
import { DOCS_BASE_URL } from '~/lib/templates';
import { loadConfig } from '~/lib/config';
import { scaffold } from '~/lib/create';
import { Type } from '~/lib/schema';

const schema = Type.Object({
	kind: Type.Optional(
		Type.Enum(['plugin', 'theme'], { description: 'The addon kind to scaffold.' }),
	),
	name: Type.Optional(Type.String({ description: 'The addon name (kebab-case).' })),
	dir: Type.Optional(Type.String({ description: 'The target directory (default ./<name>).' })),
	displayName: Type.Optional(Type.String({ description: 'The human-readable addon name.' })),
	description: Type.Optional(Type.String({ description: 'A one-line description.' })),
	authorName: Type.Optional(Type.String({ description: 'The author name.' })),
	authorId: Type.Optional(Type.String({ description: 'The author Discord id.' })),
	id: Type.Optional(
		Type.String({ description: 'The manifest id (default <authorName>.<name>).' }),
	),
	shape: Type.Optional(
		Type.Enum(['repository', 'addon'], {
			description: 'Scaffold a repository or a single addon.',
		}),
	),
	gitInit: Type.Optional(
		Type.Boolean({ description: 'Initialize a git repository (repository shape only).' }),
	),
	install: Type.Optional(
		Type.Boolean({ description: 'Install dependencies with bun (repository shape only).' }),
	),
});

const createCommand: CommandDefinition<typeof schema> = {
	name: 'create',
	description:
		'Scaffold a new Unbound addon or addon workspace. Prompts for anything left unset, so a ' +
		'fully-flagged invocation runs without prompts for use in CI.',
	summary: 'Scaffold a new addon or workspace.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	async handler(input: CreateInput) {
		const config = loadConfig();

		if ('error' in config) {
			return { ok: false, text: config.error };
		}

		const workspace = config.bare ? void 0 : config;

		const options = await resolveOptions(input, workspace);

		try {
			const result = scaffold(options, workspace);

			printOutro(result);

			return { ok: true, text: '' };
		} catch (error) {
			return { ok: false, text: error instanceof Error ? error.message : String(error) };
		}
	},
};

function printOutro(result: ScaffoldResult): void {
	const kindDocs = `${DOCS_BASE_URL}/${result.kind}s/introduction`;
	const manifestDocs = `${DOCS_BASE_URL}/addons/manifest`;
	const cd = relative(process.cwd(), result.dir) || '.';

	const installed =
		!existsSync(join(result.dir, 'package.json')) ||
		existsSync(join(result.dir, 'node_modules'));

	// `ubd` is only on the PATH of a global install; bunx runs the workspace's copy.
	const steps = [
		`cd ${cd}`,
		...(installed ? [] : ['bun install']),
		'bunx @unbound-app/cli dev',
		`Learn the ${result.kind} API: ${kindDocs}`,
		`Manifest reference: ${manifestDocs}`,
	];

	note(steps.join('\n'), 'Next steps');
	outro(`${result.name} ready.`);
}

export default createCommand;
