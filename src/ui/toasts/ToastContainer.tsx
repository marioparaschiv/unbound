import { useToasts } from '@stores/toasts';
import { React } from '@metro/common';
import { ToastOptions } from '@typings/api/toasts';

import Toast from './Toast';

function ToastContainer() {
	const { toasts } = useToasts();

	return <ReactNative.View>
		{Object.values(toasts).reverse().map((options: ToastOptions) => (
            <Toast {...options} />
        ))}
	</ReactNative.View>;
}

export default ToastContainer;