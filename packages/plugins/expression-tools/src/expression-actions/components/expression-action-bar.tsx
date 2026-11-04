import { messages } from '@unbound-app/i18n';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import {
	getEmojiMarkup,
	getExpressionLink,
	type Expression,
} from '~/expression-actions/expression';
import { copyText, isFavoriteSticker, setFavoriteSticker } from '~/expression-actions/actions';
import { closeExpressionSheet, openCloneSheet } from '~/expression-actions/sheets';
import { notifyError } from '~/expression-actions/notify';

import styles from '~/expression-actions/components/expression-action-bar.style';

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
				label={messages.COPY_URL}
				onPress={() => {
					close();
					copyText(getExpressionLink(expression), messages.URL_COPIED);
				}}
			/>
			{expression.kind === 'emoji' ? (
				<BarButton
					label={messages.COPY_MARKUP}
					onPress={() => {
						close();
						copyText(getEmojiMarkup(expression), messages.MARKUP_COPIED);
					}}
				/>
			) : (
				<BarButton
					label={favorite ? messages.UNFAVORITE : messages.FAVORITE}
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
				label={messages.CLONE}
				onPress={() => {
					close();
					openCloneSheet(expression);
				}}
			/>
		</View>
	);
}

export default ExpressionActionBar;
