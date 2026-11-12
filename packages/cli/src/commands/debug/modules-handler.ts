import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { searchModules } from '~/lib/probes';

import type modulesCommand from './modules';

const handler: CommandHandler<typeof modulesCommand.schema> = async (
	{ pattern, max },
	{ client },
) => runOnDevice(client, toDeviceCode(searchModules, pattern, max));

export default handler;
