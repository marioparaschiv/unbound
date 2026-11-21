import EntityListRow from '@unbound-plugins/shared/entities/entity-list-row';
import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import { resetSettings, settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import DeletedChannels, { useDeletedChannels } from '~/components/deleted-channels';
import IgnoreList, { IGNORE_LISTS, type IgnoreListKey } from '~/components/ignore-list';

type SwitchKey =
	| 'redText'
	| 'deletedHighlight'
	| 'deletedMarker'
	| 'inlineEdits'
	| 'logDeletes'
	| 'logEdits'
	| 'persistLog'
	| 'logDeletedAttachments'
	| 'logDeletedChannels'
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

function HighlightRows() {
	const enabled = useSetting('deletedHighlight');
	const background = useSetting('highlightBackground');
	const bar = useSetting('highlightBar');

	if (!enabled) return null;

	return (
		<>
			<ui.ColorRow
				label={messages.HIGHLIGHT_BACKGROUND}
				color={background || undefined}
				fallbackColor='#f23f4326'
				fallbackLabel={messages.HIGHLIGHT_BACKGROUND_FALLBACK}
				onChange={(value) => {
					settings.highlightBackground = value ?? '';
				}}
			/>
			<ui.ColorRow
				label={messages.HIGHLIGHT_BAR}
				color={bar || undefined}
				fallbackColor='#f23f43'
				fallbackLabel={messages.HIGHLIGHT_BAR_FALLBACK}
				onChange={(value) => {
					settings.highlightBar = value ?? '';
				}}
			/>
		</>
	);
}

function EditedTextRow() {
	const value = useSetting('editedText');

	return (
		<ui.InputRow
			label={messages.EDITED_TEXT}
			subLabel={messages.EDITED_TEXT_SUBTITLE}
			value={value}
			placeholder={messages.EDITED_SUFFIX.trim()}
			onChange={(next: string) => {
				settings.editedText = next;
			}}
		/>
	);
}

function IgnoreListRow({ setting }: { setting: IgnoreListKey }) {
	const count = parseIdList(useSetting(setting)).length;
	const { title } = IGNORE_LISTS[setting].texts();

	return (
		<EntityListRow
			label={title}
			count={count}
			renderList={() => <IgnoreList setting={setting} />}
		/>
	);
}

function DeletedChannelsRow() {
	const channels = useDeletedChannels();

	return (
		<EntityListRow
			label={messages.DELETED_CHANNELS}
			count={channels.length}
			renderList={() => <DeletedChannels />}
		/>
	);
}

type SwitchSpec = [SwitchKey, string, string];

function SwitchRows({ rows }: { rows: SwitchSpec[] }) {
	return rows.map(([setting, label, subLabel]) => (
		<SwitchRow key={setting} setting={setting} label={label} subLabel={subLabel} />
	));
}

// A custom panel, so each ignore list is a page of users, channels or servers rather than typed ids.
function SettingsPanel() {
	return (
		<ui.Page>
			<ui.Section title={messages.PREFERENCES}>
				<SwitchRows
					rows={[
						['redText', messages.RED_TEXT, messages.RED_TEXT_SUBTITLE],
						[
							'deletedHighlight',
							messages.DELETED_HIGHLIGHT,
							messages.DELETED_HIGHLIGHT_SUBTITLE,
						],
					]}
				/>
				<HighlightRows />
				<SwitchRows
					rows={[
						[
							'deletedMarker',
							messages.DELETED_MARKER,
							messages.DELETED_MARKER_SUBTITLE,
						],
						['inlineEdits', messages.INLINE_EDITS, messages.INLINE_EDITS_SUBTITLE],
					]}
				/>
				<EditedTextRow />
				<SwitchRows
					rows={[
						['logDeletes', messages.LOG_DELETES, messages.LOG_DELETES_SUBTITLE],
						['logEdits', messages.LOG_EDITS, messages.LOG_EDITS_SUBTITLE],
						['persistLog', messages.PERSIST_LOG, messages.PERSIST_LOG_SUBTITLE],
						[
							'logDeletedAttachments',
							messages.LOG_DELETED_ATTACHMENTS,
							messages.LOG_DELETED_ATTACHMENTS_SUBTITLE,
						],
						[
							'logDeletedChannels',
							messages.LOG_DELETED_CHANNELS,
							messages.LOG_DELETED_CHANNELS_SUBTITLE,
						],
						['ignoreBots', messages.IGNORE_BOTS, messages.IGNORE_BOTS_SUBTITLE],
						['ignoreSelf', messages.IGNORE_SELF, messages.IGNORE_SELF_SUBTITLE],
					]}
				/>
			</ui.Section>
			<ui.Section title={messages.DELETED_CHANNELS}>
				<DeletedChannelsRow />
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
