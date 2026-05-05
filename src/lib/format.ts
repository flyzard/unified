export function formatDuration(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${h}:${pad(m)}:${pad(s)}`;
}

export function durationMs(startedAt: string, endedAt: string | null): number {
	const s = new Date(startedAt).getTime();
	const e = endedAt ? new Date(endedAt).getTime() : Date.now();
	return e - s;
}
