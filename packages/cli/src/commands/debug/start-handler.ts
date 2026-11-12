import type { CommandHandler } from '~/lib/lazy-handler';
import { launchBridge } from '~/lib/bridge-process';

import type startCommand from './start';

const handler: CommandHandler<typeof startCommand.schema> = async ({ port }) =>
	launchBridge(port, false);

export default handler;
