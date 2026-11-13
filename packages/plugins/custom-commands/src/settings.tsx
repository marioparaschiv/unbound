import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { storage, ui } from '@unbound-app/api';

import CommandList from '~/components/command-list';
import CommandPage from '~/components/command-page';
import { getTags } from '~/lib/saved-commands';
import { openCommand } from '~/lib/navigation';

type SettingsPanelProps = {
	/** Draws only this command's page, by its name, instead of the list. */
	command?: string;
};

/**
 * @description The plugin's settings: its saved commands, each opening its own sub-page; `command` draws one alone.
 * @param props The command to draw alone, if any.
 * @returns The page.
 */
function SettingsPanel({ command }: SettingsPanelProps) {
	storage.useBucket(addon.id);

	const navigation = Discord.useNavigation();

	if (command !== undefined) {
		return <CommandPage name={command} />;
	}

	return (
		<ui.Page>
			<Discord.Text variant='text-md/normal' color='text-muted'>
				{messages.SETTINGS_INTRO}
			</Discord.Text>
			<CommandList tags={getTags()} onOpen={(name) => openCommand(navigation, name)} />
		</ui.Page>
	);
}

export default SettingsPanel;
