/**
 * @description A function that does nothing. Useful for patching to avoid creating a function in memory for each patch.
 */
function noop(...args: any): any {
	// No.
}

export default noop;