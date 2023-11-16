import { React, ReactNative as RN } from '@metro/common';
import { ToastOptions } from '@typings/api/toasts';
import { useToasts } from '@stores/toasts';

import Toast from './Toast';

function ToastContainer() {
	const { toasts } = useToasts();

	return <>
		<RN.SafeAreaView />
		<RN.View style={{ gap: 5, height: '100%', pointerEvents: 'box-none' }}>
			{Object.entries(toasts).map(([id, options]: [string, ToastOptions]) => (
				<Toast {...options} key={id} />
			))}
		</RN.View>
	</>;
}

export default ToastContainer;