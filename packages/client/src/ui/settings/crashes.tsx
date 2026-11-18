import { useEffect, useState } from 'react';

import {
	clearCrashHistory,
	readCrashHistory,
	type CrashIssueLink,
	type CrashRecord,
} from '~/diagnostics/crash-history';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import CrashRow from './crash-row';

/**
 * @description The crashes this install saw, newest first, with the plugin each one blamed and a button to disable it.
 */
function CrashesPage() {
	const [records, setRecords] = useState<CrashRecord[]>([]);
	const [, setRevision] = useState(0);

	useEffect(() => {
		void readCrashHistory().then((history) => setRecords(history.toReversed()));
	}, []);

	function disable(id: string) {
		Manager.for('plugin').disable(id);
		setRevision((revision) => revision + 1);
	}

	function linked(at: number, issue: CrashIssueLink) {
		setRecords((current) =>
			current.map((record) => (record.at === at ? { ...record, issue } : record)),
		);
	}

	async function clear() {
		await clearCrashHistory();
		setRecords([]);
	}

	return (
		<Page>
			<Discord.TableRowGroup>
				{records.length ? (
					records.map((record) => (
						<CrashRow
							key={`${record.at}:${record.message}`}
							record={record}
							onDisable={disable}
							onLinked={linked}
						/>
					))
				) : (
					<Discord.TableRow label={messages.UNBOUND_NO_CRASHES} />
				)}
			</Discord.TableRowGroup>
			{records.length ? (
				<Discord.TableRowGroup>
					<Discord.TableRow
						label={messages.UNBOUND_CRASH_CLEAR}
						icon={<Discord.TableRowIcon source={icons.TrashIcon} />}
						onPress={() => void clear()}
					/>
				</Discord.TableRowGroup>
			) : null}
		</Page>
	);
}

export default CrashesPage;
