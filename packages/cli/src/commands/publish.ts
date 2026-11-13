import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { Type } from '~/lib/schema';

const schema = Type.Object({
	addon: Type.Optional(
		Type.String({
			description: 'The id of the addon to publish; required when the workspace has several.',
		}),
	),
	ref: Type.Optional(
		Type.String({
			description:
				'The branch, tag or commit to submit; defaults to the tag on HEAD, else its SHA.',
		}),
	),
	repository: Type.Optional(
		Type.String({
			description: 'The GitHub repository to submit from; defaults to the `origin` remote.',
		}),
	),
});

const publishCommand: CommandDefinition<typeof schema> = {
	name: 'publish',
	description:
		'Submit the committed and pushed addon for review on Unbound; its build output must be ' +
		'committed. Authenticates with UNBOUND_API_KEY when set, otherwise with the `ubd auth login` session.',
	summary: 'Submit a committed, pushed addon for review.',
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./publish-handler')),
};

export default publishCommand;
