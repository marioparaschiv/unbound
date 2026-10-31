import { Platform, SafeAreaView, StatusBar } from 'react-native';
import { useShallow } from 'zustand/shallow';

import { useUnboundSettings } from '~/settings/unbound';
import useToastStore from '~/toasts/state';

import useStyles from './toast-container.style';
import ToastOverlay from './toast-overlay';
import Toast from './toast';

const androidInset =
	Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight ?? 0 } : null;

function ToastContainer() {
	const settings = useUnboundSettings(({ key }) => key === 'toasts.maxOnScreen');
	const styles = useStyles();

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
			<SafeAreaView style={[styles.container, androidInset]} pointerEvents='box-none'>
				{ids.map((id) => (
					<Toast key={id} id={id} />
				))}
			</SafeAreaView>
		</ToastOverlay>
	);
}

export default ToastContainer;
