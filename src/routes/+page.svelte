<script>
    import Header from '$lib/header.svelte';

    let temperature = 2*2*2*2*2*2*2*2*2*2*2*2*2;

</script>

<svelte:head>
    <title>Weather AI</title>
    <meta name="description" content="LiquidGlass風の天気AIダッシュボード" />
</svelte:head>

<div class="pt-18 relative min-h-screen overflow-hidden bg-linear-to-bl to-blue-100 from-blue-700 text-white p-5">
    <Header />
    <div class="grid grid-cols-2 gap-4 p-4">
        <div class="col-span-2 flex items-center justify-center p-6">
            <div class="items-center text-center font-zen">
                <p class="mt-2 text-lg">名古屋市</p>
                <h1 class="text-8xl font-semibold text-shadow-lg">{temperature}°</h1>
                <p class="mt-2 text-lg">気持ちい天気ですねw</p>
            </div>
        </div>
        <div class="p-6 rounded-4xl border border-blue-200/24 bg-blue-200/16 font-semibold shadow-inner shadow-white/20">
            <h2 class="mb-2 text-lg font-semibold">Current Weather</h2>
            <p>Temperature: 25°C</p>
            <p>Humidity: 60%</p>
            <p>Wind Speed: 10 km/h</p>
        </div>
        <div class="p-6 rounded-4xl border border-blue-200/24 bg-blue-200/16 font-semibold shadow-inner shadow-white/20">
            <h2 class="mb-2 text-lg font-semibold">Current Weather</h2>
            <p>Temperature: 25°C</p>
            <p>Humidity: 60%</p>
            <p>Wind Speed: 10 km/h</p>
        </div>
        <div class="p-6 rounded-4xl border border-blue-200/24 bg-blue-200/16 font-semibold shadow-inner shadow-white/20">
            <h2 class="mb-2 text-lg font-semibold">Current Weather</h2>
            <p>Temperature: 25°C</p>
            <p>Humidity: 60%</p>
            <p>Wind Speed: 10 km/h</p>
        </div>
        <div class="p-6 rounded-4xl border border-blue-200/24 bg-blue-200/16 font-semibold shadow-inner shadow-white/20">
            <h2 class="mb-2 text-lg font-semibold">Current Weather</h2>
            <p>Temperature: 25°C</p>
            <p>Humidity: 60%</p>
            <p>Wind Speed: 10 km/h</p>
        </div>
        <div class="p-6 rounded-4xl border border-blue-200/24 bg-blue-200/16 font-semibold shadow-inner shadow-white/20">
            <h2 class="mb-2 text-lg font-semibold">Current Weather</h2>
            <p>Temperature: 25°C</p>
            <p>Humidity: 60%</p>
            <p>Wind Speed: 10 km/h</p>
        </div>
    </div>
</div>