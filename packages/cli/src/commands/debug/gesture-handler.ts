import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { driveGesture } from '~/lib/gesture-probe';
import { gesturePath } from '~/lib/gesture-path';

import type gestureCommand from './gesture';

const handler: CommandHandler<typeof gestureCommand.schema> = async (
	{ fromX, fromY, dx, dy, duration, hold, steps },
	{ client },
) =>
	runOnDevice(
		client,
		toDeviceCode(
			driveGesture,
			gesturePath({ x: fromX, y: fromY, dx, dy, duration, hold, steps }),
		),
		duration + hold + 15_000,
	);

export default handler;
