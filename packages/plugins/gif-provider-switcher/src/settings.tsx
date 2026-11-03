import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

import { normalizeProvider } from '~/providers/selection';
import { DEFAULT_PROVIDER } from '~/constants';

function SettingsPanel() {
	const settings = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<Discord.TableRadioGroup
				title='Provider'
				value={normalizeProvider(settings.get<string>('provider', DEFAULT_PROVIDER))}
				onChange={(value: string) => settings.set('provider', normalizeProvider(value))}
			>
				<Discord.TableRadioRow
					label='Tenor'
					subLabel='Search GIFs on Tenor'
					value='tenor'
				/>
				<Discord.TableRadioRow
					label='Giphy'
					subLabel='Search GIFs on Giphy'
					value='giphy'
				/>
				<Discord.TableRadioRow
					label='Klipy'
					subLabel="Discord's own GIF search"
					value='klipy'
				/>
			</Discord.TableRadioGroup>
		</ui.Page>
	);
}

export default SettingsPanel;
