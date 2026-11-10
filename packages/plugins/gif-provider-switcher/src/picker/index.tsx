import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { GIFPickerHeader, PickerRunning } from '~/picker/modules';
import ProviderHeader from '~/picker/components/provider-header';
import { findSearchField } from '~/picker/search-field';

/**
 * @description Adds a provider button to the GIF picker's search header, which cycles Tenor, Giphy and Klipy, and names the provider in the search field.
 * Patches the render of `GIFPickerHeader` (a memo) and wraps its result in `ProviderHeader` only when it renders a field with a `placeholder`.
 * Uses the header's `onQueryChange` prop to search again after a switch.
 * The Addon scope removes the patch, but a header already on screen only drops the button without remounting its search field while `PickerRunning` says so.
 * @returns A function that marks the picker stopped, which hides the button from a header already on screen.
 */
export function startPicker(): (() => void) | undefined {
	if (!ensureModules({ GIFPickerHeader })) return;

	const markStopped = PickerRunning.markRunning();

	patcher.react.after(GIFPickerHeader, 'default', ({ props, result }) => {
		if (!result || !findSearchField(result)) return;

		return <ProviderHeader header={result} onQueryChange={props?.onQueryChange} />;
	});

	return markStopped;
}
