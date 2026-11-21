import { createLogger } from '@unbound-app/logger';

import { fixImageSource, type ImageSourceProp } from '~/core/image-source';
import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byFilePath } from '~/metro/filters';

const Patcher = createPatcher('unbound::image-source-guard');
const Logger = createLogger('ImageSourceGuard');

type FastImageProps = { source?: ImageSourceProp };

let stopWaiting: (() => void) | undefined;

function patchFastImage(FastImage: MetroExport) {
	const component = FastImage?.default ?? FastImage;

	if (typeof component?.type !== 'function') {
		Logger.warn('Image source guard skipped: Discord moved FastImage.');

		return;
	}

	Patcher.before(component, 'type', ({ args }) => {
		const [props, ...rest] = args as [FastImageProps | undefined, ...unknown[]];
		const source = props?.source;
		const fixed = fixImageSource(source);

		if (fixed === source) return;

		Logger.warn('Fixed an image source whose uri was a number.');

		return [{ ...props, source: fixed }, ...rest];
	});
}

/**
 * @description Turns a numeric image `uri` into a string before Discord's FastImage hands it to native code,
 * which crashes the app on a number.
 */
export function start() {
	stopWaiting = onModuleLoaded(
		byFilePath('components_native/common/FastImage.tsx'),
		patchFastImage,
	);
}

/**
 * @description Stops guarding image sources.
 */
export function stop() {
	stopWaiting?.();
	stopWaiting = undefined;
	Patcher.unpatchAll();
}

export default { start, stop };
