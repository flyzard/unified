<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDuration } from '$lib/format';
	let { data, form } = $props();

	let projectName = $state(data.project.name);
	let renameForm: HTMLFormElement | null = $state(null);
	$effect(() => {
		projectName = data.project.name;
	});

	function commitRename() {
		const next = projectName.trim();
		if (!next) {
			projectName = data.project.name;
			return;
		}
		if (next === data.project.name) return;
		renameForm?.requestSubmit();
	}
</script>

<main class="mx-auto mt-6 max-w-2xl p-6">
	<a href="/projects" class="text-sm text-blue-600">← Projects</a>

	<form
		method="POST"
		action="?/rename"
		use:enhance
		bind:this={renameForm}
		class="mt-2"
	>
		<input
			name="name"
			bind:value={projectName}
			required
			onblur={commitRename}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					(e.currentTarget as HTMLInputElement).blur();
				} else if (e.key === 'Escape') {
					projectName = data.project.name;
					(e.currentTarget as HTMLInputElement).blur();
				}
			}}
			class="w-full rounded border border-transparent px-3 py-2 text-2xl font-semibold hover:border-gray-300 focus:border-gray-500 focus:outline-none"
			class:opacity-50={data.project.archived}
		/>
	</form>
	{#if data.project.archived}
		<p class="mt-1 text-sm text-gray-500">Archived</p>
	{/if}

	<div class="mt-8 mb-3 flex items-baseline justify-between">
		<h2 class="text-lg font-semibold">Tasks</h2>
		<span class="font-mono text-sm text-gray-600">
			Total: {formatDuration(data.projectTotalSec * 1000)}
		</span>
	</div>

	<form method="POST" action="?/createTask" use:enhance class="mb-4 flex gap-2">
		<input
			name="name"
			required
			placeholder="New task"
			class="flex-1 rounded border px-3 py-2"
		/>
		<button class="rounded bg-black px-3 py-2 text-white">Add</button>
	</form>

	{#if form?.error}<p class="mb-3 text-sm text-red-600">{form.error}</p>{/if}

	<ul class="divide-y">
		{#each data.tasks as t (t.id)}
			<li
				class="flex flex-wrap items-center gap-2 py-2"
				class:opacity-50={t.done}
			>
				<form method="POST" action="?/toggleDone" use:enhance>
					<input type="hidden" name="taskId" value={t.id} />
					<input type="hidden" name="done" value={(!t.done).toString()} />
					<button
						class="h-5 w-5 rounded border"
						class:bg-black={t.done}
						aria-label={t.done ? 'Mark not done' : 'Mark done'}
					></button>
				</form>

				<a
					href="/projects/{data.project.id}/tasks/{t.id}"
					class="min-w-0 flex-1 truncate text-blue-600 hover:underline"
					class:line-through={t.done}
				>
					{t.name}
				</a>
				<span class="font-mono text-xs text-gray-500">
					{formatDuration((data.totalSecByTask[t.id] ?? 0) * 1000)}
				</span>
			</li>
		{:else}
			<li class="py-4 text-sm text-gray-500">No tasks yet.</li>
		{/each}
	</ul>
</main>
