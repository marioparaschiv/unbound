import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { metro, toasts } from '@unbound-app/api';
import { useMemo, useRef, useState } from 'react';

import { formatTranscript, selectRange, spansDays, type TranscriptMessage } from '~/lib/transcript';
import { loadedMessages } from '~/lib/messages';

const PREVIEW_CHARACTERS = 80;
const SHOWN_AROUND = 60;
const LIST_HEIGHT = 380;
const ANCHOR_INSET = 120;

type Target = { channelId: string; messageId: string };

type SelectSheetProps = Target & { onClose: () => void };

type RowProps = {
	message: TranscriptMessage;
	picked: boolean;
	anchor: boolean;
	onPress: () => void;
	onLayout?: (event: LayoutChangeEvent) => void;
};

function preview({ content, attachments }: TranscriptMessage): string {
	const text = content.replace(/\s+/g, ' ').trim() || attachments[0] || '';

	return text.length > PREVIEW_CHARACTERS ? `${text.slice(0, PREVIEW_CHARACTERS - 1)}…` : text;
}

function Row({ message, picked, anchor, onPress, onLayout }: RowProps) {
	return (
		<Pressable
			onPress={onPress}
			onLayout={onLayout}
			style={{
				flexDirection: 'row',
				gap: 10,
				paddingVertical: 8,
				paddingHorizontal: 12,
				borderRadius: 8,
				opacity: picked ? 1 : 0.55,
			}}
		>
			<Discord.Text variant='text-md/semibold' color={anchor ? 'text-link' : 'text-default'}>
				{picked ? '●' : '○'}
			</Discord.Text>
			<View style={{ flex: 1 }}>
				<Discord.Text variant='text-sm/semibold'>{message.author}</Discord.Text>
				<Discord.Text variant='text-sm/normal' color='text-muted'>
					{preview(message)}
				</Discord.Text>
			</View>
		</Pressable>
	);
}

function around(all: TranscriptMessage[], messageId: string): TranscriptMessage[] {
	const index = all.findIndex(({ id }) => id === messageId);

	return index < 0 ? all : all.slice(Math.max(0, index - SHOWN_AROUND), index + SHOWN_AROUND + 1);
}

function SelectSheet({ channelId, messageId, onClose }: SelectSheetProps) {
	const shown = useMemo(
		() => around(loadedMessages(channelId), messageId),
		[channelId, messageId],
	);
	const [endId, setEndId] = useState(messageId);
	const selected = selectRange(shown, messageId, endId);
	const pickedIds = new Set(selected.map(({ id }) => id));
	const list = useRef<ScrollView>(null);
	const scrolled = useRef(false);

	function scrollToAnchor({ nativeEvent }: LayoutChangeEvent) {
		if (scrolled.current) return;

		scrolled.current = true;
		list.current?.scrollTo({
			y: Math.max(0, nativeEvent.layout.y - ANCHOR_INSET),
			animated: false,
		});
	}

	function copy() {
		metro.common.Clipboard.setString(
			formatTranscript(selected, { dates: spansDays(selected) }),
		);
		toasts.success('COPIED', { count: selected.length });
		onClose();
	}

	return (
		<Discord.ActionSheet>
			<View style={{ gap: 12, padding: 16 }}>
				<Discord.Text variant='heading-lg/semibold'>{messages.TITLE}</Discord.Text>
				<Discord.Text variant='text-sm/normal' color='text-muted'>
					{messages.HELP}
				</Discord.Text>
				<ScrollView ref={list} style={{ maxHeight: LIST_HEIGHT }}>
					{shown.map((message) => (
						<Row
							key={message.id}
							message={message}
							picked={pickedIds.has(message.id)}
							anchor={message.id === messageId}
							onPress={() => setEndId(message.id)}
							onLayout={message.id === messageId ? scrollToAnchor : undefined}
						/>
					))}
				</ScrollView>
				<Discord.Button
					text={format('COPY', { count: selected.length })}
					disabled={!selected.length}
					onPress={copy}
				/>
			</View>
		</Discord.ActionSheet>
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
