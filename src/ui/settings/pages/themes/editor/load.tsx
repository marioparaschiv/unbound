import { React, ReactNative, i18n } from '@metro/common'
import Themes from '@managers/themes'
import { Button, Navigation } from '@metro/components'
import { Keys } from '@constants';
import Editor from './editor';
import { styles } from './index';

export default () => {
    const navigation = Navigation.useNavigation();

    return <ReactNative.View>
        <ReactNative.Text>{i18n.Messages.UNBOUND_THEME_EDITOR_LOAD_EXISTING}</ReactNative.Text>
        {Array.from(Themes.entities.values()).map(({ 
            data: manifest, 
            instance: bundle
        }) => {
            return <Button
                color={Button.Colors.BRAND}
                text={manifest.name}
                onPress={() => navigation.push(Keys.Custom, {
                    title: i18n.Messages.UNBOUND_THEME_EDITOR_EDIT_THEME_TITLE,
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