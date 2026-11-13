import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
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
		"Build every addon in the workspace once, then run the post-build checks on each, reporting per-addon success and failure, and each plugin's size against its budgets.",
	summary: 'Build every addon in the workspace.',
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./build-handler')),
};

export default buildCommand;
