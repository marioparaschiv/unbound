const STAGING_ROOT = 'Unbound/Staging';

/**
 * @description Names the folder an addon's next version is written to before it replaces the installed one, outside the
 * folders the loader scans so a half-written copy never loads.
 * @param directory The addon's folder, such as `Unbound/Plugins/<id>`.
 * @returns The staging folder, such as `Unbound/Staging/Plugins/<id>`.
 */
export function stagingDirectoryOf(directory: string): string {
	return `${STAGING_ROOT}/${directory.replace(/^Unbound\//, '')}`;
}

export default { stagingDirectoryOf };
