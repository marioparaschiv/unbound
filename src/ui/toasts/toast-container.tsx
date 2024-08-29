import type { InternalToastOptions } from '@typings/api/toasts';
import { useSettingsStore } from '@api/storage';
import { SafeAreaView } from 'react-native';
import { Screens } from '@api/metro/common';
import Toasts from '@stores/toasts';
import { useMemo } from 'react';

import useStyles from './toast-container.style';
import Toast from './toast';

function ToastContainer() {
	const settings = useSettingsStore('unbound', ({ key }) => key === 'toasts.maxOnScreen');
	const { toasts } = Toasts.useState();
	const styles = useStyles();

	console.log('updating');

	const maxOnScreen = settings.get<number>('toasts.maxOnScreen', 3);
	const entries: [string, InternalToastOptions][] = useMemo(() => Object.entries(toasts), [toasts]);
	const sorted = useMemo(() => entries.sort(([, a], [, b]) => b.date - a.date).slice(0, maxOnScreen === 0 ? Infinity : maxOnScreen), [entries, maxOnScreen]);

	return <Screens.FullWindowOverlay>
		<SafeAreaView style={styles.safeArea} pointerEvents='box-none'>
			{sorted.map(([id, options]) => <Toast {...options} key={id} />)}
		</SafeAreaView>
	</Screens.FullWindowOverlay>;
}

export default ToastContainer;