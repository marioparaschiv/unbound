import { useToasts } from '@stores/toasts';
import { React, Reanimated } from '@metro/common';

import Toast from './Toast';
import { Animated } from '@metro/components';

function ToastContainer() {
	const { toasts } = useToasts();



	return <ReactNative.View>
		{Object.values(toasts).reverse().map(options => <Toast {...options} />)}
	</ReactNative.View>;
}

export default ToastContainer;