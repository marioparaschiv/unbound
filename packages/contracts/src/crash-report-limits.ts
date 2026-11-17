/** The most characters of the loader's log one crash report carries. */
export const CRASH_REPORT_LOG_LIMIT = 16_000;

/** The most breadcrumbs, enabled addons and injected libraries one report lists. */
export const CRASH_CONTEXT_LIMITS = { breadcrumbs: 40, addons: 300, injected: 40 } as const;

export default { CRASH_REPORT_LOG_LIMIT, CRASH_CONTEXT_LIMITS };
