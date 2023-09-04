import { ToastOptions } from '@typings/api/toasts';
import { useToasts } from '@stores/toasts';
import { React } from '@metro/common';

import Toast from './toast';

function ToastContainer() {
	const { toasts } = useToasts();

	return <ReactNative.SafeAreaView style={{ marginTop: 30 }}>
		{Object.entries(toasts).map(([id, options]: [string, ToastOptions]) => (
			<Toast {...options} key={id} />
		))}
	</ReactNative.SafeAreaView>;
}

export default ToastContainer;