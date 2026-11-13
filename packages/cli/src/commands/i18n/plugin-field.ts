import { Type } from '~/lib/schema';

/** The `--plugin` flag every `ubd i18n` command takes. */
export const pluginField = Type.Optional(
	Type.String({ description: 'The plugin directory. Defaults to the current directory.' }),
);

export default pluginField;
