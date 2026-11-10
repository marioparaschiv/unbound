import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { Type } from '~/lib/schema';

import { pluginField, runI18n } from './run';

const schema = Type.Object({
	plugin: pluginField,
});

const unusedCommand: CommandDefinition<typeof schema> = {
	name: 'unused',
	description:
		'List en-US keys no source uses, and used keys en-US lacks, after the coverage report. Fails on ' +
		'a used key en-US lacks.',
	summary: 'List unused keys, and used keys en-US lacks.',
	mcp: false,
	schema,
	handler({ plugin }) {
		return runI18n({ plugin, unused: true });
	},
};

export default unusedCommand;
