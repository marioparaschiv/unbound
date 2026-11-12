import type { CommandHandler } from '~/lib/lazy-handler';

import type checkCommand from './check';

import { runI18n } from './run';

const handler: CommandHandler<typeof checkCommand.schema> = ({ plugin, strict }) =>
	runI18n({ plugin, strict });

export default handler;
