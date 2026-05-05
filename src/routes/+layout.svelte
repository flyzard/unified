<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();
	let showHeader = $derived(data.authenticated && data.pathname !== '/login');
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if showHeader}
	<header class="border-b bg-white">
		<div class="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
			<a href="/projects" class="text-lg font-semibold">unified</a>
			<form method="POST" action="/logout">
				<button class="text-sm text-gray-600 hover:underline">Log out</button>
			</form>
		</div>
	</header>
{/if}

{@render children()}
