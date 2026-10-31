import { Discord } from '@unbound-app/api/metro/components';
import { storage } from '@unbound-app/api';

import { GREET_ON_START, SETTINGS_BUCKET } from '~/constants';

function GreetingRow() {
	const settings = storage.useBucket(SETTINGS_BUCKET);

	return (
		<Discord.TableSwitchRow
			label='Greet on start'
			subLabel='Show a greeting when the plugin starts.'
			value={settings.get(GREET_ON_START, true)}
			onValueChange={(value: boolean) => settings.set(GREET_ON_START, value)}
		/>
	);
}

export default GreetingRow;
