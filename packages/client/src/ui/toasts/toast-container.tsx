import type { InternalToastOptions } from '@unbound-app/types/toasts';
import { SafeAreaView } from 'react-native';
import { useMemo } from 'react';

import { useSettingsStore } from '~/api/storage';
import { Screens } from '~/api/metro/common';
import ToastStore from '~/stores/toasts';

import useStyles from './toast-container.style';
import Toast from './toast';

function ToastContainer() {
	const settings = useSettingsStore('unbound', ({ key }) => key === 'toasts.maxOnScreen');
	const { toasts } = ToastStore();
	const styles = useStyles();

	const maxOnScreen = settings.get<number>('toasts.maxOnScreen', 3);
	const entries: [string, InternalToastOptions][] = useMemo(
		() => Object.entries(toasts),
		[toasts],
	);
	const sorted = useMemo(
		() =>
			entries
				.sort(([, a], [, b]) => (b.date ?? 0) - (a.date ?? 0))
				.slice(0, maxOnScreen === 0 ? Infinity : maxOnScreen),
		[entries, maxOnScreen],
	);

	return (
		<Screens.FullWindowOverlay>
			<SafeAreaView style={styles.safeArea} pointerEvents='box-none'>
				{sorted.map(([id, options]) => (
					<Toast key={id} {...options} />
				))}
			</SafeAreaView>
		</Screens.FullWindowOverlay>
	);
}

export default ToastContainer;
