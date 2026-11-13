import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { Type } from '~/lib/schema';

const schema = Type.Object({});

const snapshotsCommand: CommandDefinition<typeof schema> = {
	name: 'snapshots',
	description:
		'List the device snapshots `save` kept on this computer, with each device, name, size and date.',
	summary: 'List the saved snapshots.',
	mcp: true,
	schema,
	handler: lazyHandler(() => import('./snapshots-handler')),
};

export default snapshotsCommand;
