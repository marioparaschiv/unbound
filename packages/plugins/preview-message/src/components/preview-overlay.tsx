import { Animated, KeyboardAvoidingView, Pressable, View } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { useEffect, useRef, useState } from 'react';
import { format, messages } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';

import { Haptics, type PreviewModules } from '~/lib/modules';
import { extractUrls, fetchLinkEmbed, type LinkEmbed } from '~/lib/embeds';
import type { Sticker } from '~/lib/types';
import { MAX_PREVIEW_URLS, MESSAGE_ROW_TYPE, Timing } from '~/lib/constants';
import { createDraftMessage } from '~/lib/draft-message';
import { applyTextReplace } from '~/lib/text-replace';
import useStyles from '~/components/preview-overlay.style';

type PreviewOverlayProps = {
	channelId: string;
	modules: PreviewModules;
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

function MessagePreview({ channelId, modules, content, stickers, embeds }: MessagePreviewProps) {
	const styles = useStyles();
	const { ChatItem, MessageRecord, RowManager } = modules;
	const { default: Row } = ChatItem;

	// Discord's message row can throw on a draft it does not expect, so show the error instead of crashing.
	try {
		const message = createDraftMessage(MessageRecord, { channelId, content, stickers, embeds });
		const rowGenerator = new RowManager.default();

		rowGenerator.generate({ rowType: MESSAGE_ROW_TYPE, message });

		return <Row rowGenerator={rowGenerator} message={message} />;
	} catch (error) {
		return (
			<Discord.Text
				variant='text-sm/normal'
				color='text-feedback-critical'
				style={styles.error}
			>
				{format('PREVIEW_FAILED', { reason: (error as Error)?.message })}
			</Discord.Text>
		);
	}
}

function PreviewOverlay({ content, onClose, ...props }: PreviewOverlayProps) {
	const styles = useStyles();
	const rendered = applyTextReplace(content);
	const embeds = useLinkEmbeds(rendered);
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Haptics?.triggerHapticFeedback?.(Haptics.HapticFeedbackTypes?.IMPACT_MEDIUM);
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
				<View style={styles.card}>
					<Discord.Text
						variant='heading-sm/semibold'
						color='text-strong'
						style={styles.title}
					>
						{messages.MESSAGE_PREVIEW}
					</Discord.Text>
					<MessagePreview {...props} content={rendered} embeds={embeds} />
				</View>
			</KeyboardAvoidingView>
		</Animated.View>
	);
}

export default PreviewOverlay;
