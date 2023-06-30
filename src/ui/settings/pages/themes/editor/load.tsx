import { React, ReactNative } from "@metro/common"
import Themes from "@managers/themes"
import { Button, Navigation } from "@metro/components"
import { Keys } from "@constants";
import Editor from "./editor";
import { styles } from "./index";

export default () => {
    const navigation = Navigation.useNavigation();

    return <ReactNative.View>
        <ReactNative.Text>Load existing</ReactNative.Text>
        {Array.from(Themes.entities.values()).map(({ 
            data: manifest, 
            instance: bundle
        }) => {
            return <Button
                color={Button.Colors.BRAND}
                text={manifest.name}
                onPress={() => navigation.push(Keys.Custom, {
                    title: "Edit Theme",
                    render: () => <Editor 
                        manifest={manifest}
                        bundle={bundle}
                    />
                })}
                size={Button.Sizes.MEDIUM}
                style={styles.button}
                look={Button.Looks.OUTLINED}
            />
        })}
    </ReactNative.View>
}