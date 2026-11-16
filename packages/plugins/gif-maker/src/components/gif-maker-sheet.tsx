import { attachFile } from '@unbound-plugins/shared/composer/attach-file';
import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import type { NativeBridge } from '@unbound-app/api/native';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';
import { Keyboard, View } from 'react-native';
import { useState } from 'react';

import { openFrameReader, type Crop } from '~/native/frames';
import { downloadVideo } from '~/lib/video';
import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';
import { makeGif } from '~/lib/make-gif';

/** What the GIF Maker sheet works on: the video, the channel, the native bridge and the temporary folder. */
export type GifMakerProps = {
	url: string;
	channelId: string;
	native: NativeBridge;
	folder: string;
};

type GifMakerSheetProps = GifMakerProps & SheetProps;

type Choice<T> = { value: T; label: () => string };

const MAX_SECONDS = 15;
const FPS = 10;
const SIZES: Choice<number>[] = [
	{ value: 240, label: () => messages.SIZE_SMALL },
	{ value: 320, label: () => messages.SIZE_MEDIUM },
	{ value: 480, label: () => messages.SIZE_LARGE },
];
const CROPS: Choice<Crop>[] = [
	{ value: 'original', label: () => messages.CROP_ORIGINAL },
	{ value: 'square', label: () => messages.CROP_SQUARE },
];

function Choices<T>({
	options,
	value,
	onChange,
}: {
	options: Choice<T>[];
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<View style={{ flexDirection: 'row', gap: 8 }}>
			{options.map((option) => (
				<View key={String(option.value)} style={{ flex: 1 }}>
					<Discord.Button
						text={option.label()}
						size='sm'
						variant={option.value === value ? 'primary' : 'secondary'}
						onPress={() => onChange(option.value)}
					/>
				</View>
			))}
		</View>
	);
}

function Label({ children }: { children: string }) {
	return (
		<Discord.Text variant='text-sm/semibold' color='text-muted'>
			{children}
		</Discord.Text>
	);
}

/**
 * @description Asks which part of a video to turn into a GIF and how to shape it, then makes the GIF and attaches it
 * to the channel's message, showing its progress.
 * @param props The video, the channel, the native bridge and temporary folder, and a way to close the sheet.
 * @returns The sheet.
 */
export default function GifMakerSheet({
	url,
	channelId,
	native,
	folder,
	onClose,
}: GifMakerSheetProps) {
	const [start, setStart] = useState('0');
	const [length, setLength] = useState('3');
	const [width, setWidth] = useState(320);
	const [crop, setCrop] = useState<Crop>('original');
	const [caption, setCaption] = useState('');
	const [status, setStatus] = useState<string | undefined>();

	async function create() {
		const seconds = Math.max(0.1, Number(length) || 3);

		if (seconds > MAX_SECONDS) {
			toasts.warning('TOO_LONG', { seconds: MAX_SECONDS });

			return;
		}

		Keyboard.dismiss();

		try {
			setStatus(messages.DOWNLOADING);

			const reader = openFrameReader(native, await downloadVideo(url, folder));

			if (!reader) throw new Error('the video could not be opened');

			try {
				const gif = await makeGif(
					reader,
					{
						start: Number(start) || 0,
						length: seconds,
						fps: FPS,
						width,
						crop,
						caption: caption.trim(),
					},
					(done, total) =>
						setStatus(
							done === total ? messages.ENCODING : format('FRAMES', { done, total }),
						),
				);

				if (!gif) throw new Error('no frames could be read');

				await attachFile(channelId, toBase64(gif.bytes), {
					folder,
					filename: 'clip.gif',
					mimeType: 'image/gif',
					encoding: 'base64',
					size: { width: gif.width, height: gif.height },
				});
				toasts.success('ATTACHED');
				onClose();
			} finally {
				reader.close();
			}
		} catch (error) {
			logger.error(`Failed to make a GIF from ${url}:`, error);
			toasts.error('FAILED', error);
			setStatus(undefined);
		}
	}

	const { ActionSheet } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;

	return (
		<ActionSheet scrollable>
			<ScrollView
				contentContainerStyle={{ padding: 16, gap: 12 }}
				keyboardShouldPersistTaps='handled'
			>
				<Discord.Text variant='heading-lg/semibold'>{messages.TITLE}</Discord.Text>
				<View style={{ flexDirection: 'row', gap: 8 }}>
					<View style={{ flex: 1, gap: 4 }}>
						<Label>{messages.START}</Label>
						<Discord.TextField
							size='md'
							value={start}
							onChange={setStart}
							keyboardType='decimal-pad'
							isRound
						/>
					</View>
					<View style={{ flex: 1, gap: 4 }}>
						<Label>{messages.LENGTH}</Label>
						<Discord.TextField
							size='md'
							value={length}
							onChange={setLength}
							keyboardType='decimal-pad'
							isRound
						/>
					</View>
				</View>
				<Label>{messages.SIZE}</Label>
				<Choices options={SIZES} value={width} onChange={setWidth} />
				<Label>{messages.CROP}</Label>
				<Choices options={CROPS} value={crop} onChange={setCrop} />
				<Label>{messages.CAPTION}</Label>
				<Discord.TextField
					size='md'
					value={caption}
					onChange={setCaption}
					placeholder={messages.CAPTION_PLACEHOLDER}
					isClearable
					isRound
				/>
				{status ? (
					<Discord.Text variant='text-sm/medium' color='text-muted'>
						{status}
					</Discord.Text>
				) : null}
				<Discord.Button
					text={messages.CREATE}
					disabled={Boolean(status)}
					onPress={() => void create()}
				/>
			</ScrollView>
		</ActionSheet>
	);
}
