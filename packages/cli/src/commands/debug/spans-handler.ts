import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { textSpans } from '~/lib/probes';

import type spansCommand from './spans';

const handler: CommandHandler<typeof spansCommand.schema> = async ({ match, max }, { client }) =>
	runOnDevice(client, toDeviceCode(textSpans, match, max));

export default handler;
