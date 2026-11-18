import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import {
	composerButtonsFor,
	keptInComposer,
	saveKeptInComposer,
	type ClosePanel,
	type ComposerButton,
} from '@unbound-plugins/shared/composer/composer-stack';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { plugins, ui } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { Fragment, useState } from 'react';
import { View } from 'react-native';

import { pinnedShortcuts, setPinned, type Shortcut } from '~/lib/shortcuts';
import { savePinned, usePinned } from '~/lib/store';
import { availableShortcuts } from '~/lib/available';
import { runShortcut } from '~/lib/run';

const BUTTON_GAP = 16;
const SHEET_CLOSE_MS = 350;

export type ShortcutSheetProps = SheetProps & { channelId: string };

function CommandTile({ shortcut, onPress }: { shortcut: Shortcut; onPress: () => void }) {
	return (
		<Discord.Button
			text={shortcut.label}
			size='sm'
			variant='secondary'
			onPress={onPress}
			grow={false}
		/>
	);
}

function PluginToggles({
	shortcuts,
	onToggle,
}: {
	shortcuts: Shortcut[];
	onToggle: (shortcut: Shortcut) => void;
}) {
	if (!shortcuts.length) return null;

	return (
		<ui.Section>
			{shortcuts.map((shortcut) => (
				<ui.SwitchRow
					key={shortcut.id}
					label={shortcut.label}
					value={shortcut.kind === 'plugin' && plugins.isEnabled(shortcut.pluginId)}
					onValueChange={() => onToggle(shortcut)}
				/>
			))}
		</ui.Section>
	);
}

function panelButtons(channelId: string): ComposerButton[] {
	const kept = keptInComposer();

	return composerButtonsFor(channelId).filter((button) => !kept.includes(button.key ?? ''));
}

function InputButtons({ channelId, closePanel }: { channelId: string; closePanel: ClosePanel }) {
	const buttons = panelButtons(channelId);
	const rows = buttons.filter((button) => button.row);
	const legacy = buttons.filter((button) => !button.row);

	if (!buttons.length) return null;

	return (
		<>
			{rows.length ? (
				<ui.Section title={messages.INPUT_BUTTONS}>
					{rows.map((button, index) => (
						<Fragment key={button.key ?? index}>
							{button.row?.(channelId, closePanel)}
						</Fragment>
					))}
				</ui.Section>
			) : null}
			{legacy.length ? (
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
					{legacy.map(({ key, draw }, index) => (
						<Fragment key={key ?? index}>{draw(BUTTON_GAP)}</Fragment>
					))}
				</View>
			) : null}
		</>
	);
}

function KeepList({ channelId }: { channelId: string }) {
	const buttons = composerButtonsFor(channelId).filter((button) => button.key);
	const kept = keptInComposer();

	if (!buttons.length) return null;

	function keep(key: string, value: boolean) {
		saveKeptInComposer(value ? [...kept, key] : kept.filter((other) => other !== key));
	}

	return (
		<ui.Section title={messages.KEEP_IN_INPUT} description={messages.KEEP_IN_INPUT_HINT}>
			{buttons.map(({ key = '', label }) => (
				<ui.SwitchRow
					key={key}
					label={label?.() ?? key}
					value={kept.includes(key)}
					onValueChange={(value: boolean) => keep(key, value)}
				/>
			))}
		</ui.Section>
	);
}

function PinList({
	title,
	shortcuts,
	pinned,
}: {
	title: string;
	shortcuts: Shortcut[];
	pinned: string[];
}) {
	if (!shortcuts.length) return null;

	return (
		<ui.Section title={title}>
			{shortcuts.map((shortcut) => (
				<ui.SwitchRow
					key={shortcut.id}
					label={shortcut.label}
					value={pinned.includes(shortcut.id)}
					onValueChange={(pin: boolean) =>
						savePinned(setPinned(pinned, shortcut.id, pin))
					}
				/>
			))}
		</ui.Section>
	);
}

/**
 * @description The shortcut panel: the chat input buttons other plugins add as rows that close the panel before they
 * run, pinned plugins as switches, pinned commands as buttons, and an edit mode to pin them and keep buttons in the input.
 * @param props The channel the panel was opened in, and a way to close it.
 * @returns The sheet.
 */
export default function ShortcutSheet({ channelId, onClose }: ShortcutSheetProps) {
	const { ActionSheet } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const pinned = usePinned();
	const [editing, setEditing] = useState(false);
	const [, setToggles] = useState(0);
	const available = availableShortcuts(addon.id);
	const shown = pinnedShortcuts(pinned, available);

	function closePanel(then: () => void) {
		onClose();
		setTimeout(then, SHEET_CLOSE_MS);
	}

	function press(shortcut: Shortcut) {
		if (shortcut.kind === 'command') onClose();

		void runShortcut(shortcut, channelId).then(() => setToggles((count) => count + 1));
	}

	return (
		<ActionSheet scrollable>
			<ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<Discord.Text variant='heading-lg/semibold'>{messages.TITLE}</Discord.Text>
					<Discord.Button
						text={editing ? messages.DONE : messages.EDIT}
						size='sm'
						variant='secondary'
						grow={false}
						onPress={() => setEditing(!editing)}
					/>
				</View>
				{editing ? (
					<>
						<KeepList channelId={channelId} />
						<PinList
							title={messages.PLUGINS}
							shortcuts={available.filter((shortcut) => shortcut.kind === 'plugin')}
							pinned={pinned}
						/>
						<PinList
							title={messages.COMMANDS}
							shortcuts={available.filter((shortcut) => shortcut.kind === 'command')}
							pinned={pinned}
						/>
					</>
				) : shown.length || panelButtons(channelId).length ? (
					<>
						<InputButtons channelId={channelId} closePanel={closePanel} />
						<PluginToggles
							shortcuts={shown.filter((shortcut) => shortcut.kind === 'plugin')}
							onToggle={press}
						/>
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
							{shown
								.filter((shortcut) => shortcut.kind === 'command')
								.map((shortcut) => (
									<CommandTile
										key={shortcut.id}
										shortcut={shortcut}
										onPress={() => press(shortcut)}
									/>
								))}
						</View>
					</>
				) : (
					<Discord.Text variant='text-md/normal' color='text-muted'>
						{messages.EMPTY}
					</Discord.Text>
				)}
			</ScrollView>
		</ActionSheet>
	);
}
