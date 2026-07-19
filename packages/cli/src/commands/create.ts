import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { outro, note } from '@clack/prompts';
import { relative } from 'node:path';
import { z } from 'zod';

import type { CreateInput } from '~/lib/create-prompts';
import { resolveOptions } from '~/lib/create-prompts';
import type { ScaffoldResult } from '~/lib/create';
import { DOCS_BASE_URL } from '~/lib/templates';
import { loadConfig } from '~/lib/config';
import { scaffold } from '~/lib/create';

const schema = z.object({
	kind: z.enum(['plugin', 'theme']).optional().describe('The addon kind to scaffold.'),
	name: z.string().optional().describe('The addon name (kebab-case).'),
	dir: z.string().optional().describe('The target directory (default ./<name>).'),
	displayName: z.string().optional().describe('The human-readable addon name.'),
	description: z.string().optional().describe('A one-line description.'),
	authorName: z.string().optional().describe('The author name.'),
	authorId: z.string().optional().describe('The author Discord id.'),
	id: z.string().optional().describe('The manifest id (default <authorName>.<name>).'),
	shape: z
		.enum(['repository', 'addon'])
		.optional()
		.describe('Scaffold a repository or a single addon.'),
	gitInit: z
		.boolean()
		.optional()
		.describe('Initialize a git repository (repository shape only).'),
	install: z
		.boolean()
		.optional()
		.describe('Install dependencies with bun (repository shape only).'),
});

const createCommand: CommandDefinition<typeof schema> = {
	name: 'create',
	description:
		'Scaffold a new Unbound addon or addon workspace. Prompts for anything left unset, so a ' +
		'fully-flagged invocation runs without prompts for use in CI.',
	surfaces: { cli: true, mcp: false },
	schema,
	async handler(input: CreateInput) {
		const config = loadConfig();
		const workspace = config.bare ? void 0 : config;

		const options = await resolveOptions(input, workspace);

		try {
			const result = scaffold(options, workspace);

			printOutro(result);

			return { ok: true, text: '' };
		} catch (error: any) {
			return { ok: false, text: error?.message ?? String(error) };
		}
	},
};

function printOutro(result: ScaffoldResult): void {
	const kindDocs = `${DOCS_BASE_URL}/${result.kind}s/introduction`;
	const manifestDocs = `${DOCS_BASE_URL}/addons/manifest`;
	const cd = relative(process.cwd(), result.dir) || '.';

	const steps = [
		`cd ${cd}`,
		'ubd dev',
		`Learn the ${result.kind} API: ${kindDocs}`,
		`Manifest reference: ${manifestDocs}`,
	];

	note(steps.join('\n'), 'Next steps');
	outro(`${result.name} ready.`);
}

export default createCommand;
