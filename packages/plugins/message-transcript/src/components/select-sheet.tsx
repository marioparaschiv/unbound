import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { View, type LayoutChangeEvent } from 'react-native';
import { format, messages } from '@unbound-app/i18n';
import { metro, toasts } from '@unbound-app/api';
import { useMemo, useRef, useState } from 'react';

import { formatTranscript, selectRange, spansDays, type TranscriptMessage } from '~/lib/transcript';
import useStyles from '~/components/select-sheet.style';
import { loadedMessages } from '~/lib/messages';

const PREVIEW_CHARACTERS = 80;
const SHOWN_AROUND = 60;
const ANCHOR_INSET = 120;

type Target = { channelId: string; messageId: string };

type SelectSheetProps = Target & { onClose: () => void };

type Scrollable = { scrollTo(options: { y: number; animated: boolean }): void };

function preview({ content, fileNames }: TranscriptMessage): string {
	const text = content.replace(/\s+/g, ' ').trim() || fileNames?.join(', ') || '';

	return text.length > PREVIEW_CHARACTERS ? `${text.slice(0, PREVIEW_CHARACTERS - 1)}…` : text;
}

function around(all: TranscriptMessage[], messageId: string): TranscriptMessage[] {
	const index = all.findIndex(({ id }) => id === messageId);

	return index < 0 ? all : all.slice(Math.max(0, index - SHOWN_AROUND), index + SHOWN_AROUND + 1);
}

function SelectSheet({ channelId, messageId, onClose }: SelectSheetProps) {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const shown = useMemo(
		() => around(loadedMessages(channelId), messageId),
		[channelId, messageId],
	);
	const [endId, setEndId] = useState(messageId);
	const selected = selectRange(shown, messageId, endId);
	const pickedIds = new Set(selected.map(({ id }) => id));
	const list = useRef<Scrollable>(null);
	const anchorY = useRef<number | undefined>(undefined);
	const expanded = useRef(false);

	// The sheet pins its scroll view to the top until it is fully open, so the scroll waits for both.
	function scrollWhenReady() {
		if (!expanded.current || anchorY.current === undefined) return;

		list.current?.scrollTo({ y: anchorY.current, animated: false });
	}

	function scrollToAnchor({ nativeEvent }: LayoutChangeEvent) {
		if (anchorY.current !== undefined) return;

		anchorY.current = Math.max(0, nativeEvent.layout.y - ANCHOR_INSET);
		scrollWhenReady();
	}

	function onExpand() {
		if (expanded.current) return;

		expanded.current = true;
		scrollWhenReady();
	}

	function copy() {
		metro.common.Clipboard.setString(
			formatTranscript(selected, { dates: spansDays(selected) }),
		);
		toasts.success('COPIED', { count: selected.length });
		onClose();
	}

	return (
		<ActionSheet scrollable startExpanded onExpand={onExpand}>
			<BottomSheetTitleHeader title={messages.TITLE} />
			<ScrollView ref={list} contentContainerStyle={styles.body}>
				<Discord.Text variant='body-sm/medium' color='text-muted' style={styles.help}>
					{messages.HELP}
				</Discord.Text>
				{/* Rows sit straight in the scroll content, so the anchor's layout y is its scroll offset. */}
				{shown.map((message, index) => (
					<View
						key={message.id}
						onLayout={message.id === messageId ? scrollToAnchor : undefined}
					>
						<Discord.TableCheckboxRow
							label={message.author}
							subLabel={preview(message)}
							checked={pickedIds.has(message.id)}
							onPress={() => setEndId(message.id)}
							start={index === 0}
							end={index === shown.length - 1}
						/>
					</View>
				))}
			</ScrollView>
			<View style={styles.footer}>
				<Discord.Button
					text={format('COPY', { count: selected.length })}
					disabled={!selected.length}
					onPress={copy}
				/>
			</View>
		</ActionSheet>
	);
}

/**
 * @description Opens the sheet that selects a run of messages from one message and copies them as a transcript.
 * @param target The message the selection starts at, and its channel.
 */
export function openSelectSheet(target: Target): void {
	openSheet(`unbound-message-transcript-${target.messageId}`, SelectSheet, target);
}

export default SelectSheet;
