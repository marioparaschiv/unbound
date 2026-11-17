import { useComposerRow } from '@unbound-plugins/shared/composer/overlay-rows';
import { flux, metro } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { createSpeedTracker, recordSpeed } from '~/lib/speed';

export type ChatInputs = {
	// UNKNOWN: Discord's input handle is untyped; only its `getText` is read.
	getBestActiveInputForChannelId: (channelId: string) => { getText?: () => unknown } | undefined;
};

type SpeedPillProps = { channelId: string; inputs: ChatInputs; live: boolean };

const ChannelStore = flux.getStore('Channel');
const PILL_HEIGHT = 20;
const POLL_MS = 200;

function draftLength(inputs: ChatInputs, channelId: string): number {
	const text = inputs.getBestActiveInputForChannelId(channelId)?.getText?.();

	return typeof text === 'string' ? text.trim().length : 0;
}

function useTypingSpeed(inputs: ChatInputs, channelId: string): number | undefined {
	const tracker = useRef(createSpeedTracker());
	const [wpm, setWpm] = useState<number | undefined>(undefined);

	useEffect(() => {
		let previous = 0;
		const timer = setInterval(() => {
			const length = draftLength(inputs, channelId);

			if (length === 0 && previous > 0) {
				const finished = tracker.current.finish();

				if (finished) {
					const stats = recordSpeed(settings, finished);

					settings.messages = stats.messages;
					settings.totalWpm = stats.totalWpm;
					settings.bestWpm = stats.bestWpm;
				}
			}

			previous = length;
			setWpm(tracker.current.update({ length, at: Date.now() }));
		}, POLL_MS);

		return () => clearInterval(timer);
	}, [inputs, channelId]);

	return wpm;
}

/**
 * @description Measures the typing in a channel's message box, recording each sent message's speed, and shows the live
 * speed as a pill above the box when that setting is on.
 * @param props The channel, Discord's message box inputs, and whether to draw the pill.
 * @returns The pill, or nothing while there is no speed yet.
 */
export function SpeedPill({ channelId, inputs, live }: SpeedPillProps) {
	const wpm = useTypingSpeed(inputs, channelId);
	const shown = live && wpm !== undefined;
	const top = useComposerRow({
		channel: ChannelStore.getChannel(channelId),
		channelId,
		id: 'typing-speed',
		order: 1,
		height: PILL_HEIGHT,
		shown,
	});

	if (!shown) return null;

	const colors = metro.common.Theme.colors ?? {};

	return (
		<View pointerEvents='none' style={{ position: 'absolute', top, left: 12, zIndex: 10 }}>
			<View
				style={{
					alignItems: 'center',
					backgroundColor: 'rgba(0, 0, 0, 0.35)',
					borderRadius: 999,
					height: PILL_HEIGHT,
					justifyContent: 'center',
					paddingHorizontal: 7,
				}}
			>
				<Text
					style={{
						color:
							typeof colors.TEXT_NORMAL === 'string' ? colors.TEXT_NORMAL : '#f2f3f5',
						fontSize: 11,
						fontVariant: ['tabular-nums'],
						fontWeight: '600',
						lineHeight: 14,
					}}
				>
					{format('WPM', { wpm })}
				</Text>
			</View>
		</View>
	);
}
