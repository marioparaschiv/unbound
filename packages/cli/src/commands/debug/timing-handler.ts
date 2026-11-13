import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { measureTiming } from '~/lib/probes';

import type timingCommand from './timing';

const handler: CommandHandler<typeof timingCommand.schema> = async ({ rounds }, { client }) =>
	runOnDevice(client, toDeviceCode(measureTiming, rounds));

export default handler;
