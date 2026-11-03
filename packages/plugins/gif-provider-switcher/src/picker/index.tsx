import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import { findSearchField } from '~/picker/search-field';
import ProviderHeader from '~/picker/components/provider-header';
import { GIF_PICKER_HEADER_PATH, PLUGIN_NAME } from '~/constants';

/**
 * @description Adds a provider button to the GIF picker's search header, which cycles Tenor, Giphy and Klipy, and names the provider in the search field.
 * Patches the render function of `modules/gif_picker/native/GIFPickerHeader.tsx` (a memo) and wraps its result in `ProviderHeader` only when it renders a field with a `placeholder`.
 * Uses the header's `onQueryChange` prop to search again after a switch.
 * @returns A function that stops waiting for the header's module, or removes the patch.
 */
export function patchGifPickerHeader(): () => void {
	return whenLoaded(GIF_PICKER_HEADER_PATH, (module: AnyProps) => {
		const target = findRenderTarget(module);

		if (!target) {
			console.error(`[${PLUGIN_NAME}] GIF picker header component not found.`);

			return () => {};
		}

		return patcher.after(target.holder, target.key, ({ args: [props], result }) => {
			if (!result || !findSearchField(result)) return;

			return <ProviderHeader header={result} onQueryChange={props?.onQueryChange} />;
		});
	});
}
