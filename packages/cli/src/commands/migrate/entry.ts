import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	dir: defaulted(
		Type.String({
			description:
				'A plugin folder, or a folder of plugins, whose src/index entries to migrate.',
		}),
		'.',
	),
});

const entryCommand: CommandDefinition<typeof schema> = {
	name: 'entry',
	description:
		"Turn a plugin entry's `export default { start, stop, getSettingsPanel }` into named exports: " +
		'`export function start`, `stop` and `SettingsPanel`, keeping comments.',
	summary: 'Turn a default-export entry into named exports.',
	mcp: false,
	schema,
	cli: { positionals: ['dir'] },
	handler: lazyHandler(() => import('./entry-handler')),
};

export default entryCommand;
