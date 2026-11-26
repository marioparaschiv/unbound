import { attachFile } from '@unbound-plugins/shared/composer/attach-file';
import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import type { NativeBridge } from '@unbound-app/api/native';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { toasts, ui } from '@unbound-app/api';
import { Keyboard } from 'react-native';
import { useState } from 'react';

import { openFrameReader, type Crop } from '@unbound-plugins/shared/media/frames/frame-reader';
import { downloadVideo } from '~/lib/video';
import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';
import { makeGif } from '~/lib/make-gif';

import useStyles from '~/components/gif-maker-sheet.style';

/** What the GIF Maker sheet works on: the video, the channel, the native bridge and the temporary folder. */
export type GifMakerProps = {
	url: string;
	channelId: string;
	native: NativeBridge;
	folder: string;
};

type GifMakerSheetProps = GifMakerProps & SheetProps;

const MAX_SECONDS = 15;
const FPS = 10;
const SIZES = { small: 240, medium: 320, large: 480 } as const;

type Size = keyof typeof SIZES;

function isSize(value: string): value is Size {
	return value in SIZES;
}

function isCrop(value: string): value is Crop {
	return value === 'original' || value === 'square';
}

function validSeconds(text: string): string | undefined {
	return Number.isFinite(Number(text)) && Number(text) >= 0 ? undefined : messages.NOT_SECONDS;
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
	const styles = useStyles();
	const [start, setStart] = useState('0');
	const [length, setLength] = useState(3);
	const [size, setSize] = useState<Size>('medium');
	const [crop, setCrop] = useState<Crop>('original');
	const [caption, setCaption] = useState('');
	const [status, setStatus] = useState<string | undefined>();

	async function create() {
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
						length,
						fps: FPS,
						width: SIZES[size],
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

	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader title={messages.TITLE} />
			<ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps='handled'>
				<ui.Section>
					<ui.InputRow
						label={messages.START}
						value={start}
						keyboardType='decimal-pad'
						validate={validSeconds}
						onChange={setStart}
					/>
					<ui.StepperRow
						label={messages.LENGTH}
						value={length}
						minimum={0.5}
						maximum={MAX_SECONDS}
						step={0.5}
						onChange={setLength}
					/>
				</ui.Section>
				<ui.Section>
					<ui.SegmentedRow
						label={messages.SIZE}
						value={size}
						options={[
							{ value: 'small', label: messages.SIZE_SMALL },
							{ value: 'medium', label: messages.SIZE_MEDIUM },
							{ value: 'large', label: messages.SIZE_LARGE },
						]}
						onChange={(value) => isSize(value) && setSize(value)}
					/>
					<ui.SegmentedRow
						label={messages.CROP}
						value={crop}
						options={[
							{ value: 'original', label: messages.CROP_ORIGINAL },
							{ value: 'square', label: messages.CROP_SQUARE },
						]}
						onChange={(value) => isCrop(value) && setCrop(value)}
					/>
					<ui.InputRow
						label={messages.CAPTION}
						placeholder={messages.CAPTION_PLACEHOLDER}
						value={caption}
						onChange={setCaption}
					/>
				</ui.Section>
				{status ? (
					<Discord.Text variant='body-sm/medium' color='text-muted' style={styles.status}>
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
