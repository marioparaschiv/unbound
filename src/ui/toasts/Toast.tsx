import { Constants, React, Reanimated, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { ToastOptions } from '@typings/api/toasts';
import Toasts from '@stores/toasts';
import { Icons } from '@api/assets';
import { get } from '@api/storage';

function useToastState(options: ToastOptions) {
    const opacity = Reanimated.useSharedValue(0);
    const marginTop = Reanimated.useSharedValue(0);
    const [leaving, setLeaving] = React.useState(false);

    function enter() {
        opacity.value = Reanimated.withTiming(1, { duration: 200 });
        marginTop.value = Reanimated.withSpring(15);
    }

    function leave() {
        opacity.value = Reanimated.withTiming(0, { duration: 200 });
        marginTop.value = Reanimated.withSpring(0);

        setTimeout(() => Toasts.store.setState((prev) => {
            delete prev.toasts[options.id];
            return prev;
        }), 200)
    }

    React.useEffect(() => {
        const timeout = setTimeout(
            () => setLeaving(true), 
            (options.duration ?? get('unbound', 'toasts.duration', 3)) * 1000
        )

        return () => clearTimeout(timeout);
    }, []);

    React.useEffect(() => {
        leaving ? leave() : enter();
    }, [leaving]);

    return {
        style: { opacity, marginTop },
        enter,
        leave
    }
}

function Toast(options: ToastOptions) {
    const { style, leave } = useToastState(options);

    return <Reanimated.default.View style={[styles.container, style]}>
        <RN.View style={styles.contentContainer}>
            {Icons[options.icon] && <RN.Image
				source={Icons[options.icon]}
				style={styles.icon}
			/>}
			<RN.View style={{ flexDirection: 'column' }}>
                <RN.Text style={styles.title}>
                    {options.title}
                </RN.Text>
                <RN.Text style={styles.content}>
                    {typeof options.content === 'function' 
                        ? React.createElement(options.content) 
                        : options.content}
                </RN.Text>
            </RN.View>
        </RN.View>
        <RN.TouchableOpacity
            style={styles.close}
            activeOpacity={0.5}
            onPress={leave}
        >
            <RN.Image
                source={Icons['ic_close']}
                style={styles.close}
            />
        </RN.TouchableOpacity>
    </Reanimated.default.View>;
}

const styles = StyleSheet.createThemedStyleSheet({
	container: {
        backgroundColor: Theme.colors.BACKGROUND_TERTIARY,
        marginHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        alignContent: 'center',
        flexDirection: 'row',
        alignSelf: 'center',
        borderRadius: 25,
        marginTop: 100,
        height: 55,
        width: 250,
        padding: 20,
        position: 'relative',
        zIndex: 2,
        ...Theme.shadows.SHADOW_BORDER
    },
    contentContainer: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    title: {
        fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
        color: Theme.colors.TEXT_NORMAL
    },
    content: {
        color: Theme.colors.TEXT_MUTED
    },
    icon: {
        width: 20,
        height: 20,
        marginRight: 15
    },
    progress: {

    },
    close: {
        width: 24,
        height: 24,
        justifyContent: 'flex-end',
        flex: 1,
        alignItems: 'flex-end',
        tintColor: Theme.colors.INTERACTIVE_NORMAL
    }
});

export default Toast;