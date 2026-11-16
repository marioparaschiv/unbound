import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { plugins, ui } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useState } from 'react';
import { View } from 'react-native';

import { pinnedShortcuts, setPinned, type Shortcut } from '~/lib/shortcuts';
import { savePinned, usePinned } from '~/lib/store';
import { availableShortcuts } from '~/lib/available';
import { runShortcut } from '~/lib/run';

export type ShortcutSheetProps = SheetProps & { channelId: string };

function Tile({ shortcut, onPress }: { shortcut: Shortcut; onPress: () => void }) {
	const active = shortcut.kind === 'plugin' && plugins.isEnabled(shortcut.pluginId);

	return (
		<Discord.Button
			text={shortcut.label}
			size='sm'
			variant={shortcut.kind === 'command' ? 'secondary' : active ? 'primary' : 'tertiary'}
			onPress={onPress}
			grow={false}
		/>
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
 * @description The shortcut panel: pinned plugin toggles and commands as compact buttons, and an edit mode listing
 * every plugin and option-free command to pin or unpin.
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
				) : shown.length ? (
					<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
						{shown.map((shortcut) => (
							<Tile
								key={shortcut.id}
								shortcut={shortcut}
								onPress={() => press(shortcut)}
							/>
						))}
					</View>
				) : (
					<Discord.Text variant='text-md/normal' color='text-muted'>
						{messages.EMPTY}
					</Discord.Text>
				)}
			</ScrollView>
		</ActionSheet>
	);
}
