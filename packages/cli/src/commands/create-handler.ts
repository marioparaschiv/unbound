import { outro, note } from '@clack/prompts';
import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';

import type { CommandHandler } from '~/lib/lazy-handler';
import { resolveOptions } from '~/lib/create-prompts';
import type { ScaffoldResult } from '~/lib/create';
import { DOCS_BASE_URL } from '~/lib/templates';
import { loadConfig } from '~/lib/config';
import { scaffold } from '~/lib/create';

import type createCommand from './create';

const handler: CommandHandler<typeof createCommand.schema> = async (input) => {
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

export default handler;
