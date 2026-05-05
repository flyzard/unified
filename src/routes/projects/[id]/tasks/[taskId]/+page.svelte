<script lang="ts">
	import { enhance } from '$app/forms';
	import { durationMs, formatDuration } from '$lib/format';

	let { data, form } = $props();

	let descriptionEl: HTMLTextAreaElement | null = $state(null);

	function fitHeight(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = el.scrollHeight + 'px';
	}

	$effect(() => {
		void data.task.description;
		if (descriptionEl) fitHeight(descriptionEl);
	});

	function wrapSelection(before: string, after: string = before) {
		const el = descriptionEl;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		el.focus();
		el.setRangeText(before + el.value.slice(start, end) + after, start, end, 'select');
		el.setSelectionRange(start + before.length, end + before.length);
		fitHeight(el);
	}

	function prefixLines(prefix: string) {
		const el = descriptionEl;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const lineStart = el.value.lastIndexOf('\n', start - 1) + 1;
		const body = el.value.slice(lineStart, end);
		const prefixed = body
			.split('\n')
			.map((l) => (l.length ? prefix + l : l))
			.join('\n');
		el.focus();
		el.setRangeText(prefixed, lineStart, end, 'preserve');
		el.setSelectionRange(start + prefix.length, end + (prefixed.length - body.length));
		fitHeight(el);
	}

	function autoGrow(e: Event) {
		fitHeight(e.currentTarget as HTMLTextAreaElement);
	}

	let now = $state(Date.now());
	let runningHere = $derived(data.running?.entry.taskId === data.task.id);
	let runningStartedMs = $derived(
		data.running ? new Date(data.running.entry.startedAt).getTime() : 0
	);
	let runningElapsedSec = $derived(
		runningHere ? Math.max(0, Math.floor((now - runningStartedMs) / 1000)) : 0
	);
	let liveTotalSec = $derived(data.totalSec + runningElapsedSec);
	$effect(() => {
		if (!runningHere) return;
		const id = setInterval(() => (now = Date.now()), 1_000);
		return () => clearInterval(id);
	});

	let startedAtLocal = $state('');
	let endedAtLocal = $state('');
	let startedAtIso = $derived(startedAtLocal ? new Date(startedAtLocal).toISOString() : '');
	let endedAtIso = $derived(endedAtLocal ? new Date(endedAtLocal).toISOString() : '');

	type Editing = {
		id: number;
		startLocal: string;
		endLocal: string;
		note: string;
		taskId: number;
	};
	let editing = $state<Editing | null>(null);
	let editStartIso = $derived(editing?.startLocal ? new Date(editing.startLocal).toISOString() : '');
	let editEndIso = $derived(editing?.endLocal ? new Date(editing.endLocal).toISOString() : '');

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

<main class="mx-auto mt-6 max-w-2xl px-6 pb-16">
	<a
		href="/projects/{data.project.id}"
		class="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-100"
	>
		<span aria-hidden="true">←</span>
		{data.project.name}
	</a>

	<form method="POST" action="?/updateTask" use:enhance class="mt-3 grid gap-4">
		<input
			name="name"
			value={data.task.name}
			required
			class="input-heading"
			class:line-through={data.task.done}
			class:text-zinc-500={data.task.done}
		/>

		<div class="flex flex-wrap items-center justify-between gap-3 px-3">
			<div class="flex items-baseline gap-3 text-sm">
				<span class="font-mono text-2xl tracking-tight tabular-nums text-zinc-100">
					{formatDuration(liveTotalSec * 1000)}
				</span>
				<span class="text-zinc-500">
					{data.entryCount}
					{data.entryCount === 1 ? 'entry' : 'entries'}
				</span>
				{#if runningHere}
					<span
						class="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-emerald-300 uppercase"
					>
						<span class="relative flex h-2 w-2">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
							></span>
							<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
						</span>
						<span class="font-mono tabular-nums text-emerald-200">
							+{formatDuration(runningElapsedSec * 1000)}
						</span>
					</span>
				{/if}
			</div>
			{#if runningHere}
				<button type="submit" formaction="?/stop" class="btn-danger">
					<svg class="h-3 w-3" viewBox="0 0 8 8" fill="currentColor"
						><rect width="8" height="8" rx="1" /></svg
					>
					Stop
				</button>
			{:else}
				<button
					type="submit"
					formaction="?/start"
					class="btn-success"
					title={data.running ? `Starts after stopping ${data.running.task.name}` : 'Start timer'}
				>
					<svg class="h-3 w-3" viewBox="0 0 8 8" fill="currentColor"
						><polygon points="0,0 8,4 0,8" /></svg
					>
					Start timer
				</button>
			{/if}
		</div>

		<div class="card overflow-hidden">
			<div class="flex gap-1 border-b border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-sm">
				<button
					type="button"
					onclick={() => wrapSelection('**')}
					class="rounded px-2 py-0.5 font-bold text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
					title="Bold (markdown)"
				>
					B
				</button>
				<button
					type="button"
					onclick={() => wrapSelection('*')}
					class="rounded px-2 py-0.5 italic text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
					title="Italic (markdown)"
				>
					I
				</button>
				<button
					type="button"
					onclick={() => wrapSelection('`')}
					class="rounded px-2 py-0.5 font-mono text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
					title="Code (markdown)"
				>
					{'<>'}
				</button>
				<button
					type="button"
					onclick={() => prefixLines('- ')}
					class="rounded px-2 py-0.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
					title="List (markdown)"
				>
					•
				</button>
				<button
					type="button"
					onclick={() => prefixLines('# ')}
					class="rounded px-2 py-0.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
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
				class="block w-full resize-y bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
			>{data.task.description ?? ''}</textarea>
		</div>
		<div>
			<button class="btn-outline">Save</button>
		</div>
	</form>

	<h2 class="mt-10 mb-3 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
		Add manual entry
	</h2>
	<form method="POST" action="?/addEntry" use:enhance class="card mb-8 grid gap-3 p-4">
		<input type="hidden" name="startedAt" value={startedAtIso} />
		<input type="hidden" name="endedAt" value={endedAtIso} />
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1 text-xs font-medium text-zinc-400">
				Start
				<input
					type="datetime-local"
					bind:value={startedAtLocal}
					required
					class="input text-sm"
				/>
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium text-zinc-400">
				End
				<input
					type="datetime-local"
					bind:value={endedAtLocal}
					required
					class="input text-sm"
				/>
			</label>
		</div>
		<label class="flex flex-col gap-1 text-xs font-medium text-zinc-400">
			Note (optional)
			<textarea name="note" rows="2" class="input text-sm"></textarea>
		</label>
		<button class="btn-primary justify-self-start">Log entry</button>
		{#if form?.error}
			<p class="alert-error">{form.error}</p>
		{/if}
	</form>

	<h2 class="mb-3 text-sm font-semibold tracking-wide text-zinc-400 uppercase">Entries</h2>
	<ul class="card divide-y divide-zinc-800 overflow-hidden">
		{#each data.entries as e (e.id)}
			{#if editing?.id === e.id}
				<li class="bg-zinc-900/60 px-4 py-4">
					<form
						method="POST"
						action="?/updateEntry"
						use:enhance={() =>
							async ({ result, update }) => {
								if (result.type === 'success') cancelEdit();
								await update();
							}}
						class="grid gap-3 text-sm"
					>
						<input type="hidden" name="id" value={e.id} />
						<input type="hidden" name="startedAt" value={editStartIso} />
						<input type="hidden" name="endedAt" value={editEndIso} />
						<div class="grid grid-cols-2 gap-3">
							<label class="flex flex-col gap-1 text-xs font-medium text-zinc-400">
								Start
								<input
									type="datetime-local"
									bind:value={editing.startLocal}
									required
									class="input text-sm"
								/>
							</label>
							<label class="flex flex-col gap-1 text-xs font-medium text-zinc-400">
								End
								<input
									type="datetime-local"
									bind:value={editing.endLocal}
									required
									class="input text-sm"
								/>
							</label>
						</div>
						<label class="flex flex-col gap-1 text-xs font-medium text-zinc-400">
							Task
							<select name="taskId" bind:value={editing.taskId} class="input text-sm">
								{#each data.pickerTasks as p (p.id)}
									<option value={p.id}>{pickerLabel(p)}</option>
								{/each}
							</select>
						</label>
						<label class="flex flex-col gap-1 text-xs font-medium text-zinc-400">
							Note
							<textarea name="note" rows="2" bind:value={editing.note} class="input text-sm"
							></textarea>
						</label>
						<div class="flex gap-2">
							<button class="btn-primary">Save</button>
							<button type="button" onclick={cancelEdit} class="btn-outline">Cancel</button>
						</div>
					</form>
				</li>
			{:else}
				<li class="group flex items-start justify-between gap-3 px-4 py-3 text-sm transition hover:bg-zinc-800/40">
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<span class="text-zinc-300">{fmtDateTime(e.startedAt)}</span>
							<span class="font-mono tabular-nums text-zinc-100">
								{e.endedAt
									? formatDuration(durationMs(e.startedAt, e.endedAt))
									: 'running'}
							</span>
						</div>
						{#if e.note}
							<p class="mt-1 text-xs whitespace-pre-wrap text-zinc-500">{e.note}</p>
						{/if}
					</div>
					<div class="flex flex-col items-end gap-1 opacity-60 transition group-hover:opacity-100">
						<button
							type="button"
							onclick={() => startEdit(e)}
							class="text-xs text-zinc-400 transition hover:text-zinc-100"
						>
							Edit
						</button>
						<form method="POST" action="?/deleteEntry" use:enhance>
							<input type="hidden" name="id" value={e.id} />
							<button class="text-xs text-rose-400 transition hover:text-rose-300">
								Delete
							</button>
						</form>
					</div>
				</li>
			{/if}
		{:else}
			<li class="px-4 py-8 text-center text-sm text-zinc-500">No entries yet.</li>
		{/each}
	</ul>

	<div class="mt-12 flex justify-end border-t border-zinc-900 pt-6">
		<form
			method="POST"
			action="?/deleteTask"
			use:enhance={({ cancel }) => {
				if (!confirm(`Delete task "${data.task.name}"? This also removes its time entries.`)) {
					cancel();
				}
			}}
		>
			<button
				class="text-xs text-zinc-600 transition hover:text-rose-400"
				title="Delete task and all its time entries"
			>
				Delete task
			</button>
		</form>
	</div>
</main>
