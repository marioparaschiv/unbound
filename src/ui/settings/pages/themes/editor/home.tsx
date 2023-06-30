// TO-DO: Add all of these strings to I18N
import { React } from "@metro/common";
import { Icons } from '@api/assets';
import { Button, Navigation } from "@metro/components";
import { Keys } from "@constants";
import { Dialog } from "@metro/ui";

import InstallModal from "@ui/settings/components/installmodal";
import Themes from '@managers/themes';

import Create from "./create";
import Load from "./load";
import Editor from "./editor";
import { Manifest } from "@typings/managers";
import { StaticSection, styles } from "./index";

const background = Icons["background"];
const splash = Icons['screenshare_halfsheet_splash']

const handleLoad = async (url: string, navigation: any) => {
    const manifest = await fetch(url, { cache: 'no-cache' }).then(r => r.json()) as Manifest;

    try {
        Themes.validateManifest(manifest as Manifest);
    } catch (e) {
        return Themes.logger.debug('Failed to validate manifest:', e.message);
    }

    const bundle = await fetch((manifest as any).bundle, { cache: 'no-cache' }).then(r => r.json());

    navigation.push(Keys.Custom, {
        title: "Edit Theme",
        render: () => <Editor 
            manifest={manifest}
            bundle={bundle}
        />
    })
}

export default () => {
    const navigation = Navigation.useNavigation();
    const ref = React.useRef<InstanceType<typeof InstallModal>>();
	const url = React.useCallback(() => ref.current?.getInput(), [ref.current]);

    return <ReactNative.ImageBackground
        source={background}
        style={styles.background}
    >
        <StaticSection>
            <ReactNative.Image source={splash} />
            <ReactNative.Text style={styles.header}>
                Let's create a theme!
            </ReactNative.Text>
            <ReactNative.Text style={styles.subheader}>
                You can either create a new theme or load an existing one. The choice is yours!
            </ReactNative.Text>
        </StaticSection>
        <StaticSection>
            <Button 
                color={Button.Colors.BRAND}
                text="Create New"
                onPress={() => navigation.push(Keys.Custom, {
                    title: "Create New",
                    render: Create
                })}
                size={Button.Sizes.MEDIUM}
                style={styles.button}
                look={Button.Looks.FILLED}
            />
            <Button 
                color={Button.Colors.BRAND}
                text="Load Existing"
                onPress={() => navigation.push(Keys.Custom, {
                    title: "Load Existing",
                    render: Load
                })}
                size={Button.Sizes.MEDIUM}
                style={styles.button}
                look={Button.Looks.OUTLINED}
            />
            <ReactNative.TouchableOpacity onPress={() => {
                Dialog.confirm({
                    title: "Load theme",
                    children: <InstallModal manager={Themes} ref={ref} />,
                    confirmText: "Load",
                    onConfirm: () => url() && handleLoad(url(), navigation)
                });
            }}>
                <ReactNative.Text style={styles.link}>Load from link</ReactNative.Text>
            </ReactNative.TouchableOpacity>
        </StaticSection>
    </ReactNative.ImageBackground>
};