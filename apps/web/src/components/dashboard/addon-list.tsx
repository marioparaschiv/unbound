import AddonRow from '~/components/dashboard/addon-row';
import type { DashboardAddon } from '~/lib/dashboard';
import { Card } from '~/components/ui/card';

type AddonListProps = {
	addons: DashboardAddon[];
	userId: string;
	githubLinked: boolean;
};

function AddonList({ addons, userId, githubLinked }: AddonListProps) {
	return (
		<Card className='gap-0 py-0'>
			<ul className='divide-y'>
				{addons.map((addon) => (
					<AddonRow
						key={addon.id}
						addon={addon}
						userId={userId}
						githubLinked={githubLinked}
					/>
				))}
			</ul>
		</Card>
	);
}

export default AddonList;
