<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDuration } from '$lib/format';

	let { data, form } = $props();

	let now = $state(Date.now());
	let runningStartedMs = $derived(
		data.running ? new Date(data.running.entry.startedAt).getTime() : 0
	);
	$effect(() => {
		if (!data.running) return;
		const id = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(id);
	});
</script>

<main class="mx-auto mt-6 max-w-2xl px-6 pb-16">
	{#if data.running}
		<section
			class="card relative mb-8 overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5"
		>
			<div class="flex items-center gap-2 text-xs font-medium tracking-wide text-emerald-300 uppercase">
				<span class="relative flex h-2 w-2">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
					></span>
					<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
				</span>
				Running
			</div>
			<div class="mt-2 text-sm text-zinc-300">
				<a
					href="/projects/{data.running.project.id}"
					class="text-zinc-200 transition hover:text-white hover:underline"
					>{data.running.project.name}</a
				>
				<span class="text-zinc-600">/</span>
				<a
					href="/projects/{data.running.project.id}/tasks/{data.running.task.id}"
					class="font-medium text-zinc-100 transition hover:text-white hover:underline"
					>{data.running.task.name}</a
				>
			</div>
			<div class="mt-2 mb-4 font-mono text-4xl tracking-tight text-emerald-200 tabular-nums">
				{formatDuration(now - runningStartedMs)}
			</div>
			<form method="POST" action="?/stop" use:enhance>
				<button class="btn-danger">
					<svg class="h-3 w-3" viewBox="0 0 8 8" fill="currentColor"><rect width="8" height="8" rx="1"/></svg>
					Stop
				</button>
			</form>
		</section>
	{/if}

	<h1 class="mb-6 text-2xl font-semibold tracking-tight text-zinc-50">Projects</h1>

	<form method="POST" action="?/create" use:enhance class="mb-6 flex gap-2">
		<input name="name" required placeholder="New project name" class="input flex-1" />
		<button class="btn-primary">Create</button>
	</form>

	{#if form?.error}
		<p class="alert-error mb-4">{form.error}</p>
	{/if}

	<ul class="card divide-y divide-zinc-800 overflow-hidden">
		{#each data.projects as p (p.id)}
			<li
				class="group flex items-center justify-between px-4 py-3 transition hover:bg-zinc-800/40"
				class:opacity-50={p.archived}
			>
				<a
					href="/projects/{p.id}"
					class="min-w-0 flex-1 truncate text-zinc-100 transition hover:text-white"
				>
					{p.name}
					{#if p.archived}
						<span
							class="ml-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-400 uppercase"
						>
							archived
						</span>
					{/if}
				</a>
				<form method="POST" action="?/archive" use:enhance>
					<input type="hidden" name="id" value={p.id} />
					<input type="hidden" name="archived" value={(!p.archived).toString()} />
					<button
						class="text-xs text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:text-zinc-200 focus:opacity-100"
					>
						{p.archived ? 'Unarchive' : 'Archive'}
					</button>
				</form>
			</li>
		{:else}
			<li class="px-4 py-8 text-center text-sm text-zinc-500">No projects yet.</li>
		{/each}
	</ul>
</main>
