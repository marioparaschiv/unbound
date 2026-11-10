import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { defaulted, Type } from '~/lib/schema';
import { pluginField, runI18n } from './run';

const schema = Type.Object({
	plugin: pluginField,
	strict: defaulted(
		Type.Boolean({ description: 'Fail on missing and untranslated keys too.' }),
		false,
	),
});

const checkCommand: CommandDefinition<typeof schema> = {
	name: 'check',
	description:
		"Report how far each translation in a plugin's i18n/ folder covers en-US.json, with every ICU " +
		'problem. Fails on ICU problems and keys en-US lacks; --strict also fails on missing keys.',
	summary: 'Report translation coverage and ICU problems.',
	mcp: false,
	schema,
	handler({ plugin, strict }) {
		return runI18n({ plugin, strict });
	},
};

export default checkCommand;
