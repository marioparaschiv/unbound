import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';

import type { FontAttachment } from '~/lib/font-file';
import type { FontHost } from '~/native/fonts';
import { loadFont, type LoadedFont } from '~/lib/load-font';

const SIZES = [16, 28, 44];

type Context = { host: FontHost; folder: string };

type FontSheetProps = Context & { fonts: FontAttachment[]; onClose: () => void };

type PreviewProps = Context & { font: FontAttachment; sample: string };

function problemText(problem: Exclude<LoadedFont, { family: string }>['problem']): string {
	switch (problem) {
		case 'woff2':
			return messages.WOFF2_UNSUPPORTED;
		case 'unknown':
			return messages.NOT_A_FONT;
		default:
			return messages.LOAD_FAILED;
	}
}

function FontPreview({ font, sample, host, folder }: PreviewProps) {
	const [loaded, setLoaded] = useState<LoadedFont>();

	useEffect(() => {
		let live = true;

		void loadFont(host, font, folder).then((result) => live && setLoaded(result));

		return () => {
			live = false;
		};
	}, [font.url]);

	return (
		<View style={{ gap: 8 }}>
			<Discord.Text variant='text-sm/semibold' color='text-muted'>
				{font.filename}
			</Discord.Text>
			{!loaded ? <ActivityIndicator /> : null}
			{loaded && 'problem' in loaded ? (
				<Discord.Text variant='text-md/medium'>{problemText(loaded.problem)}</Discord.Text>
			) : null}
			{loaded && 'family' in loaded
				? SIZES.map((size) => (
						<Discord.Text
							key={size}
							variant='text-md/normal'
							style={{
								fontFamily: loaded.family,
								fontSize: size,
								lineHeight: size * 1.3,
							}}
						>
							{sample}
						</Discord.Text>
					))
				: null}
		</View>
	);
}

function FontSheet({ fonts, host, folder }: FontSheetProps) {
	const [sample, setSample] = useState<string>(messages.SAMPLE);

	return (
		<Discord.ActionSheet>
			<ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
				<Discord.Text variant='heading-lg/semibold'>{messages.TITLE}</Discord.Text>
				<Discord.TextInput
					description={messages.SAMPLE_HELP}
					autoCorrect={false}
					value={sample}
					onChange={setSample}
				/>
				{fonts.map((font) => (
					<FontPreview
						key={font.url}
						font={font}
						sample={sample || messages.SAMPLE}
						host={host}
						folder={folder}
					/>
				))}
			</ScrollView>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet that previews a message's font attachments with sample text.
 * @param messageId The message, which keys the sheet.
 * @param fonts The font attachments.
 * @param context The platform's font loader and the plugin's temporary folder.
 */
export function openFontSheet(messageId: string, fonts: FontAttachment[], context: Context): void {
	openSheet(`unbound-font-preview-${messageId}`, FontSheet, { fonts, ...context });
}

export default FontSheet;
