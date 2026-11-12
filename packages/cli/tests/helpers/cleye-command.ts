import type { CommandDefinition, CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { cli } from 'cleye';

import { toCleyeCommand } from '~/adapters/cleye';
import { defaulted, Type } from '~/lib/schema';
import { failure } from '~/lib/command-error';

/**
 * A stand-in command run through the real cleye adapter in a child process, so a test sees what
 * `ubd` prints and its exit code. `UBD_TEST_TTY=1` makes stdin look like a terminal.
 */

const OUTPUTS: Record<string, () => CommandOutput> = {
	ok: () => ({ ok: true, text: 'Done.', data: { count: 1 } }),
	coded: () =>
		failure('not-found', 'No addon is named x.', { hint: 'Run ubd build.', field: 'code' }),
	plain: () => ({ ok: false, text: 'It broke.' }),
	throws: () => {
		throw new Error('Boom.');
	},
};

const schema = Type.Object({
	code: Type.String({ description: 'Which output to return.' }),
	count: defaulted(Type.Integer({ minimum: 1, description: 'A bounded number.' }), 1),
});

const definition: CommandDefinition<typeof schema> = {
	name: 'probe',
	description: 'Returns a canned output.',
	summary: 'Returns a canned output.',
	mcp: false,
	schema,
	cli: { positionals: ['code'] },
	async handler({ code }) {
		return (OUTPUTS[code] ?? OUTPUTS.plain!)();
	},
};

if (process.env.UBD_TEST_TTY) {
	process.stdin.isTTY = true;
}

cli({ name: 'ubd', commands: [toCleyeCommand(definition)] }, void 0, process.argv.slice(2));
