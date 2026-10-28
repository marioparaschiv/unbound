import { staggerStyle } from '~/components/motion/reveal-style';
import type { Developer, TeamGroup } from '~/lib/developers';
import DeveloperCard from '~/components/developer-card';
import type { CssVariables } from '~/lib/css-variables';
import Text from '~/components/ui/text';

import TEAM_GROUPS from './team-groups';

type TeamSectionsProps = {
	/** Already sorted by group, so each group is one consecutive run. */
	developers: Developer[];
};

type Section = {
	group: TeamGroup;
	developers: Developer[];
};

const GRID_STYLE: CssVariables = { '--col-width': '300px' };

function toSections(developers: Developer[]): Section[] {
	const sections: Section[] = [];

	for (const developer of developers) {
		const last = sections.at(-1);

		if (last?.group === developer.group) {
			last.developers.push(developer);

			continue;
		}

		sections.push({ group: developer.group, developers: [developer] });
	}

	return sections;
}

/** The Team page's grouped grids, one headed section per group present. */
function TeamSections({ developers }: TeamSectionsProps) {
	return (
		<div className='flex flex-col gap-8'>
			{toSections(developers).map((section) => (
				<section key={section.group} className='flex flex-col gap-3'>
					<Text as='h2' variant='heading-sm'>
						{TEAM_GROUPS[section.group].heading}
					</Text>
					<div style={GRID_STYLE} className='fill-grid gap-3'>
						{section.developers.map((developer, index) => (
							<DeveloperCard
								developer={developer}
								key={developer.author.discordId}
								className='animate-reveal'
								style={staggerStyle(index)}
							/>
						))}
					</div>
				</section>
			))}
		</div>
	);
}

export default TeamSections;
