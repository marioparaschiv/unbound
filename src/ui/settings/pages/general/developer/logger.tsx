import { ReactNative as RN, React, StyleSheet, Constants, Moment, Theme, i18n } from '@metro/common';
import { Redesign, Navigation } from '@metro/components';
import { Icons } from '@api/assets';
import Logger from '@stores/logger';
import { TableRowGroupWrapper } from '@ui/components';
import AdvancedSearch, { useAdvancedSearch } from '@ui/components/AdvancedSearch';

const searchContext = { type: "LOGGER" };
const levelSelection = {
    variant(level: number) {
        return ['muted', 'normal', 'warning', 'danger'][level]
    },

    icon(level: number) {
        return ['ic_settings', 'ic_chat_bubble_16px', 'ic_warning_24px', 'failure-header'][level]
    }
}

export default function () {
	const navigation = Navigation.useNavigation();
	const store = Logger.useStore();
    const [query, controls] = useAdvancedSearch(searchContext)

    const data = React.useMemo(() => store.logs
        .filter(item => item.message?.toLowerCase()?.includes(query))
        .sort((a, b) => a.time - b.time), [query])
    const unsubscribe = navigation.addListener('focus', () => {
        unsubscribe();
        navigation.setOptions({ headerRight: HeaderRight });
    });

	return <RN.View>
        <RN.View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <AdvancedSearch 
                searchContext={searchContext}
                controls={controls}
            />
        </RN.View>
        <TableRowGroupWrapper style={{ flex: 1, marginBottom: 16 }} margin={false}>
            <RN.FlatList
                data={data}
                keyExtractor={(_, idx) => String(idx)}
                scrollEnabled={false}
                ListEmptyComponent={<RN.View style={styles.empty}>
                    <RN.Image
                        style={styles.emptyImage}
                        source={Icons['img_connection_empty_dark']}
                    />
                    <RN.Text style={styles.emptyMessage}>
                        {i18n.Messages.UNBOUND_LOGS_EMPTY}
                    </RN.Text>
                </RN.View>}
                renderItem={({ item }) => {
                    return <Redesign.TableRow
                        label={item.message}
                        subLabel={Moment(item.time).format('HH:mm:ss.SSS')}
                        variant={levelSelection.variant(item.level)}
                        icon={<Redesign.TableRowIcon source={Icons[levelSelection.icon(item.level)]} />}
                    />;
                }}
            />
        </TableRowGroupWrapper>
    </RN.View>
}

const styles = StyleSheet.createThemedStyleSheet({
	touchable: {
		marginRight: 10
	},
	image: {
		tintColor: Theme.colors.TEXT_NORMAL
	},
	empty: {
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: '50%'
	},
	emptyImage: {
		marginBottom: 10
	},
	emptyMessage: {
		color: Theme.colors.TEXT_MUTED,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		textAlign: 'center',
		paddingHorizontal: 25
	}
});

function HeaderRight() {
	return <RN.TouchableOpacity
		style={styles.touchable}
		onPress={() => Logger.store.setState({ logs: [] })}
	>
		<RN.Image
			style={styles.image}
			source={Icons['ic_input_clear_24px']}
		/>
	</RN.TouchableOpacity>;
}