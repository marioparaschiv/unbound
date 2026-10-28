import { createLogger } from '@unbound-app/logger';

import { findByFilePath, findByProps } from '~/api/metro';
import { ThemeEditorButton } from '~/ui/theme-editor';
import { createPatcher } from '~/api/patcher';

import findToastContainers from './find-toast-containers';

const Patcher = createPatcher('unbound::theme-editor-button');
const Logger = createLogger('ThemeEditorButton');

/** Mounts the floating theme editor button beside Discord's app-wide toast container. */
export function start() {
	// Only the outermost container: on iOS it renders the inner one, which would draw a second button.
	const [target] = findToastContainers(findByFilePath, findByProps);

	if (!target) {
		Logger.error('Failed to find ToastContainer component');

		return;
	}

	const [module, key] = target;

	Patcher.after(module, key, ({ result }) => (
		<>
			{result}
			<ThemeEditorButton />
		</>
	));
}

/** Removes the floating theme editor button. */
export function stop() {
	Patcher.unpatchAll();
}

export default { start, stop };
