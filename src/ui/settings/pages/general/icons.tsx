import { useSettingsStore } from '@api/storage';
import { ReactNative as RN, i18n } from '@metro/common';

import { 
    Section,
    SwitchRow,
    RowIcon
} from '@ui/components/FormHandler';
import { capitalize } from '@utilities';
import { Pack, Packs } from '@core/builtins/icon-pack';
import { DownloadButton } from '@ui/settings/components';
import { Dialog } from '@metro/ui';
import { Paths } from '@constants';
import { packExists } from '@api/assets';

interface PackRowProps {
    settings: ReturnType<typeof useSettingsStore>,
    pack: Pack,
    data: typeof Packs[Pack],
    controller: AbortController
}

const PackRow = ({ settings, pack, data, controller }: PackRowProps) => {
    return <SwitchRow 
        label={capitalize(pack)}
        icon={<RowIcon source={data.icon} />}
        value={settings.get('iconpack.name', 'default') === pack}
        onValueChange={async () => {
            settings.set('iconpack.name', pack);

            packExists(settings, pack, true).then(exists => {
                if (!exists) {
                    Dialog.show({
                        title: i18n.Messages.UNBOUND_PACK_NOT_INSTALLED_TITLE,
                        body: i18n.Messages.UNBOUND_PACK_NOT_INSTALLED_DESC,
                    })
                }
            })
        }}
        trailing={data.extension && <RN.View style={{ marginRight: 8 }}>
            <DownloadButton 
                pack={pack} 
                url={Paths.packs.base + data.extension}
                settings={settings}
                controller={controller}
            />
        </RN.View>}
    />
}

export default function () {
	const settings = useSettingsStore('unbound');
    const [controller] = React.useState(new AbortController());

    React.useEffect(() => () => controller.abort(), []);

	return <ReactNative.ScrollView>
        <Section title={i18n.Messages.UNBOUND_DEFAULT_PACKS}>
            {Object.entries(Packs).map(([k, v]) => {
                return <PackRow 
                    settings={settings} 
                    pack={k as Pack} 
                    data={v}
                    controller={controller}
                />
            })}
        </Section>
	</ReactNative.ScrollView>
}