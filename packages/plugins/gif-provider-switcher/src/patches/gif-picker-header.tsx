import { metro, patcher } from '@unbound-app/api';

import ProviderHeader from '~/components/provider-header';
import { markPickerRunning } from '~/lib/picker-running';
import { findSearchField } from '~/lib/search-field';

/**
 * @description Adds a provider button to the GIF picker's search header, which cycles Tenor, Giphy and Klipy, and names the provider in the search field.
 * Patches the render of `GIFPickerHeader` (a memo) and wraps its result in `ProviderHeader` only when it renders a field with a `placeholder`.
 * Uses the header's `onQueryChange` prop to search again after a switch.
 * A header already on screen only drops the button without remounting its search field once `stop` marks the picker stopped.
 */
export function patchGifPickerHeader(): void {
	const GIFPickerHeader = metro.findByFilePath('modules/gif_picker/native/GIFPickerHeader.tsx');

	if (!GIFPickerHeader) {
		logger.warn('Provider button skipped: Discord moved GIFPickerHeader.');

		return;
	}

	markPickerRunning();

	patcher.react.after(GIFPickerHeader, 'default', ({ props, result }) => {
		if (!result || !findSearchField(result)) return;

		return <ProviderHeader header={result} onQueryChange={props?.onQueryChange} />;
	});
}
