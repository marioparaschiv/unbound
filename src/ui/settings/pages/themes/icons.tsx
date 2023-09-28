import { useSettingsStore } from '@api/storage';
import { ReactNative as RN, i18n } from '@metro/common';

import {
	Section,
	SwitchRow,
	RowIcon
} from '@ui/components/form';
import { capitalize } from '@utilities';
import { Pack, Packs } from '@core/builtins/icon-pack';
import { DownloadButton } from '@ui/settings/components';
import { Dialog } from '@metro/ui';
import { Paths } from '@constants';
import { packExists } from '@api/assets';
import { showToast } from '@api/toasts';

interface PackRowProps {
	settings: ReturnType<typeof useSettingsStore>,
	pack: Pack,
	data: typeof Packs[Pack],
	controller: AbortController;
}

const PackRow = ({ settings, pack, data, controller }: PackRowProps) => {
	return <SwitchRow
		label={capitalize(pack)}
		icon={<RowIcon source={data.icon} />}
		value={settings.get('iconpack.name', 'default') === pack}
		onValueChange={async () => {
			settings.set('iconpack.name', pack);

			const exists = packExists(settings, pack);

			if (exists) {
				setTimeout(() => (
					showToast({
						title: i18n.Messages.UNBOUND_ICON_PACK_TITLE,
						content: i18n.Messages.UNBOUND_PACK_APPLYING_DESC.format({ pack: `'${capitalize(pack)}'` }),
						icon: 'img_nitro_star'
					})
				));
			} else {
				Dialog.show({
					title: i18n.Messages.UNBOUND_ICON_PACK_TITLE,
					body: i18n.Messages.UNBOUND_PACK_NOT_INSTALLED_DESC.format({ pack: `'${capitalize(pack)}'` }),
				});
			}
		}}
		trailing={data.extension && <RN.View style={{ marginRight: 8 }}>
			<DownloadButton
				pack={pack}
				url={Paths.packs.base + data.extension}
				settings={settings}
				controller={controller}
			/>
		</RN.View>}
	/>;
};

export default function () {
	const settings = useSettingsStore('unbound');
	const [store, setStore] = React.useState({ controller: new AbortController() });

	const controller = {
		abort(...args: Arguments<typeof store['controller']['abort']>) {
			store.controller.abort(...args);
			setStore({ controller: new AbortController() });
		},

		get signal() {
			return store.controller.signal;
		}
	};

	React.useEffect(() => () => store.controller.abort(), []);

	return <ReactNative.ScrollView>
		<Section title={i18n.Messages.UNBOUND_DEFAULT_PACKS}>
			{Object.entries(Packs).map(([k, v]) => {
				return <PackRow
					settings={settings}
					pack={k as Pack}
					data={v}
					controller={controller}
				/>;
			})}
		</Section>
	</ReactNative.ScrollView>;
}