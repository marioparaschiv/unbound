import type { TeamGroup } from '~/lib/developers';

type TeamGroupLabels = {
	/** The section heading on the Team page. */
	heading: string;
	/** One member's tag. */
	member: string;
};

export const TEAM_GROUPS: Record<TeamGroup, TeamGroupLabels> = {
	'development-team': { heading: 'Development Team', member: 'Development Team' },
	staff: { heading: 'Staff', member: 'Staff' },
	contributor: { heading: 'Contributors', member: 'Contributor' },
	'addon-developer': { heading: 'Addon Developers', member: 'Addon Developer' },
};

export default TEAM_GROUPS;
