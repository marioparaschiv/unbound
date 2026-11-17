import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { composerButtonsFor } from '@unbound-plugins/shared/composer/composer-stack';
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

function InputButtons({ channelId }: { channelId: string }) {
	const buttons = composerButtonsFor(channelId);

	if (!buttons.length) return null;

	return (
		<View style={{ gap: 8 }}>
			<Discord.Text variant='text-sm/semibold' color='text-muted'>
				{messages.INPUT_BUTTONS}
			</Discord.Text>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
				{buttons.map(({ key, draw }, index) => (
					<Fragment key={key ?? index}>{draw(BUTTON_GAP)}</Fragment>
				))}
			</View>
		</View>
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
 * @description The shortcut panel: the chat input buttons other plugins add, pinned plugins as switches and pinned
 * commands as compact buttons, and an edit mode listing every plugin and option-free command to pin or unpin.
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
				) : shown.length || composerButtonsFor(channelId).length ? (
					<>
						<InputButtons channelId={channelId} />
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
