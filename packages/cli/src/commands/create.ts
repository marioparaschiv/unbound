import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { Type } from '~/lib/schema';

const schema = Type.Object({
	kind: Type.Optional(
		Type.Enum(['plugin', 'theme'], { description: 'The addon kind to scaffold.' }),
	),
	name: Type.Optional(Type.String({ description: 'The addon name (kebab-case).' })),
	dir: Type.Optional(Type.String({ description: 'The target directory (default ./<name>).' })),
	displayName: Type.Optional(Type.String({ description: 'The human-readable addon name.' })),
	description: Type.Optional(Type.String({ description: 'A one-line description.' })),
	authorName: Type.Optional(Type.String({ description: 'The author name.' })),
	authorId: Type.Optional(Type.String({ description: 'The author Discord id.' })),
	id: Type.Optional(
		Type.String({ description: 'The manifest id (default <authorName>.<name>).' }),
	),
	shape: Type.Optional(
		Type.Enum(['repository', 'addon'], {
			description: 'Scaffold a repository or a single addon.',
		}),
	),
	gitInit: Type.Optional(
		Type.Boolean({ description: 'Initialize a git repository (repository shape only).' }),
	),
	install: Type.Optional(
		Type.Boolean({ description: 'Install dependencies with bun (repository shape only).' }),
	),
});

const createCommand: CommandDefinition<typeof schema> = {
	name: 'create',
	description:
		'Scaffold a new Unbound addon or addon workspace. Prompts for anything left unset, so a ' +
		'fully-flagged invocation runs without prompts for use in CI.',
	summary: 'Scaffold a new addon or workspace.',
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./create-handler')),
};

export default createCommand;
