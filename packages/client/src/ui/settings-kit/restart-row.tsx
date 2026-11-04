import type { ReactElement } from 'react';

import { Discord } from '~/metro/components';
import { reload } from '~/native/runtime';
import { messages } from '~/i18n/api';

/**
 * @description A settings group saying a change applies after Discord restarts, with a button that restarts it now.
 * @returns The group.
 */
function RestartRow(): ReactElement {
	return (
		<Discord.TableRowGroup>
			<Discord.TableRow
				label={messages.UNBOUND_SETTING_RESTART_HINT}
				trailing={
					<Discord.Button
						size='sm'
						variant='primary'
						text={messages.UNBOUND_RESTART}
						onPress={() => void reload()}
					/>
				}
			/>
		</Discord.TableRowGroup>
	);
}

export default RestartRow;
