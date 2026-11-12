import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	report: defaulted(
		Type.Boolean({
			description:
				'After each rebuild, print its bundle size and the issues its build report counts. Slows each rebuild a little.',
		}),
		false,
	),
	port: bridgePortField,
});

const devCommand: CommandDefinition<typeof schema> = {
	name: 'dev',
	description:
		'Watch every addon in the workspace and rebuild only the addon whose files change, reloading ' +
		'it in the running client after each successful build. Runs until interrupted.',
	summary: 'Watch addons and rebuild on change.',
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./dev-handler')),
};

export default devCommand;
