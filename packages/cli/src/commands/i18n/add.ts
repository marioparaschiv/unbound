import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { Type } from '~/lib/schema';

import { pluginField } from './plugin-field';

const schema = Type.Object({
	key: Type.String({ minLength: 1, description: 'The key to add, such as GREETING.' }),
	text: Type.Array(Type.String(), { minItems: 1, description: 'Its English text.' }),
	plugin: pluginField,
});

const addCommand: CommandDefinition<typeof schema> = {
	name: 'add',
	description:
		'Add a key to en-US.json, in sorted place when the file is sorted and last otherwise, and ' +
		'rewrite src/unbound-i18n.d.ts, then report coverage.',
	summary: 'Add a key to en-US.json.',
	mcp: false,
	schema,
	cli: { positionals: ['key', 'text'] },
	handler: lazyHandler(() => import('./add-handler')),
};

export default addCommand;
