<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();
	let showHeader = $derived(data.authenticated && data.pathname !== '/login');
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if showHeader}
	<header
		class="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60"
	>
		<div class="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
			<a
				href="/projects"
				class="group flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-100"
			>
				<span
					class="inline-block h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_12px_2px_rgba(129,140,248,0.6)] transition group-hover:bg-indigo-300"
				></span>
				unified
			</a>
			<form method="POST" action="/logout">
				<button class="text-sm text-zinc-400 transition hover:text-zinc-100">Log out</button>
			</form>
		</div>
	</header>
{/if}

{@render children()}
