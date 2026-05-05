<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDuration } from '$lib/format';
	let { data, form } = $props();

	let now = $state(Date.now());
	let runningTaskId = $derived(data.running?.entry.taskId ?? null);
	let runningTaskInList = $derived(
		runningTaskId !== null && data.tasks.some((t) => t.id === runningTaskId)
	);
	let runningElapsedSec = $derived(
		data.running
			? Math.max(
					0,
					Math.floor((now - new Date(data.running.entry.startedAt).getTime()) / 1000)
				)
			: 0
	);
	let liveProjectTotalSec = $derived(
		data.projectTotalSec + (runningTaskInList ? runningElapsedSec : 0)
	);

	$effect(() => {
		if (!runningTaskInList) return;
		const id = setInterval(() => (now = Date.now()), 1_000);
		return () => clearInterval(id);
	});

	function commitRename(e: FocusEvent & { currentTarget: HTMLInputElement }) {
		const input = e.currentTarget;
		const next = input.value.trim();
		if (!next) {
			input.value = data.project.name;
			return;
		}
		if (next === data.project.name) return;
		input.form?.requestSubmit();
	}

	function onRenameKey(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === 'Enter') {
			e.preventDefault();
			e.currentTarget.blur();
		} else if (e.key === 'Escape') {
			e.currentTarget.value = data.project.name;
			e.currentTarget.blur();
		}
	}
</script>

<main class="mx-auto mt-6 max-w-2xl px-6 pb-16">
	<a
		href="/projects"
		class="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-100"
	>
		<span aria-hidden="true">←</span> Projects
	</a>

	<form method="POST" action="?/rename" use:enhance class="mt-3">
		<input
			name="name"
			value={data.project.name}
			required
			onblur={commitRename}
			onkeydown={onRenameKey}
			class="input-heading"
			class:opacity-50={data.project.archived}
		/>
	</form>
	{#if data.project.archived}
		<p class="mt-1 px-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">Archived</p>
	{/if}

	<div class="mt-8 mb-3 flex items-baseline justify-between">
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Tasks</h2>
		<span class="font-mono text-sm tabular-nums text-zinc-400">
			Total <span class="text-zinc-100">{formatDuration(liveProjectTotalSec * 1000)}</span>
		</span>
	</div>

	<form method="POST" action="?/createTask" use:enhance class="mb-4 flex gap-2">
		<input name="name" required placeholder="New task" class="input flex-1" />
		<button class="btn-primary">Add</button>
	</form>

	{#if form?.error}
		<p class="alert-error mb-3">{form.error}</p>
	{/if}

	<ul class="card divide-y divide-zinc-800 overflow-hidden">
		{#each data.tasks as t (t.id)}
			<li
				class="group flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-zinc-800/40"
				class:opacity-60={t.done}
			>
				<form method="POST" action="?/toggleDone" use:enhance>
					<input type="hidden" name="taskId" value={t.id} />
					<input type="hidden" name="done" value={(!t.done).toString()} />
					<button
						class={[
							'flex h-5 w-5 items-center justify-center rounded border transition',
							t.done
								? 'border-emerald-500 bg-emerald-500'
								: 'border-zinc-700 hover:border-zinc-500'
						]}
						aria-label={t.done ? 'Mark not done' : 'Mark done'}
					>
						{#if t.done}
							<svg
								class="h-3 w-3 text-white"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="3 8 7 12 13 4" />
							</svg>
						{/if}
					</button>
				</form>

				<a
					href="/projects/{data.project.id}/tasks/{t.id}"
					class="min-w-0 flex-1 truncate text-zinc-100 transition hover:text-white"
					class:line-through={t.done}
					class:text-zinc-500={t.done}
				>
					{t.name}
				</a>
				<span
					class="font-mono text-xs tabular-nums"
					class:text-emerald-300={runningTaskId === t.id}
					class:text-zinc-500={runningTaskId !== t.id}
				>
					{formatDuration(
						(data.totalSecByTask[t.id] ?? 0) * 1000 +
							(runningTaskId === t.id ? runningElapsedSec * 1000 : 0)
					)}
				</span>
				{#if runningTaskId === t.id}
					<form method="POST" action="?/stop" use:enhance>
						<button
							class="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/90 text-white shadow-sm shadow-rose-500/20 transition hover:bg-rose-400"
							aria-label="Stop timer"
							title="Stop timer"
						>
							<svg class="h-2.5 w-2.5" viewBox="0 0 8 8" fill="currentColor"
								><rect width="8" height="8" rx="1" /></svg
							>
						</button>
					</form>
				{:else}
					<form method="POST" action="?/start" use:enhance>
						<input type="hidden" name="taskId" value={t.id} />
						<button
							class="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/40 text-zinc-300 transition hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-300"
							aria-label="Start timer"
							title={data.running ? `Start (stops ${data.running.task.name})` : 'Start timer'}
						>
							<svg class="h-3 w-3" viewBox="0 0 8 8" fill="currentColor"
								><polygon points="0,0 8,4 0,8" /></svg
							>
						</button>
					</form>
				{/if}
			</li>
		{:else}
			<li class="px-4 py-8 text-center text-sm text-zinc-500">No tasks yet.</li>
		{/each}
	</ul>
</main>
