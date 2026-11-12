import type { CommandHandler } from '~/lib/lazy-handler';

import type addCommand from './add';

import { runI18n } from './run';

const handler: CommandHandler<typeof addCommand.schema> = ({ key, text, plugin }) =>
	runI18n({ plugin, add: { key, text: text.join(' ') } });

export default handler;
