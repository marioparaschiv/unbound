import type { ReactElement } from 'react';

import { Discord, isRenderable } from '~/metro/components';
import { reload } from '~/native/runtime';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import useStyles from './restart-row.style';

/**
 * @description Discord's `InlineNotice` saying a change applies after Discord restarts, with a button that restarts
 * it now; on builds without one, a card holding the same text and button.
 * @returns The notice.
 */
function RestartRow(): ReactElement {
	const styles = useStyles();
	const action = { text: messages.UNBOUND_RESTART, onPress: () => void reload() };

	if (isRenderable(Discord.InlineNotice)) {
		return (
			<Discord.InlineNotice
				type='info'
				message={messages.UNBOUND_SETTING_RESTART_HINT}
				action={action}
			/>
		);
	}

	return (
		<Discord.Card variant='primary' border='subtle' style={styles.card}>
			<Discord.Stack direction='vertical' spacing={12}>
				<Discord.Stack direction='horizontal' spacing={12} align='center'>
					<Discord.TableRowIcon source={icons.RetryIcon} />
					<Discord.Text variant='text-md/medium' style={styles.label}>
						{messages.UNBOUND_SETTING_RESTART_HINT}
					</Discord.Text>
				</Discord.Stack>
				<Discord.Button
					grow
					variant='primary'
					text={messages.UNBOUND_RESTART}
					onPress={action.onPress}
				/>
			</Discord.Stack>
		</Discord.Card>
	);
}

export default RestartRow;
