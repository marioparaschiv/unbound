import { Discord } from '@unbound-app/api/metro/components';
import { metro, ui } from '@unbound-app/api';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import type { ComponentType, ReactNode } from 'react';
import { Pressable } from 'react-native';

import { editableLabels, formatLabels, moved, parseLabels } from '~/lib/menu-order';

type MenuOption = { label: string; hidden: boolean };

type SortableListProps = {
	data: MenuOption[];
	keyExtractor: (option: MenuOption) => string;
	onRowMoved: (move: { from: number; to: number }) => void;
	renderRow: (option: MenuOption, key: string) => ReactNode;
	disableSorting?: boolean;
	contentContainerStyle?: object;
	ListFooterComponent?: ReactNode;
};

const DRAG_DELAY_MS = 150;

/** The handlers `SortableListView` clones onto each row, as `sortHandlers`, so a long press starts dragging it. */
type SortHandlers = { sortHandlers?: { onLongPress?: () => void; onPressOut?: () => void } };

const SortableList = metro.findByFilePath('components_native/common/SortableListView.tsx', {
	lazy: true,
}) as { default?: ComponentType<SortableListProps> } | undefined;

function setHidden(label: string, shown: boolean) {
	const hidden = new Set(parseLabels(settings.hidden));

	if (shown) hidden.delete(label);
	else hidden.add(label);

	settings.hidden = formatLabels([...hidden]);
}

type OptionRowProps = { label: string; hidden: boolean; start: boolean; end: boolean };

function OptionRow({ label, hidden, start, end, sortHandlers }: OptionRowProps & SortHandlers) {
	// The row has no press of its own, so the wrapper gets the long press that starts a drag; the switch keeps its taps.
	return (
		<Pressable
			onLongPress={sortHandlers?.onLongPress}
			onPressOut={sortHandlers?.onPressOut}
			delayLongPress={DRAG_DELAY_MS}
		>
			<ui.Row
				label={label}
				start={start}
				end={end}
				trailing={
					<Discord.FormSwitch
						value={!hidden}
						onValueChange={(shown: boolean) => setHidden(label, shown)}
					/>
				}
			/>
		</Pressable>
	);
}

function resetOrder() {
	settings.order = '';
	settings.hidden = '';
}

function SettingsPanel() {
	const labels = editableLabels(
		parseLabels(useSetting('order')),
		parseLabels(useSetting('seen')),
	);
	const hidden = new Set(parseLabels(useSetting('hidden')));
	const List = SortableList?.default;

	if (!labels.length) {
		return (
			<ui.Page>
				<ui.Section footer={messages.EMPTY}>{null}</ui.Section>
			</ui.Page>
		);
	}

	const row = (label: string, index: number) => (
		<OptionRow
			key={label}
			label={label}
			hidden={hidden.has(label)}
			start={index === 0}
			end={index === labels.length - 1}
		/>
	);
	const footer = (
		<ui.Section footer={messages.HINT}>
			<ui.Row label={messages.RESET} onPress={resetOrder} />
		</ui.Section>
	);

	// The sortable list is the page's scroller, as in Discord's own use; inside a ScrollView the drag would scroll the page.
	return List ? (
		<List
			// The list caches rows by their items, so each item carries its switch state for a toggle to redraw it.
			data={labels.map((label) => ({ label, hidden: hidden.has(label) }))}
			keyExtractor={(option) => option.label}
			onRowMoved={({ from, to }) => {
				settings.order = formatLabels(moved(labels, from, to));
			}}
			renderRow={(option) => row(option.label, labels.indexOf(option.label))}
			contentContainerStyle={{ padding: 16 }}
			ListFooterComponent={footer}
		/>
	) : (
		<ui.Page>
			<ui.Section title={messages.OPTIONS}>{labels.map(row)}</ui.Section>
			{footer}
		</ui.Page>
	);
}

export default SettingsPanel;
