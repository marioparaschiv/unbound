export type ChatInputLayout = {
	rootHeight: number;
	inputTop: number;
	inputHeight: number;
};

export function keyboardRotationOffset(
	before: ChatInputLayout | undefined,
	after: ChatInputLayout | undefined,
): number | undefined {
	if (!before || !after) return;

	const beforeTop = before.rootHeight - before.inputTop - before.inputHeight;
	const afterTop = after.rootHeight - after.inputTop - after.inputHeight;
	const offset = beforeTop - afterTop;

	return Number.isFinite(offset) ? offset : undefined;
}
