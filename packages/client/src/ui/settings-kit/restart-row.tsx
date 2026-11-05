import type { ReactElement } from 'react';

import { Discord } from '~/metro/components';
import { reload } from '~/native/runtime';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import useStyles from './restart-row.style';

/**
 * @description A card saying a change applies after Discord restarts, with a full-width button that restarts it now.
 * @returns The card.
 */
function RestartRow(): ReactElement {
	const styles = useStyles();

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
					onPress={() => void reload()}
				/>
			</Discord.Stack>
		</Discord.Card>
	);
}

export default RestartRow;
