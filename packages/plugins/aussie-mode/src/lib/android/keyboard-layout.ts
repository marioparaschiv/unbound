export function keyboardRotationOffset(
	baselineTop: number | undefined,
	currentTop: number | undefined,
): number | undefined {
	if (
		baselineTop === undefined ||
		currentTop === undefined ||
		!Number.isFinite(baselineTop) ||
		!Number.isFinite(currentTop)
	) {
		return;
	}

	return baselineTop - currentTop;
}
