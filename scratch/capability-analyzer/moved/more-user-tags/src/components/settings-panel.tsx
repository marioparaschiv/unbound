import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';

import { settings } from '~/modules';
import { TAGS } from '~/constants';

function SettingsPanel() {
	const store = settings.useSettingsStore();

	return (
		<Page>
			<Discord.TableRowGroup title='Tags'>
				{TAGS.map((tag) => (
					<Discord.TableSwitchRow
						key={tag.name}
						label={tag.displayName}
						subLabel={tag.description}
						value={store.get(`tag.${tag.name}`, true)}
						onValueChange={(value: boolean) => store.set(`tag.${tag.name}`, value)}
					/>
				))}
			</Discord.TableRowGroup>
			<Discord.TableRowGroup title='Appearance'>
				<Discord.TableSwitchRow
					label='Coloured Tags'
					subLabel='Give each tag its own colour instead of the default styling'
					value={store.get('coloredTags', true)}
					onValueChange={(value: boolean) => store.set('coloredTags', value)}
				/>
				<Discord.TableSwitchRow
					label='Use Role Colour'
					subLabel="Colour tags with the member's role colour where they have one"
					value={store.get('useRoleColor', true)}
					onValueChange={(value: boolean) => store.set('useRoleColor', value)}
				/>
				<Discord.TableSwitchRow
					label='Use Enhanced Role Colours'
					subLabel='Use gradient and holographic role colours across all generated tags when available'
					value={store.get('useEnhancedRoleColors', true)}
					onValueChange={(value: boolean) => store.set('useEnhancedRoleColors', value)}
				/>
				<Discord.TableSwitchRow
					label='Use Original Poster Tag Style'
					subLabel='Show staff tags with Discord’s original poster badge styling'
					value={store.get('useOpTagStyle', false)}
					onValueChange={(value: boolean) => store.set('useOpTagStyle', value)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
