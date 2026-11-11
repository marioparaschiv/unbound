import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { TimelineVersion } from '~/ui/marketplace/version-entry';
import VersionEntry from '~/ui/marketplace/version-entry';
import PageCard from '~/ui/marketplace/page-card';
import { Discord } from '~/metro/components';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';

/** What an addon's and a loader release's skipped versions share. */
export type ChangelogEntry = TimelineVersion;

export type ChangelogProps = {
	name: string;
	icon: number | undefined;
	installed: string;
	offered: string;
	changelogs: ChangelogEntry[];
	children: ReactNode;
};

/**
 * @description One pending update: the version jump, every skipped version's changelog on the Marketplace's
 * timeline, and its action.
 */
function Changelog({ name, icon, installed, offered, changelogs, children }: ChangelogProps) {
	return (
		<Page>
			<Discord.TableRowGroup>
				<Discord.TableRow
					label={name}
					subLabel={`v${installed} → v${offered}`}
					icon={<Discord.TableRowIcon source={icon} />}
				/>
			</Discord.TableRowGroup>

			<PageCard title={messages.UNBOUND_UPDATES_CHANGELOG}>
				{changelogs.map((version, index) => (
					<VersionEntry
						key={version.version}
						version={version}
						latest={index === 0}
						last={index === changelogs.length - 1}
					/>
				))}
			</PageCard>

			<View>{children}</View>
		</Page>
	);
}

export default Changelog;
