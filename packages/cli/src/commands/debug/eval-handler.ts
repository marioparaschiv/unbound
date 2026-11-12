import type { CommandHandler } from '~/lib/lazy-handler';
import { runOnDevice } from '~/lib/device';

import type evalCommand from './eval';

const handler: CommandHandler<typeof evalCommand.schema> = ({ code, timeout }, { client }) =>
	runOnDevice(client, code, timeout);

export default handler;
