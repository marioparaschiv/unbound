import { useShallow } from 'zustand/shallow';

import { useUnboundSettings } from '~/settings/unbound';
import useToastStore from '~/toasts/state';

import ToastOverlay from './toast-overlay';
import ToastList from './toast-list';

function ToastContainer() {
	const settings = useUnboundSettings(({ key }) => key === 'toasts.maxOnScreen');

	const maxOnScreen = settings.get('toasts.maxOnScreen');

	// Select only the ordered id list so the container re-renders when toasts are added/removed/reordered,
	// not when a single toast's fields update.
	const ids = useToastStore(
		useShallow((state) =>
			Object.values(state.toasts)
				.sort((a, b) => (b.date ?? 0) - (a.date ?? 0))
				.slice(0, maxOnScreen === 0 ? Infinity : maxOnScreen)
				.map((toast) => toast.id),
		),
	);

	// The FullWindowOverlay must be created only while toasts are visible so its window lands above other
	// floating windows (dialogs, action sheets) that may already be open.
	if (!ids.length) return null;

	return (
		<ToastOverlay>
			<ToastList ids={ids} />
		</ToastOverlay>
	);
}

export default ToastContainer;
