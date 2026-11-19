const ISSUE_NUMBER = /^[1-9]\d{0,8}$/;

/**
 * @description Builds the GitHub URL of a crash issue from the short link's number.
 * @param repository The crash issues repository, as `owner/name`.
 * @param number The issue number from the short link.
 * @returns The issue's URL, or `undefined` when the number is not a plain issue number.
 */
export function crashIssueUrl(repository: string, number: string): string | undefined {
	return ISSUE_NUMBER.test(number)
		? `https://github.com/${repository}/issues/${number}`
		: undefined;
}

export default crashIssueUrl;
