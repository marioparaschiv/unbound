function toastDuration(duration: number | undefined, configuredDuration: number): number {
	return duration ?? configuredDuration;
}

export default toastDuration;
