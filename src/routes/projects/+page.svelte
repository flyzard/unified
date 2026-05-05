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

<main class="mx-auto mt-6 max-w-2xl p-6">
	{#if data.running}
		<section class="mb-6 rounded border-2 border-green-600 bg-green-50 p-4">
			<div class="text-sm text-gray-600">Running</div>
			<div class="font-medium">
				<a href="/projects/{data.running.project.id}" class="hover:underline"
					>{data.running.project.name}</a
				>
				/
				<a
					href="/projects/{data.running.project.id}/tasks/{data.running.task.id}"
					class="hover:underline">{data.running.task.name}</a
				>
			</div>
			<div class="my-2 font-mono text-3xl">
				{formatDuration(now - runningStartedMs)}
			</div>
			<form method="POST" action="?/stop" use:enhance>
				<button class="rounded bg-red-600 px-3 py-1.5 text-sm text-white">Stop</button>
			</form>
		</section>
	{/if}

	<h1 class="mb-4 text-2xl font-semibold">Projects</h1>

	<form method="POST" action="?/create" use:enhance class="mb-6 flex gap-2">
		<input
			name="name"
			required
			placeholder="New project name"
			class="min-w-0 flex-1 rounded border px-3 py-2"
		/>
		<button class="rounded bg-black px-3 py-2 text-white">Create</button>
	</form>

	{#if form?.error}<p class="mb-4 text-sm text-red-600">{form.error}</p>{/if}

	<ul class="divide-y">
		{#each data.projects as p (p.id)}
			<li class="flex items-center justify-between py-2" class:opacity-50={p.archived}>
				<a href="/projects/{p.id}" class="hover:underline">{p.name}</a>
				<form method="POST" action="?/archive" use:enhance>
					<input type="hidden" name="id" value={p.id} />
					<input type="hidden" name="archived" value={(!p.archived).toString()} />
					<button class="text-sm text-gray-600 hover:underline">
						{p.archived ? 'Unarchive' : 'Archive'}
					</button>
				</form>
			</li>
		{:else}
			<li class="py-4 text-sm text-gray-500">No projects yet.</li>
		{/each}
	</ul>
</main>
