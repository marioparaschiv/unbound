import type { CommandHandler } from '~/lib/lazy-handler';
import { withNativeBridge } from '~/lib/native-eval';
import { runOnDevice } from '~/lib/device';

import type evalCommand from './eval';

const handler: CommandHandler<typeof evalCommand.schema> = (
	{ code, native, timeout },
	{ client },
) => runOnDevice(client, native ? withNativeBridge(code) : code, timeout);

export default handler;
