import type { CommandHandler } from '~/lib/lazy-handler';

import type unusedCommand from './unused';

import { runI18n } from './run';

const handler: CommandHandler<typeof unusedCommand.schema> = ({ plugin }) =>
	runI18n({ plugin, unused: true });

export default handler;
