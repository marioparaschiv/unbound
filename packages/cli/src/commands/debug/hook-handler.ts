import { RECORDING_GRACE_MS, runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { captureNativeHook } from '~/lib/probes';

import type hookCommand from './hook';

const handler: CommandHandler<typeof hookCommand.schema> = async (
	{ className, method, parameters, duration, samples },
	{ client },
) =>
	runOnDevice(
		client,
		toDeviceCode(captureNativeHook, className, method, parameters, duration, samples),
		duration + RECORDING_GRACE_MS,
	);

export default handler;
