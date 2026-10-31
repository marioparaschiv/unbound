const TEST_FILE = /(^|\/)tests?\/|\.(test|spec|s3)\.[cm]?[jt]sx?$/;

/**
 * @description Tells whether a path belongs to a test suite, where fixtures and helpers sit outside the program's boundaries.
 * @param path The linted file's path.
 * @returns Whether the file is a test or a test helper.
 */
function isTestFile(path: string): boolean {
	return TEST_FILE.test(path);
}

export default isTestFile;
