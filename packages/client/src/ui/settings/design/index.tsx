import { useCallback, useEffect, useState } from 'react';

import { Discord } from '~/metro/components';

import type { HeaderOptions } from './navigation';

import { ReportPicker, type PickerKind } from './picker-report';
import DesignTabs, { type DesignTab } from './design-tabs';
import DiscordPicker from './discord-picker';

const renderPicker = (kind: PickerKind) => <DiscordPicker kind={kind} />;

type DesignParams = {
	/** Opens on this tab, e.g. an installed theme's from its Installed button in the Marketplace. */
	tab?: DesignTab;
};

type DesignPageProps = {
	route: { params?: DesignParams };
};

/**
 * @description The Design settings page: Discord's App Theme picker for themes and icon packs, beside Fonts and Chat,
 * full-screen under its transparent header. The active picker owns the header; Fonts and Chat keep the back
 * button and title only.
 */
function DesignPage({ route }: DesignPageProps) {
	const navigation = Discord.useNavigation();
	const initialTab = route.params?.tab ?? 'theme';
	const [tab, setTab] = useState<DesignTab>(initialTab);
	const [headers, setHeaders] = useState<Partial<Record<PickerKind, HeaderOptions>>>({});

	const report = useCallback(
		(kind: PickerKind, options: HeaderOptions) =>
			setHeaders((previous) => ({ ...previous, [kind]: options })),
		[],
	);

	useEffect(() => {
		const picker = tab === 'theme' || tab === 'icon-pack' ? tab : undefined;
		const base = (picker ? headers[picker] : undefined) ?? headers.theme;

		if (!base) return;

		navigation.setOptions(picker ? base : { ...base, headerRight: () => null });
	}, [navigation, tab, headers]);

	return (
		<ReportPicker.Provider value={report}>
			<DesignTabs renderPage={renderPicker} initialTab={initialTab} onTabChange={setTab} />
		</ReportPicker.Provider>
	);
}

export default DesignPage;
