import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { viewTree } from '~/lib/probes';

import type viewsCommand from './views';

const handler: CommandHandler<typeof viewsCommand.schema> = async (
	{ filter, depth, max },
	{ client },
) => runOnDevice(client, toDeviceCode(viewTree, filter, depth, max));

export default handler;
