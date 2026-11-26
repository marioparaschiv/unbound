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

// Each child of a section is one row: the group finds its first and last row by position, so a child that renders
// nothing or several rows breaks the separators. Conditions live in the sections instead.
function HighlightBackgroundRow() {
	const background = useSetting('highlightBackground');

	return (
		<ui.ColorRow
			label={messages.HIGHLIGHT_BACKGROUND}
			color={background || undefined}
			fallbackColor='#f23f4326'
			fallbackLabel={messages.HIGHLIGHT_BACKGROUND_FALLBACK}
			onChange={(value) => {
				settings.highlightBackground = value ?? '';
			}}
		/>
	);
}

function HighlightBarRow() {
	const bar = useSetting('highlightBar');

	return (
		<ui.ColorRow
			label={messages.HIGHLIGHT_BAR}
			color={bar || undefined}
			fallbackColor='#f23f43'
			fallbackLabel={messages.HIGHLIGHT_BAR_FALLBACK}
			onChange={(value) => {
				settings.highlightBar = value ?? '';
			}}
		/>
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

// What gets logged comes first; each kind's look follows only while that kind is logged.
function LoggingSection() {
	const logEdits = useSetting('logEdits');
	const logDeletedChannels = useSetting('logDeletedChannels');

	return (
		<ui.Section title={messages.LOGGING}>
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
			{logEdits ? (
				<SwitchRow
					setting='logDeletedAttachments'
					label={messages.LOG_DELETED_ATTACHMENTS}
					subLabel={messages.LOG_DELETED_ATTACHMENTS_SUBTITLE}
				/>
			) : null}
			<SwitchRow
				setting='logDeletedChannels'
				label={messages.LOG_DELETED_CHANNELS}
				subLabel={messages.LOG_DELETED_CHANNELS_SUBTITLE}
			/>
			{logDeletedChannels ? <DeletedChannelsRow /> : null}
			<SwitchRow
				setting='persistLog'
				label={messages.PERSIST_LOG}
				subLabel={messages.PERSIST_LOG_SUBTITLE}
			/>
		</ui.Section>
	);
}

function DeletedMessagesSection() {
	const highlight = useSetting('deletedHighlight');

	if (!useSetting('logDeletes')) return null;

	return (
		<ui.Section title={messages.DELETED_MESSAGES}>
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
				setting='deletedHighlight'
				label={messages.DELETED_HIGHLIGHT}
				subLabel={messages.DELETED_HIGHLIGHT_SUBTITLE}
			/>
			{highlight ? <HighlightBackgroundRow /> : null}
			{highlight ? <HighlightBarRow /> : null}
		</ui.Section>
	);
}

function EditedMessagesSection() {
	const inlineEdits = useSetting('inlineEdits');

	if (!useSetting('logEdits')) return null;

	return (
		<ui.Section title={messages.EDITED_MESSAGES}>
			<SwitchRow
				setting='inlineEdits'
				label={messages.INLINE_EDITS}
				subLabel={messages.INLINE_EDITS_SUBTITLE}
			/>
			{inlineEdits ? <EditedTextRow /> : null}
		</ui.Section>
	);
}

function IgnoredSection() {
	return (
		<ui.Section title={messages.IGNORED}>
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
			<IgnoreListRow setting='ignoreUsers' />
			<IgnoreListRow setting='ignoreChannels' />
			<IgnoreListRow setting='ignoreGuilds' />
		</ui.Section>
	);
}

// A custom panel, so each ignore list is a page of users, channels or servers rather than typed ids.
function SettingsPanel() {
	return (
		<ui.Page>
			<LoggingSection />
			<DeletedMessagesSection />
			<EditedMessagesSection />
			<IgnoredSection />
			<ui.ResetRow onReset={resetSettings} />
		</ui.Page>
	);
}

export default SettingsPanel;
