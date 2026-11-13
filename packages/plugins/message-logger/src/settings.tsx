import { openPage } from '@unbound-plugins/shared/navigation/open-page';
import { resetSettings, settings, useSetting } from '@unbound-app/settings';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import IgnoreListPage, { IGNORE_LISTS, type IgnoreListKey } from '~/components/ignore-list-page';
import { idList } from '~/lib/filters';

type SwitchKey =
	| 'redText'
	| 'deletedMarker'
	| 'inlineEdits'
	| 'logDeletes'
	| 'logEdits'
	| 'persistLog'
	| 'logDeletedAttachments'
	| 'ignoreBots'
	| 'ignoreSelf';

function SwitchRow({
	setting,
	label,
	subLabel,
}: {
	setting: SwitchKey;
	label: string;
	subLabel: string;
}) {
	const value = useSetting(setting);

	return (
		<ui.SwitchRow
			label={label}
			subLabel={subLabel}
			value={value}
			onValueChange={(next: boolean) => {
				settings[setting] = next;
			}}
		/>
	);
}

function IgnoreListRow({ setting }: { setting: IgnoreListKey }) {
	const navigation = Discord.useNavigation();
	const count = idList(useSetting(setting)).size;
	const { title } = IGNORE_LISTS[setting].texts();

	return (
		<ui.Row
			label={title}
			trailing={<Discord.TableRow.TrailingText text={String(count)} />}
			arrow
			onPress={() => openPage(navigation, title, () => <IgnoreListPage setting={setting} />)}
		/>
	);
}

// A custom panel, so each ignore list is a page of users, channels or servers rather than typed ids.
function SettingsPanel() {
	return (
		<ui.Page>
			<ui.Section title={messages.PREFERENCES}>
				<SwitchRow
					setting='redText'
					label={messages.RED_TEXT}
					subLabel={messages.RED_TEXT_SUBTITLE}
				/>
				<SwitchRow
					setting='deletedMarker'
					label={messages.DELETED_MARKER}
					subLabel={messages.DELETED_MARKER_SUBTITLE}
				/>
				<SwitchRow
					setting='inlineEdits'
					label={messages.INLINE_EDITS}
					subLabel={messages.INLINE_EDITS_SUBTITLE}
				/>
				<SwitchRow
					setting='logDeletes'
					label={messages.LOG_DELETES}
					subLabel={messages.LOG_DELETES_SUBTITLE}
				/>
				<SwitchRow
					setting='logEdits'
					label={messages.LOG_EDITS}
					subLabel={messages.LOG_EDITS_SUBTITLE}
				/>
				<SwitchRow
					setting='persistLog'
					label={messages.PERSIST_LOG}
					subLabel={messages.PERSIST_LOG_SUBTITLE}
				/>
				<SwitchRow
					setting='logDeletedAttachments'
					label={messages.LOG_DELETED_ATTACHMENTS}
					subLabel={messages.LOG_DELETED_ATTACHMENTS_SUBTITLE}
				/>
				<SwitchRow
					setting='ignoreBots'
					label={messages.IGNORE_BOTS}
					subLabel={messages.IGNORE_BOTS_SUBTITLE}
				/>
				<SwitchRow
					setting='ignoreSelf'
					label={messages.IGNORE_SELF}
					subLabel={messages.IGNORE_SELF_SUBTITLE}
				/>
			</ui.Section>
			<ui.Section title={messages.IGNORED}>
				<IgnoreListRow setting='ignoreUsers' />
				<IgnoreListRow setting='ignoreChannels' />
				<IgnoreListRow setting='ignoreGuilds' />
			</ui.Section>
			<ui.ResetRow onReset={resetSettings} />
		</ui.Page>
	);
}

export default SettingsPanel;
