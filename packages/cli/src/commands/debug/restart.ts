import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { launchBridge } from '~/lib/bridge-process';
import { bridgePortField } from '~/lib/context';
import { Type } from '~/lib/schema';

const schema = Type.Object({
	port: bridgePortField,
});

const restartCommand: CommandDefinition<typeof schema> = {
	name: 'restart',
	description:
		'Stop the debugger bridge and start it again in the background, so it runs the current code; ' +
		'starts one when none is listening. Its log goes to the system temporary directory.',
	summary: 'Restart the debugger bridge on the current code.',
	mcp: false,
	schema,
	handler({ port }) {
		return launchBridge(port, true);
	},
};

export default restartCommand;
