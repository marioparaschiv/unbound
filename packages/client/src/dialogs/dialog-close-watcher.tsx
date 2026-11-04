import { useEffect } from 'react';

type DialogCloseWatcherProps = {
	/** Runs once, when Discord unmounts the dialog: a button, the backdrop, the back gesture or a dismiss. */
	onClose: () => void;
};

/**
 * @description Renders nothing inside a dialog and reports when the dialog goes away, since Discord's
 * alert has no close callback of its own.
 */
function DialogCloseWatcher({ onClose }: DialogCloseWatcherProps) {
	// Mount once: the dialog's lifetime is this component's lifetime.
	useEffect(() => onClose, []);

	return null;
}

export default DialogCloseWatcher;
