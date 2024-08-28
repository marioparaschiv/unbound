import type { ToastOptions } from '@typings/api/toasts';
import { SafeAreaView } from 'react-native';
import { useToasts } from '@stores/toasts';
import { useMemo } from 'react';

import useStyles from './toast-container.style';
import Toast from './toast';

function ToastContainer() {
	const { toasts } = useToasts();
	const styles = useStyles();

	const entries: [string, ToastOptions][] = useMemo(() => Object.entries(toasts), [toasts]);

	return <SafeAreaView style={styles.safeArea} pointerEvents='box-none'>
		{entries.map(([id, options]) => <Toast {...options} key={id} />)}
	</SafeAreaView>;

	// return entries.map(([id, options]) => <Toast {...options} key={id} />)
	// return <Portal.Portal style={{ zIndex: 999999, width: '100%', height: '100%' }}>
	// 	<Screens.FullWindowOverlay style={{ zIndex: 999999, width: '100%', height: '100%' }}>
	// 		<SafeAreaView style={styles.safeArea} pointerEvents='box-none'>
	// 			{entries.map(([id, options]) => <Toast {...options} key={id} />)}
	// 		</SafeAreaView>
	// 	</Screens.FullWindowOverlay>
	// </Portal.Portal>;
}

export default ToastContainer;