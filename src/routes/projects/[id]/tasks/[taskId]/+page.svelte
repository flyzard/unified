<script lang="ts">
	import { enhance } from '$app/forms';
	import { durationMs, formatDuration } from '$lib/format';

	let { data, form } = $props();

	let descriptionEl: HTMLTextAreaElement | null = $state(null);

	function wrapSelection(before: string, after: string = before) {
		const el = descriptionEl;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const value = el.value;
		const selected = value.slice(start, end);
		el.value = value.slice(0, start) + before + selected + after + value.slice(end);
		el.focus();
		el.setSelectionRange(start + before.length, end + before.length);
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function prefixLines(prefix: string) {
		const el = descriptionEl;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const value = el.value;
		const lineStart = value.lastIndexOf('\n', start - 1) + 1;
		const head = value.slice(0, lineStart);
		const body = value.slice(lineStart, end);
		const tail = value.slice(end);
		const prefixed = body
			.split('\n')
			.map((l) => (l.length ? prefix + l : l))
			.join('\n');
		el.value = head + prefixed + tail;
		el.focus();
		el.setSelectionRange(start + prefix.length, end + (prefixed.length - body.length));
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function autoGrow(e: Event) {
		const el = e.currentTarget as HTMLTextAreaElement;
		el.style.height = 'auto';
		el.style.height = el.scrollHeight + 'px';
	}

	let now = $state(Date.now());
	let runningHere = $derived(data.running?.entry.taskId === data.task.id);
	let runningStartedMs = $derived(
		data.running ? new Date(data.running.entry.startedAt).getTime() : 0
	);
	$effect(() => {
		if (!runningHere) return;
		const id = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(id);
	});

	let startedAtLocal = $state('');
	let endedAtLocal = $state('');
	let startedAtIso = $derived(
		startedAtLocal ? new Date(startedAtLocal).toISOString() : ''
	);
	let endedAtIso = $derived(
		endedAtLocal ? new Date(endedAtLocal).toISOString() : ''
	);

	type Editing = {
		id: number;
		startLocal: string;
		endLocal: string;
		note: string;
		taskId: number;
	};
	let editing = $state<Editing | null>(null);
	let editStartIso = $derived(
		editing?.startLocal ? new Date(editing.startLocal).toISOString() : ''
	);
	let editEndIso = $derived(
		editing?.endLocal ? new Date(editing.endLocal).toISOString() : ''
	);

	function isoToLocal(iso: string): string {
		const d = new Date(iso);
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function startEdit(e: {
		id: number;
		startedAt: string;
		endedAt: string | null;
		note: string | null;
		taskId: number;
	}) {
		editing = {
			id: e.id,
			startLocal: isoToLocal(e.startedAt),
			endLocal: e.endedAt ? isoToLocal(e.endedAt) : '',
			note: e.note ?? '',
			taskId: e.taskId
		};
	}

	function cancelEdit() {
		editing = null;
	}

	function fmtDateTime(iso: string) {
		return new Date(iso).toLocaleString();
	}

	function pickerLabel(p: { projectName: string; projectArchived: boolean; name: string }) {
		const prefix = p.projectArchived ? '(archived) ' : '';
		return `${prefix}${p.projectName} / ${p.name}`;
	}
</script>

<main class="mx-auto mt-6 max-w-2xl p-6">
	<a href="/projects/{data.project.id}" class="text-sm text-blue-600">← {data.project.name}</a>
	<form method="POST" action="?/updateTask" use:enhance class="mt-2 grid gap-2">
		<input
			name="name"
			value={data.task.name}
			required
			class="rounded border px-3 py-2 text-2xl font-semibold"
			class:line-through={data.task.done}
		/>
		<div class="rounded border">
			<div class="flex gap-1 border-b bg-gray-50 px-2 py-1 text-sm">
				<button
					type="button"
					onclick={() => wrapSelection('**')}
					class="rounded px-2 py-0.5 font-bold hover:bg-gray-200"
					title="Bold (markdown)"
				>
					B
				</button>
				<button
					type="button"
					onclick={() => wrapSelection('*')}
					class="rounded px-2 py-0.5 italic hover:bg-gray-200"
					title="Italic (markdown)"
				>
					I
				</button>
				<button
					type="button"
					onclick={() => wrapSelection('`')}
					class="rounded px-2 py-0.5 font-mono hover:bg-gray-200"
					title="Code (markdown)"
				>
					{'<>'}
				</button>
				<button
					type="button"
					onclick={() => prefixLines('- ')}
					class="rounded px-2 py-0.5 hover:bg-gray-200"
					title="List (markdown)"
				>
					•
				</button>
				<button
					type="button"
					onclick={() => prefixLines('# ')}
					class="rounded px-2 py-0.5 hover:bg-gray-200"
					title="Heading (markdown)"
				>
					H
				</button>
			</div>
			<textarea
				bind:this={descriptionEl}
				oninput={autoGrow}
				name="description"
				rows="8"
				placeholder="Description (markdown supported)"
				class="block w-full resize-y px-3 py-2 text-sm focus:outline-none"
			>{data.task.description ?? ''}</textarea>
		</div>
		<button class="self-start rounded border px-3 py-1.5 text-sm">Save task</button>
	</form>
	<form
		method="POST"
		action="?/deleteTask"
		use:enhance={({ cancel }) => {
			if (!confirm(`Delete task "${data.task.name}"? This also removes its time entries.`)) {
				cancel();
			}
		}}
		class="mb-4 mt-2"
	>
		<button class="rounded border border-red-600 px-3 py-1.5 text-sm text-red-600">
			Delete task
		</button>
	</form>

	{#if runningHere}
		<section class="mb-6 rounded border border-green-600 bg-green-50 p-3">
			<div class="text-sm text-gray-600">Running</div>
			<div class="my-1 font-mono text-2xl">{formatDuration(now - runningStartedMs)}</div>
			<form method="POST" action="?/stop" use:enhance>
				<button class="rounded bg-red-600 px-3 py-1.5 text-sm text-white">Stop</button>
			</form>
		</section>
	{:else}
		<form method="POST" action="?/start" use:enhance class="mb-6">
			<button class="rounded bg-green-600 px-3 py-1.5 text-sm text-white">Start timer</button>
			{#if data.running}
				<span class="ml-2 text-sm text-gray-600">
					(stops {data.running.task.name})
				</span>
			{/if}
		</form>
	{/if}

	<h2 class="mb-2 text-lg font-semibold">Add manual entry</h2>
	<form method="POST" action="?/addEntry" use:enhance class="mb-6 grid gap-2">
		<input type="hidden" name="startedAt" value={startedAtIso} />
		<input type="hidden" name="endedAt" value={endedAtIso} />
		<div class="grid grid-cols-2 gap-2">
			<label class="flex flex-col text-sm">
				Start
				<input
					type="datetime-local"
					bind:value={startedAtLocal}
					required
					class="rounded border px-2 py-1"
				/>
			</label>
			<label class="flex flex-col text-sm">
				End
				<input
					type="datetime-local"
					bind:value={endedAtLocal}
					required
					class="rounded border px-2 py-1"
				/>
			</label>
		</div>
		<label class="flex flex-col text-sm">
			Note (optional)
			<textarea name="note" rows="2" class="rounded border px-2 py-1"></textarea>
		</label>
		<button class="self-start rounded bg-black px-3 py-2 text-white">Log entry</button>
		{#if form?.error}<p class="text-sm text-red-600">{form.error}</p>{/if}
	</form>

	<h2 class="mb-2 text-lg font-semibold">Entries</h2>
	<ul class="divide-y">
		{#each data.entries as e (e.id)}
			{#if editing?.id === e.id}
				<li class="py-3">
					<form
						method="POST"
						action="?/updateEntry"
						use:enhance={() =>
							async ({ result, update }) => {
								if (result.type === 'success') cancelEdit();
								await update();
							}}
						class="grid gap-2 text-sm"
					>
						<input type="hidden" name="id" value={e.id} />
						<input type="hidden" name="startedAt" value={editStartIso} />
						<input type="hidden" name="endedAt" value={editEndIso} />
						<label class="flex flex-col">
							Start
							<input
								type="datetime-local"
								bind:value={editing.startLocal}
								required
								class="rounded border px-2 py-1"
							/>
						</label>
						<label class="flex flex-col">
							End
							<input
								type="datetime-local"
								bind:value={editing.endLocal}
								required
								class="rounded border px-2 py-1"
							/>
						</label>
						<label class="flex flex-col">
							Task
							<select
								name="taskId"
								bind:value={editing.taskId}
								class="rounded border px-2 py-1"
							>
								{#each data.pickerTasks as p (p.id)}
									<option value={p.id}>{pickerLabel(p)}</option>
								{/each}
							</select>
						</label>
						<label class="flex flex-col">
							Note
							<textarea
								name="note"
								rows="2"
								bind:value={editing.note}
								class="rounded border px-2 py-1"
							></textarea>
						</label>
						<div class="flex gap-2">
							<button class="rounded bg-black px-3 py-1.5 text-white">Save</button>
							<button
								type="button"
								onclick={cancelEdit}
								class="rounded border px-3 py-1.5"
							>
								Cancel
							</button>
						</div>
					</form>
				</li>
			{:else}
				<li class="flex items-start justify-between py-2 text-sm">
					<div class="flex-1">
						<div class="flex justify-between gap-2">
							<span>{fmtDateTime(e.startedAt)}</span>
							<span class="font-mono">
								{e.endedAt ? formatDuration(durationMs(e.startedAt, e.endedAt)) : 'running'}
							</span>
						</div>
						{#if e.note}<p class="text-gray-600">{e.note}</p>{/if}
					</div>
					<div class="ml-3 flex flex-col gap-1">
						<button
							type="button"
							onclick={() => startEdit(e)}
							class="text-sm text-blue-600 hover:underline"
						>
							Edit
						</button>
						<form method="POST" action="?/deleteEntry" use:enhance>
							<input type="hidden" name="id" value={e.id} />
							<button class="text-sm text-red-600 hover:underline">Delete</button>
						</form>
					</div>
				</li>
			{/if}
		{:else}
			<li class="py-4 text-sm text-gray-500">No entries yet.</li>
		{/each}
	</ul>
</main>
