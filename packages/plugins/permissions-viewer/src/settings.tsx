import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

import { SETTINGS, SORT_ORDER_LABELS } from '~/constants';
import { normalizeSortOrder } from '~/permissions/sort-order';

function SettingsPanel() {
	const settings = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<Discord.TableRadioGroup
				title='Permissions Sort Order'
				value={normalizeSortOrder(settings.get('sortOrder', SETTINGS.sortOrder))}
				onChange={(value: string) => settings.set('sortOrder', normalizeSortOrder(value))}
			>
				<Discord.TableRadioRow
					label={SORT_ORDER_LABELS.highest}
					subLabel='The highest role that has a permission is shown as granting it'
					value='highest'
				/>
				<Discord.TableRadioRow
					label={SORT_ORDER_LABELS.lowest}
					subLabel='The lowest role that has a permission is shown as granting it'
					value='lowest'
				/>
			</Discord.TableRadioGroup>
			<ui.Section title='Profiles'>
				<ui.SwitchRow
					label='Roles Card Button'
					subLabel='A View Permissions button under the roles on server profiles'
					value={settings.get('rolesCardButton', SETTINGS.rolesCardButton)}
					onValueChange={(value: boolean) => settings.set('rolesCardButton', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
