import { useCallback, useEffect, useState } from 'react';

import { Discord } from '~/metro/components';

import type { HeaderOptions } from './navigation';

import { ReportPicker, type PickerKind } from './picker-report';
import DesignTabs, { type DesignTab } from './design-tabs';
import DiscordPicker from './discord-picker';

const renderPicker = (kind: PickerKind) => <DiscordPicker kind={kind} />;

/**
 * @description The Design settings page: Discord's App Theme picker for themes and icon packs, beside Fonts,
 * full-screen under its transparent header. The active picker owns the header; Fonts keeps the back
 * button and title only.
 */
function DesignPage() {
	const navigation = Discord.useNavigation();
	const [tab, setTab] = useState<DesignTab>('theme');
	const [headers, setHeaders] = useState<Partial<Record<PickerKind, HeaderOptions>>>({});

	const report = useCallback(
		(kind: PickerKind, options: HeaderOptions) =>
			setHeaders((previous) => ({ ...previous, [kind]: options })),
		[],
	);

	useEffect(() => {
		const base = (tab === 'font' ? undefined : headers[tab]) ?? headers.theme;

		if (!base) return;

		navigation.setOptions(tab === 'font' ? { ...base, headerRight: () => null } : base);
	}, [navigation, tab, headers]);

	return (
		<ReportPicker.Provider value={report}>
			<DesignTabs renderPage={renderPicker} onTabChange={setTab} />
		</ReportPicker.Provider>
	);
}

export default DesignPage;
