<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<main class="mx-auto mt-32 max-w-sm p-6">
	<h1 class="mb-4 text-xl font-semibold">Log in</h1>
	<form method="POST" use:enhance class="flex flex-col gap-3">
		<input
			type="password"
			name="password"
			required
			autofocus
			class="rounded border px-3 py-2"
		/>
		{#if form?.error}<p class="text-sm text-red-600">{form.error}</p>{/if}
		<button type="submit" class="rounded bg-black px-3 py-2 text-white">Log in</button>
	</form>
</main>
