/** Relational filter for the versions an addon can serve: the ones no rollback withdrew. */
export const LIVE_VERSIONS = { withdrawnBy: { isNull: true } } as const;

export default { LIVE_VERSIONS };
