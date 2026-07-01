import { ScrollView } from 'react-native';

import { Discord } from '~/api/metro/components';
import { getIDByName } from '~/api/assets';
import { Messages } from '~/api/i18n';

/**
 * @description The main Unbound settings page. Stub harness — expanded in a later step.
 */
function GeneralPage() {
	return (
		<ScrollView>
			<Discord.TableRowGroup title={Messages.UNBOUND_GENERAL}>
				<Discord.TableRow
					label={Messages.UNBOUND_RESTART}
					icon={<Discord.TableRowIcon source={getIDByName('RetryIcon')} />}
				/>
			</Discord.TableRowGroup>
		</ScrollView>
	);
}

export default GeneralPage;
