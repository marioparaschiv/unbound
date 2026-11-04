import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

import { layoutChoice, sortOrderChoice } from '~/defaults';
import { SETTINGS } from '~/constants';

function SettingsPanel() {
	const settings = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<Discord.TableRadioGroup
				title='Default Layout'
				value={layoutChoice(settings.get('defaultLayout', SETTINGS.defaultLayout))}
				onChange={(value: string) => settings.set('defaultLayout', layoutChoice(value))}
			>
				<Discord.TableRadioRow label='List' subLabel='Posts in a list' value='list' />
				<Discord.TableRadioRow
					label='Gallery'
					subLabel='Posts in a grid of cards'
					value='gallery'
				/>
			</Discord.TableRadioGroup>
			<Discord.TableRadioGroup
				title='Default Sort Order'
				value={sortOrderChoice(settings.get('defaultSortOrder', SETTINGS.defaultSortOrder))}
				onChange={(value: string) =>
					settings.set('defaultSortOrder', sortOrderChoice(value))
				}
			>
				<Discord.TableRadioRow
					label='Recently Active'
					subLabel='Posts with the newest messages first'
					value='recentlyActive'
				/>
				<Discord.TableRadioRow
					label='Date Posted'
					subLabel='The newest posts first'
					value='datePosted'
				/>
			</Discord.TableRadioGroup>
		</ui.Page>
	);
}

export default SettingsPanel;
