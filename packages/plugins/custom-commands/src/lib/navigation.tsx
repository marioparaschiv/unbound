import { openPage, type Navigation } from '@unbound-plugins/shared/navigation/open-page';
import { format, messages } from '@unbound-app/i18n';

import CommandPage from '~/components/command-page';

/**
 * @description Pushes the sub-page that edits one command, or creates one when no name is given.
 * @param navigation The settings screen's navigation.
 * @param name The command's name; `undefined` for a new command.
 */
export function openCommand(navigation: Navigation, name?: string): void {
	openPage(
		navigation,
		name === undefined ? messages.CREATE_COMMAND : format('COMMAND_TITLE', { name }),
		() => <CommandPage name={name} />,
	);
}

export default { openCommand };
