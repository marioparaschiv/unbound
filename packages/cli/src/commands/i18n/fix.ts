import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { defaulted, Type } from '~/lib/schema';

import { pluginField } from './plugin-field';

const schema = Type.Object({
	plugin: pluginField,
	prune: defaulted(Type.Boolean({ description: 'Also remove keys en-US does not have.' }), false),
});

const fixCommand: CommandDefinition<typeof schema> = {
	name: 'fix',
	description:
		'Add each missing key to every translation, with its en-US text as a stub listed in ' +
		'i18n/untranslated.jsonc, then report coverage. Running it twice changes nothing.',
	summary: 'Stub missing keys in every translation.',
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./fix-handler')),
};

export default fixCommand;
