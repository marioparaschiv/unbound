import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { getEmojiMarkup, getExpressionLink, type Expression } from '~/expression';
import { copyText, isFavoriteSticker, setFavoriteSticker } from '~/actions';
import { closeExpressionSheet, openCloneSheet } from '~/sheets';
import { notifyError } from '~/notify';

import styles from './expression-action-bar.style';

type ExpressionActionBarProps = {
	expression: Expression;
	sheetKey: string;
};

type BarButtonProps = {
	label: string;
	onPress: () => void;
	disabled?: boolean;
};

function BarButton({ label, onPress, disabled = false }: BarButtonProps) {
	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				pressed && styles.pressed,
				disabled && styles.disabled,
			]}
		>
			<Text numberOfLines={1} style={styles.label}>
				{label}
			</Text>
		</Pressable>
	);
}

function ExpressionActionBar({ expression, sheetKey }: ExpressionActionBarProps) {
	const [favorite, setFavorite] = useState(
		() => expression.kind === 'sticker' && isFavoriteSticker(expression),
	);
	const [updatingFavorite, setUpdatingFavorite] = useState(false);

	function close() {
		closeExpressionSheet(expression, sheetKey);
	}

	return (
		<View style={styles.bar}>
			<BarButton
				label='Copy URL'
				onPress={() => {
					close();
					copyText(getExpressionLink(expression), 'URL copied to the clipboard.');
				}}
			/>
			{expression.kind === 'emoji' ? (
				<BarButton
					label='Copy markup'
					onPress={() => {
						close();
						copyText(
							getEmojiMarkup(expression),
							'Emoji markup copied to the clipboard.',
						);
					}}
				/>
			) : (
				<BarButton
					label={favorite ? 'Unfavorite' : 'Favorite'}
					disabled={updatingFavorite}
					onPress={() => {
						if (updatingFavorite) return;

						close();
						setUpdatingFavorite(true);
						void setFavoriteSticker(expression, !favorite)
							.then(() => setFavorite((value) => !value))
							.catch(notifyError)
							.finally(() => setUpdatingFavorite(false));
					}}
				/>
			)}
			<BarButton
				label='Clone'
				onPress={() => {
					close();
					openCloneSheet(expression);
				}}
			/>
		</View>
	);
}

export default ExpressionActionBar;
