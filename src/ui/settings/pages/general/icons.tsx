import { Files, useSettingsStore } from '@api/storage';
import { ReactNative as RN, i18n } from '@metro/common';

import { 
    Section,
    SwitchRow,
    RowIcon
} from '@ui/components/FormHandler';
import { capitalize } from '@utilities';
import { Packs } from '@core/builtins/icon-pack';
import { DownloadButton } from '@ui/settings/components';
import { Dialog } from '@metro/ui';
import { Paths } from '@constants';
import { packExists } from '@api/assets';

interface PackRowProps {
    settings: ReturnType<typeof useSettingsStore>,
    name: keyof typeof Packs,
    pack: typeof Packs[keyof typeof Packs]
}

const PackRow = ({ settings, name, pack }: PackRowProps) => {
    return <SwitchRow 
        label={capitalize(name)}
        icon={<RowIcon source={pack.icon} />}
        value={settings.get('iconpack.name', 'default') === name}
        onValueChange={async () => {
            settings.set('iconpack.name', name);

            if (!packExists(settings, name) && name !== 'default') {
                Dialog.show({
                    title: i18n.Messages.UNBOUND_PACK_NOT_INSTALLED_TITLE,
                    body: i18n.Messages.UNBOUND_PACK_NOT_INSTALLED_DESC,
                })
            }
        }}
        trailing={pack.extension && <RN.View style={{ marginRight: 8 }}>
            <DownloadButton 
                name={name} 
                url={Paths.base + pack.extension}
                settings={settings}
            />
        </RN.View>}
    />
}

export default function () {
	const settings = useSettingsStore('unbound');

	return <ReactNative.ScrollView>
        <Section title={i18n.Messages.UNBOUND_DEFAULT_PACKS}>
            {Object.entries(Packs).map(([k, v]) => {
                return <PackRow 
                    settings={settings} 
                    name={k as keyof typeof Packs} 
                    pack={v} 
                />
            })}
        </Section>
	</ReactNative.ScrollView>
}