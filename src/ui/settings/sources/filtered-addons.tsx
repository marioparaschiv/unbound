import { GeneralSearch } from '@ui/components/search';
import { Addon } from '@ui/settings/sources/addon';
import { ReactNative as RN } from '@metro/common';
import Empty from '@ui/components/internal/empty';
import type { Manager } from '@typings/managers';
import type { Bundle } from '@managers/sources';
import { Redesign } from '@metro/components';
import { Strings } from '@api/i18n';

export function FilteredAddons({ addons }: { addons: Bundle }) {
	const [search, setSearch] = React.useState('');
	const navigation = Redesign.useNavigation();
	const data = React.useMemo(() => {
		if (!search) return addons;

		return addons.filter((addon) => {
			const fields = [addon.manifest.id, addon.manifest.name, addon.manifest.description, addon.type];
			return fields.some(x => x.toLowerCase().includes(search.toLowerCase()));
		});
	}, [search, addons]);

	return <RN.View style={{ marginHorizontal: 12, marginTop: 12 }}>
		<GeneralSearch
			type={Strings.UNBOUND_ADDONS.toLocaleLowerCase()}
			search={search}
			setSearch={setSearch}
		/>
		<RN.ScrollView
			style={{ height: '100%', marginTop: 16 }}
			contentContainerStyle={{ paddingBottom: 80 }}
		>
			{React.createElement(() => {
				const allAddonsOneType = data.every(addon => addon.type === addons[0].type);
				const addonTypes = React.useMemo(() => {
					const internal = new Set<Manager>();

					for (const addon of data) {
						internal.add(addon.type);
					}

					return [...internal.values()];
				}, [addons]);

				return allAddonsOneType ? (
					<Redesign.TableRowGroup>
						<RN.FlatList
							data={data}
							keyExtractor={(_, idx) => String(idx)}
							scrollEnabled={false}
							ItemSeparatorComponent={Redesign.TableRowDivider}
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
					</Redesign.TableRowGroup>
				) : (
					addonTypes.map(type => (
						<RN.View key={type} style={{ marginTop: 4 }}>
							<Redesign.TableRowGroup title={Strings[`UNBOUND_${type.toUpperCase()}`]}>
								<RN.FlatList
									data={data.filter(addon => addon.type === type)}
									keyExtractor={(_, idx) => String(idx)}
									scrollEnabled={false}
									ItemSeparatorComponent={Redesign.TableRowDivider}
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
							</Redesign.TableRowGroup>
						</RN.View>
					))
				);
			})}
		</RN.ScrollView>
	</RN.View>;
}