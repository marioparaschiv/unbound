import { Discord } from '~/metro/components';
import { reload } from '~/native/native';
import { messages } from '~/i18n/api';

/**
 * @description Asks whether to restart Discord, and restarts it on confirm.
 */
function confirmRestart() {
	Discord.showConfirmModal({
		title: messages.UNBOUND_RESTART,
		content: messages.UNBOUND_RESTART_CONFIRM,
		confirmText: messages.UNBOUND_RESTART,
		cancelText: messages.UNBOUND_CANCEL,
		onConfirm: reload,
	});
}

export default confirmRestart;
