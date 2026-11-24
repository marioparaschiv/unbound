import { messages } from '@unbound-app/i18n';
import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { assets } from '@unbound-app/api';
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

type BarRowProps = {
	label: string;
	icon: string;
	onPress: () => void;
	disabled?: boolean;
};

function BarRow({ label, icon, onPress, disabled = false }: BarRowProps) {
	const ActionSheetRow = getActionSheetRow();
	const source = assets.getIdByName(icon);

	return (
		<ActionSheetRow
			label={label}
			icon={source ? <ActionSheetRow.Icon source={source} /> : undefined}
			disabled={disabled}
			onPress={onPress}
		/>
	);
}

function ExpressionActionBar({ expression, sheetKey }: ExpressionActionBarProps) {
	const [favorite, setFavorite] = useState(
		() => expression.kind === 'sticker' && isFavoriteSticker(expression),
	);
	const [updatingFavorite, setUpdatingFavorite] = useState(false);

	const styles = useStyles();
	const ActionSheetRow = getActionSheetRow();

	function close() {
		closeExpressionSheet(expression, sheetKey);
	}

	return (
		<View style={styles.bar}>
			<ActionSheetRow.Group>
				<BarRow
					label={messages.COPY_URL}
					icon='LinkIcon'
					onPress={() => {
						close();
						copyText(getExpressionLink(expression), messages.URL_COPIED);
					}}
				/>
				{expression.kind === 'emoji' ? (
					<BarRow
						label={messages.COPY_MARKUP}
						icon='CopyIcon'
						onPress={() => {
							close();
							copyText(getEmojiMarkup(expression), messages.MARKUP_COPIED);
						}}
					/>
				) : (
					<BarRow
						label={favorite ? messages.UNFAVORITE : messages.FAVORITE}
						icon={favorite ? 'StarIcon' : 'StarOutlineIcon'}
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
				<BarRow
					label={messages.CLONE}
					icon='ServerIcon'
					onPress={() => {
						close();
						openCloneSheet(expression);
					}}
				/>
			</ActionSheetRow.Group>
		</View>
	);
}

export default ExpressionActionBar;
