import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { currentRoute } from '~/lib/navigation';

import type routeCommand from './route';

const handler: CommandHandler<typeof routeCommand.schema> = async (_input, { client }) =>
	runOnDevice(client, toDeviceCode(currentRoute));

export default handler;
