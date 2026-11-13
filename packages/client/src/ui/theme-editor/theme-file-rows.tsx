import { createLogger } from '@unbound-app/logger';

import ThemeEditorStore from '~/themes/editor-state';
import { parseThemeBundle } from '~/themes/bundle';
import { Discord } from '~/metro/components';
import { Clipboard } from '~/metro/common';
import ThemeStore from '~/themes/state';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';
import { show } from '~/toasts/api';

const Logger = createLogger('Themes', 'Editor');

function copy() {
	const draft = ThemeStore.getState().preview;

	if (!draft) return;

	Clipboard.setString(JSON.stringify(draft, null, '\t'));
	show({ content: messages.UNBOUND_THEME_COPIED, icon: 'CopyIcon' });
}

async function paste() {
	try {
		const text: string = await Clipboard.getString();

		ThemeEditorStore.getState().edit(parseThemeBundle(text));
	} catch (error) {
		Logger.error('Failed to import the theme.json from the clipboard:', error);
		show({ content: messages.UNBOUND_THEME_PASTE_FAILED, icon: 'CircleXIcon' });
	}
}

/**
 * @description The theme editor's File group: copy the draft as a theme.json, or replace it with one from the clipboard.
 */
function ThemeFileRows() {
	return (
		<Discord.TableRowGroup title={messages.UNBOUND_THEME_FILE}>
			<Discord.TableRow
				label={messages.UNBOUND_THEME_COPY_JSON}
				icon={<Discord.TableRowIcon source={icons.CopyIcon} />}
				onPress={copy}
			/>
			<Discord.TableRow
				label={messages.UNBOUND_THEME_PASTE_JSON}
				subLabel={messages.UNBOUND_THEME_PASTE_JSON_DESC}
				icon={<Discord.TableRowIcon source={icons.DownloadIcon} />}
				onPress={() => void paste()}
			/>
		</Discord.TableRowGroup>
	);
}

export default ThemeFileRows;
