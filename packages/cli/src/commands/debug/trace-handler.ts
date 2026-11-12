import { RECORDING_GRACE_MS, runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { traceFunction } from '~/lib/probes';

import type traceCommand from './trace';

const handler: CommandHandler<typeof traceCommand.schema> = async (
	{ props, duration, samples },
	{ client },
) =>
	runOnDevice(
		client,
		toDeviceCode(traceFunction, props, duration, samples),
		duration + RECORDING_GRACE_MS,
	);

export default handler;
