import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { GIFPickerHeader, PickerRunning } from '~/picker/modules';
import ProviderHeader from '~/picker/components/provider-header';
import { findSearchField } from '~/picker/search-field';

let markStopped = () => {};

/**
 * @description Adds a provider button to the GIF picker's search header, which cycles Tenor, Giphy and Klipy, and names the provider in the search field.
 * Patches the render of `GIFPickerHeader` (a memo) and wraps its result in `ProviderHeader` only when it renders a field with a `placeholder`.
 * Uses the header's `onQueryChange` prop to search again after a switch.
 * The Addon scope removes the patch, but a header already on screen only drops the button without remounting its search field while `PickerRunning` says so, so `stopPicker` marks it stopped.
 */
export function startPicker(): void {
	if (!ensureModules('GIF Provider Switcher', { GIFPickerHeader })) return;

	markStopped = PickerRunning.markRunning();

	patcher.react.after(GIFPickerHeader, 'default', ({ props, result }) => {
		if (!result || !findSearchField(result)) return;

		return <ProviderHeader header={result} onQueryChange={props?.onQueryChange} />;
	});
}

/**
 * @description Hides the provider button from a GIF picker header that is already on screen.
 */
export function stopPicker(): void {
	markStopped();
	markStopped = () => {};
}
