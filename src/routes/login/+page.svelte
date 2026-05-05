<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<main class="flex min-h-svh items-center justify-center px-6 py-12">
	<div class="card w-full max-w-sm p-7">
		<div class="mb-6 flex items-center gap-2">
			<span
				class="inline-block h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_12px_2px_rgba(129,140,248,0.6)]"
			></span>
			<span class="text-sm font-semibold tracking-tight text-zinc-100">unified</span>
		</div>
		<h1 class="mb-1 text-xl font-semibold text-zinc-100">Welcome back</h1>
		<p class="mb-6 text-sm text-zinc-400">Enter password to continue.</p>
		<form method="POST" use:enhance class="flex flex-col gap-3">
			<input
				type="password"
				name="password"
				required
				autofocus
				placeholder="Password"
				class="input"
			/>
			{#if form?.error}
				<p class="alert-error">{form.error}</p>
			{/if}
			<button type="submit" class="btn-primary mt-1">Log in</button>
		</form>
	</div>
</main>
