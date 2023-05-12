import { useToasts } from '@stores/toasts';
import { React } from '@metro/common';

import Toast from './Toast';

function ToastContainer() {
	const { toasts } = useToasts();

	return <>
		{Object.values(toasts).map(options => <Toast {...options} />)}
	</>;
}

export default ToastContainer;