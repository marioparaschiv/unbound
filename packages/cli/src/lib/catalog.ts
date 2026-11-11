import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import type { TObject, TSchema } from '~/lib/schema';

/** The catalog's format; a reader refuses a version it does not know. */
export const CATALOG_VERSION = 1;

/** One property of a command's schema, in the order the schema declares it. */
export type CatalogField = { name: string; required: boolean; schema: TSchema };

/** A command as a graphical front end needs it to build a form and the argv that runs it. */
export type CatalogCommand = {
	name: string;
	description: string;
	summary?: string;
	/** The words that select the command, such as `['build']` or `['debug', 'eval']`. */
	path: string[];
	positionals: string[];
	fields: CatalogField[];
};

export type Catalog = { version: number; commands: CatalogCommand[] };

/** A command and the words before its name: none at the root, `['debug']` in a group. */
export type CatalogEntry = { definition: CommandDefinition<TObject>; prefix: string[] };

/**
 * @description Describes every command for a front end that drives `ubd`, such as Unbound DevTools.
 * Fields keep their schema order, which a JSON object would not promise to every reader.
 * @param entries The commands, each with the group words that precede its name.
 * @returns The catalog `ubd catalog` prints.
 */
export function buildCatalog(entries: CatalogEntry[]): Catalog {
	const commands = entries.map(({ definition, prefix }) => {
		const required = new Set(definition.schema.required ?? []);

		return {
			name: definition.name,
			description: definition.description,
			summary: definition.summary,
			path: [...prefix, definition.name],
			positionals: (definition.cli?.positionals ?? []).map(String),
			fields: Object.entries(definition.schema.properties).map(([name, schema]) => ({
				name,
				required: required.has(name),
				schema,
			})),
		};
	});

	return { version: CATALOG_VERSION, commands };
}

export default buildCatalog;
