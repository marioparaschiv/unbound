import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps } from 'react';

import { Discord } from '~/metro/components';
import UpdatesStore from '~/updates/state';
import { messages } from '~/i18n/api';

type UpdateButtonProps = {
	id: string;
	text: string;
	size?: ComponentProps<DesignModule['Button']>['size'];
	grow?: boolean;
	onUpdated?: () => void;
};

/** Applies one pending update, showing a spinner while it runs and a retry after it fails. */
function UpdateButton({ id, text, size = 'sm', grow, onUpdated }: UpdateButtonProps) {
	const status = UpdatesStore((state) => state.applying[id]);
	const apply = UpdatesStore((state) => state.apply);

	async function update() {
		if (await apply(id)) {
			onUpdated?.();
		}
	}

	return (
		<Discord.Button
			size={size}
			grow={grow}
			variant={status === 'failed' ? 'destructive' : 'primary'}
			text={status === 'failed' ? messages.UNBOUND_UPDATES_RETRY : text}
			loading={status === 'updating'}
			onPress={() => void update()}
		/>
	);
}

export default UpdateButton;
