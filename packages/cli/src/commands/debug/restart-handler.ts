import type { CommandHandler } from '~/lib/lazy-handler';
import { launchBridge } from '~/lib/bridge-process';

import type restartCommand from './restart';

const handler: CommandHandler<typeof restartCommand.schema> = async ({ port }) =>
	launchBridge(port, true);

export default handler;
