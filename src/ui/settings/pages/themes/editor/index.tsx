import { Icons } from '@api/assets';
import { Constants, StyleSheet, Theme } from '@metro/common';
import { Forms } from '@metro/components';

export const styles = StyleSheet.createThemedStyleSheet({
    background: {
        height: '100%',
        justifyContent: 'center',
    },
    shadow: {
        shadowColor: '#000',
        shadowOffset: {
            width: 1,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 4.65,
        elevation: 8,
    },
    section: {
        marginHorizontal: 24,
        marginTop: 16,
        marginBottom: 40,
        padding: 24,

        backgroundColor: Theme.colors.BACKGROUND_PRIMARY,
        borderRadius: 16,

        alignItems: 'center',
        justifyContent: 'center'
    },
    header: {
        color: Theme.colors.HEADER_PRIMARY,

        fontSize: 24,
        fontFamily: Constants.Fonts.DISPLAY_BOLD,

        marginTop: 24,
        marginBottom: 8,
        textAlign: 'center'
    },
    subheader: {
        color: Theme.colors.HEADER_SECONDARY,

        fontSize: 16,
        fontFamily: Constants.Fonts.DISPLAY_NORMAL,

        marginHorizontal: 8,
        textAlign: 'center'
    },
    button: {
        borderRadius: 12, 
        marginBottom: 12 
    },
    link: {
        color: Theme.colors.TEXT_LINK,

        fontSize: 14,
        fontFamily: Constants.Fonts.DISPLAY_BOLD,

        textAlign: 'center'
    },
    eyebrow: {
        color: Theme.colors.TEXT_MUTED,

        fontSize: 14,
        fontFamily: Constants.Fonts.DISPLAY_BOLD,
    },
    icon: {
        width: 20,
        height: 20,
        marginHorizontal: 4
    },
    preview: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Theme.colors.HEADER_PRIMARY
    },
    input: {
        width: '100%',
        height: 40,
        borderBottomWidth: 2,
        marginHorizontal: 8,
        marginTop: 10,
        borderBottomColor: Theme.colors.CONTROL_BRAND_FOREGROUND_NEW ?? Theme.colors.CONTROL_BRAND_FOREGROUND,
        color: Theme.colors.TEXT_NORMAL,
        fontFamily: Constants.Fonts.DISPLAY_NORMAL
    }
})

export const StaticSection = ({ children, style = {} }) => (
    <ReactNative.View style={[styles.section, styles.shadow, style]}>
        {children}
    </ReactNative.View>
)

export const ToggleableSection = ({ title, style = {}, children, trailing, ...rest }: any) => {
    const [hidden, setHidden] = React.useState(false);

    return <ReactNative.View>
        <Forms.FormRow 
            label={title}
            trailing={<ReactNative.View style={{ flexDirection: 'row' }}>
                {trailing}
                <Forms.FormRow.Icon 
                    source={Icons[`ic_arrow${hidden ? '' : '_down'}`]} 
                    style={styles.icon}
                />
            </ReactNative.View>}
            onPress={() => {
                setHidden((previous: boolean) => !previous);
                ReactNative.LayoutAnimation.configureNext({ 
                    duration: 300,
                    create: { type: 'keyboard', property: 'opacity' },
                    update: { type: 'easeInEaseOut' },
                    delete: { type: 'easeInEaseOut', property: 'opacity' }
                });
            }}
            {...rest}
        />
        {!hidden && <ReactNative.View style={[styles.section, styles.shadow, { padding: 4 }]}>
            {children}
        </ReactNative.View>}
    </ReactNative.View>
}