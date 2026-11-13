import type { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';

import CommandPage from '~/components/command-page';

type Navigation = ReturnType<typeof Discord.useNavigation>;

// Unbound's settings route that draws whatever `render` returns, under `title`.
const PANEL_ROUTE = 'UNBOUND_CUSTOM';

/**
 * @description Pushes the sub-page that edits one command, or creates one when no name is given.
 * @param navigation The settings screen's navigation.
 * @param name The command's name; `undefined` for a new command.
 */
export function openCommand(navigation: Navigation, name?: string): void {
	navigation.push(PANEL_ROUTE, {
		title: name === undefined ? messages.CREATE_COMMAND : format('COMMAND_TITLE', { name }),
		render: () => <CommandPage name={name} />,
	});
}

export default { openCommand };
