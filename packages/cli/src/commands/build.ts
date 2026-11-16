import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	addons: defaulted(
		Type.Array(Type.String(), {
			description:
				'The addons to build, by manifest id or directory. Without any, every addon in the workspace builds.',
		}),
		[],
	),
	declaredCapabilities: defaulted(
		Type.Boolean({
			description:
				'Keep the hand-written platforms and Capabilities of plugins that still declare them, until they select platform code with native.definePlatform.',
		}),
		false,
	),
	strictBudget: defaulted(
		Type.Boolean({
			description:
				'Fail the build when a plugin goes over a size budget, instead of warning.',
		}),
		false,
	),
	shard: Type.Optional(
		Type.String({
			description:
				'Build one part of the workspace, such as 2/3, so a large workspace can build in several processes.',
		}),
	),
	verbose: defaulted(
		Type.Boolean({
			description:
				'Also list the largest source modules of each plugin, and log each metro filter the build rewrote into a built-in filter, with its file and line.',
		}),
		false,
	),
});

const buildCommand: CommandDefinition<typeof schema> = {
	name: 'build',
	description:
		"Build every addon in the workspace once, or only the ones named, then run the post-build checks on each, reporting per-addon success and failure, and each plugin's size against its budgets.",
	summary: 'Build the addons in the workspace.',
	mcp: false,
	schema,
	cli: { positionals: ['addons'] },
	handler: lazyHandler(() => import('./build-handler')),
};

export default buildCommand;
