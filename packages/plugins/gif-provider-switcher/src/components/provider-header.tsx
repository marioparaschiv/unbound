import { Discord } from '@unbound-app/api/metro/components';
import { format } from '@unbound-app/i18n';
import { useSetting } from '@unbound-app/settings';
import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';
import { flux } from '@unbound-app/api';

import {
	currentQuery,
	findSearchField,
	readQuery,
	renameSearchField,
	toggleLeadingSpace,
} from '~/lib/search-field';
import { isReplacement, nextProvider, providerLabel } from '~/lib/selection';
import { setSelectedProvider } from '~/lib/selected';
import { PickerRunning } from '~/lib/picker-running';

type GifPickerViewStoreType = {
	getQuery?: () => unknown;
};

type ProviderHeaderProps = {
	header: ReactNode;
	onQueryChange?: (query: string) => void;
};

const GIFPickerViewStore = flux.getStore('GIFPickerView') as GifPickerViewStoreType;

function clone(element: object, props: Record<string, unknown>) {
	return cloneElement(element as ReactElement, props);
}

/**
 * @description The GIF picker header with a button that switches the GIF provider, and the search field naming the provider instead of Klipy.
 * Switching with a query typed searches again, by changing the query by a leading space as Vencord does. The query comes from
 * `GIFPickerViewStore`, else from the search field's props. Once the plugin stops, it drops the button and the renaming in the same layout, so the search field keeps its text.
 * @param props The header Discord rendered, and its `onQueryChange`.
 * @returns The header and the provider button, side by side, or Discord's header unchanged after the plugin stopped.
 */
export function ProviderHeader({ header, onQueryChange }: ProviderHeaderProps) {
	const running = PickerRunning.useRunning();
	const provider = useSetting('provider');
	const label = providerLabel(provider);
	const next = nextProvider(provider);

	function switchProvider() {
		const query = currentQuery(
			GIFPickerViewStore.getQuery?.(),
			readQuery(findSearchField(header) ?? {}),
		);

		setSelectedProvider(next);

		if (query.trim()) onQueryChange?.(toggleLeadingSpace(query));
	}

	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			<View style={{ flex: 1 }}>
				{
					(running && isReplacement(provider)
						? renameSearchField(header, label, clone)
						: header) as ReactNode
				}
			</View>
			{running && (
				<Discord.Button
					size='sm'
					variant='secondary'
					text={label}
					accessibilityLabel={format('PROVIDER_BUTTON_LABEL', {
						provider: label,
						next: providerLabel(next),
					})}
					onPress={switchProvider}
				/>
			)}
		</View>
	);
}

export default ProviderHeader;
