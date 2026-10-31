/** Team page sections, in display order. A person appears once, in their highest group. */
export const TEAM_GROUPS = ['development-team', 'staff', 'contributor', 'addon-developer'] as const;

export type TeamGroup = (typeof TEAM_GROUPS)[number];

export default { TEAM_GROUPS };
