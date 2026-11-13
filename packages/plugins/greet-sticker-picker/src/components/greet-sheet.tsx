import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { createElement } from 'react';
import { Pressable, View } from 'react-native';

import type { GreetSticker } from '~/lib/stickers';

import styles from '~/components/greet-sheet.style';

const SHEET_KEY = 'unbound-greet-sticker-picker';
const STICKER_SIZE = 72;

type GreetSheetProps = {
	stickers: GreetSticker[];
	onPick: (sticker: GreetSticker) => void;
};

function GreetSheet({ stickers, onPick }: GreetSheetProps) {
	const Sticker = metro.findByFilePath('modules/stickers/native/Sticker.tsx')?.default;

	return (
		<Discord.ActionSheet>
			<View style={styles.content}>
				<Discord.Text variant='heading-md/semibold'>{messages.TITLE}</Discord.Text>
				<View style={styles.grid}>
					{stickers.map((sticker) => (
						<Pressable
							key={sticker.id}
							accessibilityRole='button'
							accessibilityLabel={sticker.description ?? sticker.name}
							onPress={() => onPick(sticker)}
							style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
						>
							{Sticker
								? createElement(Sticker, {
										sticker,
										size: STICKER_SIZE,
										animated: true,
									})
								: null}
							<Discord.Text variant='text-xs/medium' color='text-muted'>
								{sticker.name}
							</Discord.Text>
						</Pressable>
					))}
				</View>
			</View>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens a sheet of greet stickers and sends the one picked.
 * @param stickers The stickers to offer.
 * @param onPick Sends the picked sticker.
 */
export function openGreetSheet(
	stickers: GreetSticker[],
	onPick: (sticker: GreetSticker) => void,
): void {
	const sheets = metro.api.ActionSheets;

	sheets.openLazy(
		Promise.resolve({
			default: () => (
				<GreetSheet
					stickers={stickers}
					onPick={(sticker) => {
						sheets.hideActionSheet(SHEET_KEY);
						onPick(sticker);
					}}
				/>
			),
		}),
		SHEET_KEY,
	);
}
