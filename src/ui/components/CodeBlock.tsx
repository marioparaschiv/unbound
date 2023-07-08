import { Constants, StyleSheet, Theme, ReactNative as RN } from "@metro/common";
import { ViewStyle } from "react-native";

interface CodeblockProps {
    selectable?: boolean;
    children: string
    style?: ViewStyle;
}

const styles = StyleSheet.createThemedStyleSheet({
    block: {
        fontFamily: Constants.Fonts.CODE_SEMIBOLD,
        fontSize: 10,

        backgroundColor: Theme.colors.BACKGROUND_TERTIARY,
        color: Theme.colors.TEXT_NORMAL,
        
        padding: 10
    },
});

const IosBlock = ({ children, style, ...rest }) => (
    <RN.TextInput 
        value={children}
        style={[styles.block, style]}
        editable={false}
        multiline
        {...rest}
    />
)

const AndroidBlock = ({ selectable, children, style, ...rest }) => (
    <RN.Text
        children={children} 
        style={[styles.block, style]}
        selectable={selectable}
        {...rest}
    />
)

export default ({ selectable, children, style, ...rest }: CodeblockProps) => {
    if (!selectable) return (
        <AndroidBlock 
            selectable={selectable} 
            children={children} 
            style={style} 
            {...rest}
        />
    )

    return RN.Platform.select({
        ios: (
            <IosBlock
                children={children} 
                style={style} 
                {...rest}
            />
        ),
        default: (
            <AndroidBlock 
                selectable={selectable}
                children={children}
                style={style}
                {...rest}
            />
        )
    })
}