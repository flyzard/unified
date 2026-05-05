export function formatDuration(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 60000));
	const h = Math.floor(total / 60);
	const m = total % 60;
	return `${h}:${m.toString().padStart(2, '0')}`;
}

export function durationMs(startedAt: string, endedAt: string | null): number {
	const s = new Date(startedAt).getTime();
	const e = endedAt ? new Date(endedAt).getTime() : Date.now();
	return e - s;
}
