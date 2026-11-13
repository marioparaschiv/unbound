import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { Type } from '~/lib/schema';

const schema = Type.Object({});

const logoutCommand: CommandDefinition<typeof schema> = {
	name: 'logout',
	description: 'Delete the credentials `ubd auth login` stored.',
	summary: 'Delete the stored login.',
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./logout-handler')),
};

export default logoutCommand;
