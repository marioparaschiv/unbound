import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';
import { encodePng } from '@unbound-plugins/shared/media/png';
import { ActivityIndicator, Image, View } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import type { NativeBridge } from '@unbound-app/api/native';
import { format, messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';

import { analyseFlashes, type FlashReport, type TimedFrame } from '~/lib/flashes';
import { readFrames, type Media } from '~/lib/sources';

const BAR_HEIGHT = 48;
const FRAME_HEIGHT = 260;

type Target = { media: Media; bridge: NativeBridge; folder: string };

type FlashSheetProps = Target & { onClose: () => void };

type Result = { frames: TimedFrame[]; report: FlashReport } | { error: true };

function seconds(ms: number): string {
	return (ms / 1000).toFixed(1);
}

function frameUri({ rgba, width, height }: TimedFrame): string {
	return `data:image/png;base64,${toBase64(encodePng(rgba, width, height))}`;
}

function Timeline({ report, index }: { report: FlashReport; index: number }) {
	const step = Math.max(1, Math.ceil(report.brightness.length / 80));
	const bars = report.brightness.filter((_, at) => at % step === 0);

	return (
		<View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_HEIGHT, gap: 1 }}>
			{bars.map((value, at) => (
				<View
					key={at}
					style={{
						flex: 1,
						height: Math.max(2, value * BAR_HEIGHT),
						borderRadius: 1,
						backgroundColor: Math.floor(index / step) === at ? '#5865f2' : '#8a8e99',
					}}
				/>
			))}
		</View>
	);
}

function verdict(report: FlashReport): string {
	if (report.flagged && report.worst) {
		return format('FLAGGED', {
			count: report.worst.flashes,
			start: seconds(report.worst.startMs),
			end: seconds(report.worst.endMs),
		});
	}

	return report.worst ? format('MILD', { count: report.worst.flashes }) : messages.CLEAR;
}

function FlashSheet({ media, bridge, folder }: FlashSheetProps) {
	const [result, setResult] = useState<Result>();
	const [index, setIndex] = useState(0);

	useEffect(() => {
		let live = true;

		readFrames(bridge, media, folder)
			.then((frames) => {
				const report = analyseFlashes(frames);
				const start = report.worst
					? report.times.findIndex((time) => time >= report.worst!.startMs)
					: 0;

				if (!live) return;

				setResult({ frames, report });
				setIndex(Math.max(0, start));
			})
			.catch((error: unknown) => {
				logger.error(`Failed to check ${media.url} for flashing:`, error);

				if (live) setResult({ error: true });
			});

		return () => {
			live = false;
		};
	}, [media.url]);

	if (!result) {
		return (
			<Discord.ActionSheet>
				<View style={{ gap: 12, padding: 16, alignItems: 'center' }}>
					<ActivityIndicator />
					<Discord.Text variant='text-md/medium'>{messages.CHECKING}</Discord.Text>
				</View>
			</Discord.ActionSheet>
		);
	}

	if ('error' in result || !result.frames.length) {
		return (
			<Discord.ActionSheet>
				<View style={{ padding: 16 }}>
					<Discord.Text variant='text-md/medium'>{messages.FAILED}</Discord.Text>
				</View>
			</Discord.ActionSheet>
		);
	}

	const { frames, report } = result;
	const frame = frames[index]!;

	return (
		<Discord.ActionSheet>
			<View style={{ gap: 12, padding: 16 }}>
				<Discord.Text variant='heading-lg/semibold'>{media.name}</Discord.Text>
				<Discord.Text
					variant='text-md/semibold'
					color={report.flagged ? 'text-danger' : 'text-default'}
				>
					{verdict(report)}
				</Discord.Text>
				<Timeline report={report} index={index} />
				<Image
					source={{ uri: frameUri(frame) }}
					resizeMode='contain'
					style={{ width: '100%', height: FRAME_HEIGHT, borderRadius: 8 }}
				/>
				<Discord.Text variant='text-sm/medium' color='text-muted'>
					{format('FRAME', {
						index: index + 1,
						count: frames.length,
						time: seconds(frame.atMs),
					})}
				</Discord.Text>
				<View style={{ flexDirection: 'row', gap: 8 }}>
					<Discord.Button
						text='◀'
						variant='secondary'
						disabled={!index}
						onPress={() => setIndex(index - 1)}
					/>
					<Discord.Button
						text='▶'
						variant='secondary'
						disabled={index >= frames.length - 1}
						onPress={() => setIndex(index + 1)}
					/>
				</View>
			</View>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet that checks a GIF or video for rapid flashing without playing it.
 * @param target The media, the plugin's native bridge and temporary folder.
 */
export function openFlashSheet(target: Target): void {
	openSheet(`unbound-flashing-media-${target.media.url}`, FlashSheet, target);
}

export default FlashSheet;
