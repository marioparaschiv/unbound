import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { Type } from '~/lib/schema';

const schema = Type.Object({});

const loginCommand: CommandDefinition<typeof schema> = {
	name: 'login',
	description:
		'Log in to Unbound by approving a code on the website, so `ubd publish` can submit addons. ' +
		'Not needed in CI when UNBOUND_API_KEY is set.',
	summary: 'Log in to Unbound for publishing.',
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./login-handler')),
};

export default loginCommand;
