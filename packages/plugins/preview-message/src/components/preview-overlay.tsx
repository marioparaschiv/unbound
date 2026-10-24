import { Animated, KeyboardAvoidingView, Pressable, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { metro } from '@unbound-app/api';

import { extractUrls, fetchLinkEmbed, type LinkEmbed } from '~/embeds';
import { ChatItem, Haptics, RowManager, type Sticker } from '~/modules';
import { MAX_PREVIEW_URLS, MESSAGE_ROW_TYPE, Timing } from '~/constants';
import { createDraftMessage } from '~/draft-message';
import { applyTextReplace } from '~/text-replace';

type PreviewOverlayProps = {
	channelId: string;
	content: string;
	stickers: Sticker[];
	onClose: () => void;
};

type MessagePreviewProps = Omit<PreviewOverlayProps, 'onClose'> & {
	embeds: LinkEmbed[];
};

function useLinkEmbeds(content: string): LinkEmbed[] {
	const [embeds, setEmbeds] = useState<LinkEmbed[]>([]);

	useEffect(() => {
		let active = true;
		const urls = extractUrls(content).slice(0, MAX_PREVIEW_URLS);

		setEmbeds([]);

		if (!urls.length) return;

		void Promise.all(urls.map((url) => fetchLinkEmbed(url, metro.common.REST))).then(
			(resolved) => {
				if (active) {
					setEmbeds(resolved.filter((embed) => embed !== null));
				}
			},
		);

		return () => {
			active = false;
		};
	}, [content]);

	return embeds;
}

function MessagePreview({ channelId, content, stickers, embeds }: MessagePreviewProps) {
	const { default: Row } = ChatItem;

	// Discord's message row can throw on a draft it does not expect, so show the error instead of crashing.
	try {
		const message = createDraftMessage({ channelId, content, stickers, embeds });
		const rowGenerator = new RowManager.default();

		rowGenerator.generate({ rowType: MESSAGE_ROW_TYPE, message });

		return <Row rowGenerator={rowGenerator} message={message} />;
	} catch (error) {
		return (
			<Text style={{ color: '#ff7b72', paddingHorizontal: 14 }}>
				{`Preview failed: ${(error as Error)?.message}`}
			</Text>
		);
	}
}

function PreviewOverlay({ content, onClose, ...props }: PreviewOverlayProps) {
	const rendered = applyTextReplace(content);
	const embeds = useLinkEmbeds(rendered);
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Haptics.triggerHapticFeedback?.(Haptics.HapticFeedbackTypes?.IMPACT_MEDIUM);
		Animated.timing(opacity, {
			toValue: 1,
			duration: Timing.fadeIn,
			useNativeDriver: true,
		}).start();
	}, [opacity]);

	function dismiss() {
		Animated.timing(opacity, {
			toValue: 0,
			duration: Timing.fadeOut,
			useNativeDriver: true,
		}).start(onClose);
	}

	return (
		<Animated.View
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0,0,0,0.65)',
				justifyContent: 'center',
				padding: 18,
				opacity,
			}}
		>
			<Pressable
				onPress={dismiss}
				style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
			/>
			<KeyboardAvoidingView
				behavior='padding'
				keyboardVerticalOffset={0}
				style={{ flex: 1, justifyContent: 'center' }}
			>
				<View
					style={{
						backgroundColor: '#2b2d31',
						borderRadius: 14,
						paddingVertical: 12,
						maxHeight: '70%',
					}}
				>
					<Text
						style={{
							color: '#f2f3f5',
							fontWeight: '600',
							paddingHorizontal: 14,
							paddingBottom: 10,
						}}
					>
						Message Preview
					</Text>
					<MessagePreview {...props} content={rendered} embeds={embeds} />
				</View>
			</KeyboardAvoidingView>
		</Animated.View>
	);
}

export default PreviewOverlay;
