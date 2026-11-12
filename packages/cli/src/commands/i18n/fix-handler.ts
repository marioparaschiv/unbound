import type { CommandHandler } from '~/lib/lazy-handler';

import type fixCommand from './fix';

import { runI18n } from './run';

const handler: CommandHandler<typeof fixCommand.schema> = ({ plugin, prune }) =>
	runI18n({ plugin, fix: true, prune });

export default handler;
