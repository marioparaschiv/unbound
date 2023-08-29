import { Files, useSettingsStore } from '@api/storage';
import { ReactNative as RN } from '@metro/common';

import { 
    Section,
    SwitchRow,
    RowIcon
} from '@ui/components/FormHandler';
import { capitalize } from '@utilities';
import { Packs, paths } from '@core/builtins/icon-pack';
import { DownloadButton } from '@ui/settings/components';
import { Dialog } from '@metro/ui';

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
            settings.set('iconpack.name', name)

            Files.fileExists(Files.DocumentsDirPath + `/Unbound/Packs/${name}`).then(res => {
                (!res && name !== 'default') &&
                    Dialog.show({
                        title: "Pack not installed",
                        body: "The pack you selected is not installed. Icons will be fetched externally, resulting in a poorer experience. Please install the icon pack to refrain from needing to download each asset as it's needed.",
                        confirmText: "Okay"
                    })
            })
        }}
        trailing={pack.extension && <RN.View style={{ marginRight: 8 }}>
            <DownloadButton 
                name={name} 
                url={paths.base + pack.extension}
            />
        </RN.View>}
    />
}

export default function () {
	const settings = useSettingsStore('unbound');

	return <ReactNative.ScrollView>
        <Section title='Default Packs'>
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