import { storage, ui } from '@unbound-app/api';

import { TAGS } from '~/constants';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<ui.Section title='Tags'>
				{TAGS.map((tag) => (
					<ui.SwitchRow
						key={tag.name}
						label={tag.displayName}
						subLabel={tag.description}
						value={store.get(`tag.${tag.name}`, true)}
						onValueChange={(value: boolean) => store.set(`tag.${tag.name}`, value)}
					/>
				))}
			</ui.Section>
			<ui.Section title='Appearance'>
				<ui.SwitchRow
					label='Coloured Tags'
					subLabel='Give each tag its own colour instead of the default styling'
					value={store.get('coloredTags', true)}
					onValueChange={(value: boolean) => store.set('coloredTags', value)}
				/>
				<ui.SwitchRow
					label='Use Role Colour'
					subLabel="Colour tags with the member's role colour where they have one"
					value={store.get('useRoleColor', true)}
					onValueChange={(value: boolean) => store.set('useRoleColor', value)}
				/>
				<ui.SwitchRow
					label='Use Enhanced Role Colours'
					subLabel='Use gradient and holographic role colours across all generated tags when available'
					value={store.get('useEnhancedRoleColors', true)}
					onValueChange={(value: boolean) => store.set('useEnhancedRoleColors', value)}
				/>
				<ui.SwitchRow
					label='Use Original Poster Tag Style'
					subLabel='Show staff tags with Discord’s original poster badge styling'
					value={store.get('useOpTagStyle', false)}
					onValueChange={(value: boolean) => store.set('useOpTagStyle', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
