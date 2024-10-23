import { ScrollView, View, FlatList } from 'react-native';
import { createElement, useMemo, useState } from 'react';
import type { Manager } from '@typings/managers';
import type { Bundle } from '@managers/sources';
import { GeneralSearch } from '@ui/misc/search';
import { Discord } from '@api/metro/components';
import { Addon } from '@ui/sources/addon';
import Empty from '@ui/misc/empty-state';
import { Strings } from '@api/i18n';

import useStyles from './filtered-addons.style';

export function FilteredAddons({ addons }: { addons: Bundle; }) {
	const [search, setSearch] = useState('');
	const navigation = Discord.useNavigation();
	const styles = useStyles();

	const data = useMemo(() => {
		if (!search) return addons;

		return addons.filter((addon) => {
			const fields = [addon.manifest.id, addon.manifest.name, addon.manifest.description, addon.type];
			return fields.some(x => x.toLowerCase().includes(search.toLowerCase()));
		});
	}, [search, addons]);

	return <View style={styles.container}>
		<GeneralSearch
			type={Strings.UNBOUND_ADDONS.toLocaleLowerCase()}
			search={search}
			setSearch={setSearch}
		/>
		<ScrollView
			style={styles.scrollView}
			contentContainerStyle={styles.contentContainer}
		>
			{createElement(() => {
				const allAddonsOneType = data.every(addon => addon.type === addons[0].type);
				const addonTypes = useMemo(() => {
					const internal = new Set<Manager>();

					for (const addon of data) {
						internal.add(addon.type);
					}

					return [...internal.values()];
				}, [addons]);

				return allAddonsOneType ? (
					<Discord.TableRowGroup>
						<FlatList
							data={data}
							keyExtractor={(_, idx) => String(idx)}
							scrollEnabled={false}
							ItemSeparatorComponent={Discord.TableRowDivider}
							renderItem={({ item: addon }) => (
								<Addon
									key={addon.manifest.id}
									addon={addon}
									navigation={navigation}
								/>
							)}
							ListEmptyComponent={(
								<Empty>
									{Strings.UNBOUND_SOURCE_EMPTY}
								</Empty>
							)}
						/>
					</Discord.TableRowGroup>
				) : (
					addonTypes.map(type => (
						<View key={type} style={styles.addonTypeContainer}>
							<Discord.TableRowGroup title={Strings[`UNBOUND_${type.toUpperCase()}`]}>
								<FlatList
									data={data.filter(addon => addon.type === type)}
									keyExtractor={(_, idx) => String(idx)}
									scrollEnabled={false}
									ItemSeparatorComponent={Discord.TableRowDivider}
									renderItem={({ item: addon }) => (
										<Addon
											key={addon.manifest.id}
											addon={addon}
											navigation={navigation}
										/>
									)}
									ListEmptyComponent={(
										<Empty>
											{Strings.UNBOUND_SOURCE_EMPTY}
										</Empty>
									)}
								/>
							</Discord.TableRowGroup>
						</View>
					))
				);
			})}
		</ScrollView>
	</View>;
}