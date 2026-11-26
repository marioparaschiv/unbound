import { openSheet, type SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { createElement } from 'react';
import { Pressable, View } from 'react-native';

import type { GreetSticker } from '~/lib/stickers';

import useStyles from '~/components/greet-sheet.style';

const STICKER_SIZE = 72;

type GreetSheetProps = SheetProps & {
	stickers: GreetSticker[];
	onPick: (sticker: GreetSticker) => void;
};

function GreetSheet({ stickers, onPick, onClose }: GreetSheetProps) {
	const styles = useStyles();
	const Sticker = metro.findByFilePath('modules/stickers/native/Sticker.tsx')?.default;

	return (
		<Discord.ActionSheet>
			<Discord.BottomSheetTitleHeader title={messages.TITLE} />
			<View style={styles.content}>
				<View style={styles.grid}>
					{stickers.map((sticker) => (
						<Pressable
							key={sticker.id}
							accessibilityRole='button'
							accessibilityLabel={sticker.description ?? sticker.name}
							onPress={() => {
								onClose();
								onPick(sticker);
							}}
							style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
						>
							{Sticker
								? createElement(Sticker, {
										sticker,
										size: STICKER_SIZE,
										animated: true,
									})
								: null}
							<Discord.Text variant='body-xs/medium' color='text-muted'>
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
	openSheet('unbound-greet-sticker-picker', GreetSheet, { stickers, onPick });
}
