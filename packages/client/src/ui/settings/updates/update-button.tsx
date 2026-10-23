import type { ButtonSize } from '@unbound-app/types';

import { Discord } from '~/api/metro/components';
import UpdatesStore from '~/stores/updates';
import { Messages } from '~/api/i18n';

type UpdateButtonProps = {
	id: string;
	text: string;
	size?: ButtonSize;
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
			text={status === 'failed' ? Messages.UNBOUND_UPDATES_RETRY : text}
			loading={status === 'updating'}
			onPress={() => void update()}
		/>
	);
}

export default UpdateButton;
