import { messages } from '@unbound-app/i18n';
import { Discord } from '@unbound-app/api/metro/components';
import { View } from 'react-native';
import { useState } from 'react';

import { getEmojiMarkup, getExpressionLink, type Expression } from '~/lib/expression';
import { copyText, isFavoriteSticker, setFavoriteSticker } from '~/lib/actions';
import { closeExpressionSheet, openCloneSheet } from '~/lib/sheets';
import { notifyError } from '~/lib/notify';

import useStyles from '~/components/expression-action-bar.style';

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
	const styles = useStyles();

	return (
		<View style={styles.button}>
			<Discord.Button
				text={label}
				variant='secondary'
				size='sm'
				disabled={disabled}
				onPress={onPress}
			/>
		</View>
	);
}

function ExpressionActionBar({ expression, sheetKey }: ExpressionActionBarProps) {
	const [favorite, setFavorite] = useState(
		() => expression.kind === 'sticker' && isFavoriteSticker(expression),
	);
	const [updatingFavorite, setUpdatingFavorite] = useState(false);

	const styles = useStyles();

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
