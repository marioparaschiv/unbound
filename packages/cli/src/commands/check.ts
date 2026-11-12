import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { CHECK_IDS } from '~/lib/check/check-ids';
import { lazyHandler } from '~/lib/lazy-handler';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	plugin: defaulted(
		Type.Array(Type.String(), {
			description:
				'An addon directory to check, repeatable; defaults to the addon holding the current directory.',
		}),
		[],
	),
	all: defaulted(Type.Boolean({ description: 'Check every addon in the workspace.' }), false),
	watch: defaulted(
		Type.Boolean({
			description: 'Re-check an addon on every save, printing only what changed.',
		}),
		false,
	),
	only: defaulted(
		Type.Array(Type.String(), {
			description: `Run only these checks, comma-separated: ${CHECK_IDS.join(', ')}.`,
		}),
		[],
	),
	strict: defaulted(Type.Boolean({ description: 'Fail on warnings too.' }), false),
	types: defaulted(
		Type.Boolean({
			description: 'Also type-check each addon with its tsconfig, like tsc --noEmit; slow.',
		}),
		false,
	),
	declaredCapabilities: defaulted(
		Type.Boolean({
			description:
				'Check the capabilities as `ubd build --declared-capabilities` does, keeping hand-written platforms and Capabilities.',
		}),
		false,
	),
	json: defaulted(Type.Boolean({ description: 'Print the diagnostics as JSON.' }), false),
});

const checkCommand: CommandDefinition<typeof schema> = {
	name: 'check',
	description:
		'Run every check `ubd build` runs, plus the manifest, the plugin lint and the build’s rollup plugins, without producing a bundle. Exits non-zero on any error.',
	summary: 'Check addons without building them.',
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./check-handler')),
};

export default checkCommand;
