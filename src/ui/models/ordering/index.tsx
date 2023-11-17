import { TrailingIcon, resolveType } from '@ui/models/ordering/utilities';
import { ReactNative as RN, React, i18n } from '@metro/common';
import type { Addon, Manager } from '@typings/managers';
import { useSettingsStore } from '@api/storage';
import { Checkbox } from '@ui/components/form';

export { TrailingIcon, resolveType };

const radioItems = [
	{
		id: 'default',
		label: 'DEFAULT',
		icon: 'PencilSparkleIcon',

		ordering(addons: Addon[]) {
			return addons;
		}
	},
	{
		id: 'identifier',
		label: 'UNBOUND_IDENTIFIER',
		icon: 'feature_star',

		ordering(addons: Addon[]) {
			return addons.sort((a, b) => a.data.id.localeCompare(b.data.id));
		}
	},
	{
		id: 'name',
		label: 'UNBOUND_NAME',
		icon: 'ic_add_text',

		ordering(addons: Addon[]) {
			return addons.sort((a, b) => a.data.name.localeCompare(b.data.name));
		}
	},
	{
		id: 'description',
		label: 'UNBOUND_DESCRIPTION',
		icon: 'BookCheckIcon',

		ordering(addons: Addon[]) {
			return addons.sort((a, b) => a.data.description.localeCompare(b.data.description));
		}
	},
	{
		id: 'authors',
		label: 'UNBOUND_AUTHORS',
		icon: 'ic_group_dm',

		ordering(addons: Addon[]) {
			return addons.sort((a, b) => a.data.authors.join('').localeCompare(b.data.authors.join('')));
		}
	},
	{
		id: 'version',
		label: 'UNBOUND_VERSION',
		icon: 'ic_text_channel_16px',

		ordering(addons: Addon[]) {
			return addons.slice().sort((a, b) => {
				const versionA = a.data.version.split('.').map(Number);
				const versionB = b.data.version.split('.').map(Number);

				for (let i = 0; i < versionA.length; i++) {
					if (versionA[i] !== versionB[i]) {
						return versionA[i] - versionB[i];
					}
				}

				return 0;
			});
		}
	}
];

export default (entity: Manager | Fn<Manager>, settings: ReturnType<typeof useSettingsStore>) => [
	...radioItems.map(item => {
		const { icon, label, ...rest } = item;

		const extra = {
			IconComponent: () => <TrailingIcon
				selected={settings.get(`${resolveType(entity)}.order`, 'default') === item.id}
				source={icon}
			/>,

			action() {
				settings.set(`${resolveType(entity)}.order`, item.id);
			},

			get label() {
				return i18n.Messages[label];
			}
		};

		return {
			...rest,
			...extra
		};
	}),
	{
		id: 'reversed',
		label: 'Reversed',
		IconComponent: () => {
			// Requires its own independent setting store declaration or it won't re-render
			const settings = useSettingsStore('unbound');

			return <RN.TouchableOpacity
				onPress={() => settings.toggle(`${resolveType(entity)}.reversed`, false)}
				style={{ transform: [{ scale: 0.8 }, { translateX: 2 }] }}
			>
				<Checkbox.FormCheckbox
					checked={settings.get(`${resolveType(entity)}.reversed`, false)}
				/>
			</RN.TouchableOpacity>;
		},

		action() {
			settings.toggle(`${resolveType(entity)}.reversed`, false);
		},

		ordering(addons: Addon[]) {
			return addons;
		}
	}
];