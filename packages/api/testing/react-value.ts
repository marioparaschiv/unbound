// UNKNOWN: React hands the test renderer whatever the component under test gives it: state, props, refs and children.
/** A value React passes through the test renderer's hooks and renders, typed by the component, not by the renderer. */
export type ReactValue = unknown;
