import { toasts as items, useToasts } from '@stores/toasts';
import { React } from '@metro/common';
import { ToastOptions } from '@typings/api/toasts';
import { on, off } from '@api/storage';

import Toast from './Toast';

function ToastContainer() {
	const { toasts } = useToasts();

	return <ReactNative.SafeAreaView>
		{Object.entries(toasts).map(([id, options]: [string, ToastOptions]) => (
            <Toast {...options} key={id} />
        ))}
	</ReactNative.SafeAreaView>;
}

export default ToastContainer;