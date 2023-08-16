import { Theme, StyleSheet, React, ReactNative as RN } from '@metro/common';
import { Redesign } from '@metro/components';
import type { ViewStyle } from 'react-native';

export const { endStyle } = StyleSheet.createThemedStyleSheet({
    endStyle: {
        backgroundColor: Theme.colors.BACKGROUND_PRIMARY,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16
    }
})

interface TableRowGroupProps {
    children?: React.ReactNode,
    style?: ViewStyle;
    margin?: boolean;
    [k: PropertyKey]: any;
}

export default ({ children, style, margin = true, ...props }: TableRowGroupProps) => {
    return (
        <RN.ScrollView>
            <RN.View 
                style={[ 
                    style,
                    { 
                        marginHorizontal: 16,
                        ...margin ? { marginTop: 16 } : {}
                    }, 
                ]}
            >
                <Redesign.TableRowGroup {...props}>
                    {children}
                </Redesign.TableRowGroup>
            </RN.View>
        </RN.ScrollView>
    )
}