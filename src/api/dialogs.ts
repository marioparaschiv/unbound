import { ConfirmationAlertOptions, InternalConfirmationAlertOptions } from '@typings/api/dialogs';
import { Dialog } from '@metro/ui';

export function showConfirmationAlert(options: ConfirmationAlertOptions) {
	const opts = options as InternalConfirmationAlertOptions;

	console.log(options);

	if (typeof options.content === 'string' || Array.isArray(options.content)) {
		opts.body = options.content;
	} else {
		opts.children = options.content;
	};

	delete opts.content;
	return Dialog.confirm(opts);
};

export const showCustomAlert = (component: React.ComponentType, props: any) => Dialog.openLazy({
	importer: async () => React.createElement(component, props)
});

export default { showCustomAlert, showConfirmationAlert };