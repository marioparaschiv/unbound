import { Discord } from '@unbound-app/api/metro/components';
import { ScrollView } from 'react-native';

import GreetingRow from '~/components/greeting-row';

function Settings() {
	return (
		<ScrollView>
			<Discord.TableRowGroup title='General'>
				<GreetingRow />
			</Discord.TableRowGroup>
		</ScrollView>
	);
}

export default Settings;
