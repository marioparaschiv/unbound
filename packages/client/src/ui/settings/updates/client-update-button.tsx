import { createLogger } from '@unbound-app/logger';

import { CLIENT_UPDATE_ID } from '~/updates/client-update';
import { Discord } from '~/metro/components';
import { reload } from '~/native/runtime';
import UpdatesStore from '~/updates/state';
import { messages } from '~/i18n/api';

const logger = createLogger('Updater', 'Client');

type ClientUpdateButtonProps = {
	/** Whether the newer client already downloaded, so the button restarts into it. */
	staged: boolean;
};

function restart() {
	reload().catch((error) => logger.error('Failed to restart for the staged bundle:', error));
}

/**
 * @description The client row's action: downloads the newer client, with a spinner while it runs and a retry after it
 * fails, then restarts into it.
 */
function ClientUpdateButton({ staged }: ClientUpdateButtonProps) {
	const status = UpdatesStore((state) => state.applying[CLIENT_UPDATE_ID]);
	const applyClient = UpdatesStore((state) => state.applyClient);

	if (staged) {
		return (
			<Discord.Button
				size='sm'
				variant='primary'
				text={messages.UNBOUND_RESTART}
				onPress={restart}
			/>
		);
	}

	return (
		<Discord.Button
			size='sm'
			variant={status === 'failed' ? 'destructive' : 'primary'}
			text={status === 'failed' ? messages.UNBOUND_UPDATES_RETRY : messages.UNBOUND_UPDATE}
			loading={status === 'updating'}
			onPress={() => void applyClient()}
		/>
	);
}

export default ClientUpdateButton;
