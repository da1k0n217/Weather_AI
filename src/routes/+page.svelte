<script lang="ts">
	import Header from '$lib/header.svelte';
	import { parsePrediction, requestPrediction, toCsv, type ParsedPrediction } from '$lib/prediction-one';

	type WeatherField = {
		name: string;
		label: string;
		unit: string;
		value: string;
		type: 'number' | 'text';
		min?: number;
		max?: number;
		step?: string;
	};
	type ObservationField = Omit<WeatherField, 'value'> & { values: string[] };

	const observationFields: ObservationField[] = [
		{ name: '気温_℃', label: '気温', unit: '℃', values: ['25', '24', '23', '22'], type: 'number' as const, min: -30, max: 50, step: '0.1' },
		{ name: '降水量_mm', label: '降水量', unit: 'mm', values: ['0', '0', '0', '0'], type: 'number' as const, min: 0, max: 500, step: '0.1' },
		{ name: '日照時間_h', label: '日照時間', unit: 'h', values: ['1', '1', '1', '1'], type: 'number' as const, min: 0, max: 24, step: '0.1' },
		{ name: '風速_m_s', label: '風速', unit: 'm/s', values: ['3.2', '3', '3', '2.8'], type: 'number' as const, min: 0, max: 100, step: '0.1' },
		{ name: '風向', label: '風向', unit: '', values: ['北', '北', '北', '北'], type: 'text' as const },
		{ name: '現地気圧_hPa', label: '現地気圧', unit: 'hPa', values: ['1013', '1013', '1012', '1012'], type: 'number' as const, min: 800, max: 1100, step: '0.1' },
		{ name: '相対湿度_pct', label: '相対湿度', unit: '%', values: ['60', '61', '62', '63'], type: 'number' as const, min: 0, max: 100, step: '1' },
		{ name: '雲量_10分比', label: '雲量', unit: '/10', values: ['3', '3', '3', '3'], type: 'number' as const, min: 0, max: 10, step: '1' },
		{ name: '現在の天気', label: '現在の天気', unit: '', values: ['晴', '晴', '晴', '晴'], type: 'text' as const }
	];

	/* このモデルの学習CSVと同じ39列を、同じ順番で生成する。 */
	const weatherFields: WeatherField[] = [
		{ name: '月', label: '月', unit: '月', value: '10', type: 'number', min: 1, max: 12, step: '1' },
		{ name: '時刻', label: '時刻', unit: '時', value: '12', type: 'number', min: 0, max: 23, step: '1' },
		...Array.from({ length: 4 }, (_, hoursAgo) => observationFields.map((field) => ({
			name: hoursAgo === 0 ? field.name : `${field.name}_${hoursAgo}時間前`,
			label: hoursAgo === 0 ? field.label : `${hoursAgo}時間前の${field.label}`,
			unit: field.unit,
			value: field.values[hoursAgo],
			type: field.type,
			min: field.min,
			max: field.max,
			step: field.step
		}))).flat(),
		{ name: '予測する時間_時間後', label: '予測する時間', unit: '時間後', value: '1', type: 'number', min: 1, max: 24, step: '1' }
	];

	// .env の VITE_API_URL / VITE_API_KEY を使う。
	const predictionUrl = import.meta.env.VITE_API_URL ?? '';
	const predictionKey = import.meta.env.VITE_API_KEY ?? '';

	// このプロジェクトは runes mode なので、画面に反映する値は $state で管理する。
	let formValues = $state<Record<string, string>>(Object.fromEntries(weatherFields.map((field) => [field.name, field.value])));
	let isLoading = $state(false);
	let errorMessage = $state('');
	let prediction = $state<ParsedPrediction | null>(null);
	let sentCsv = $state('');

	async function submitPrediction() {
		errorMessage = '';
		prediction = null;
		if (!predictionUrl || !predictionKey) {
			errorMessage = 'Prediction One のURLまたはAPIキーが設定されていません。';
			return;
		}

		sentCsv = toCsv(weatherFields.map((field) => field.name), weatherFields.map((field) => formValues[field.name]));
		isLoading = true;
		try {
			const outputCsv = await requestPrediction(predictionUrl, predictionKey, sentCsv);
			prediction = parsePrediction(outputCsv);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : '予測中にエラーが発生しました。';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Weather AI</title>
	<meta name="description" content="Prediction One を使った天気予測" />
</svelte:head>

<div class="weather-shell min-h-screen">
	<Header />
	<main class="dashboard mx-auto max-w-4xl px-5 pb-12 pt-28 sm:px-8">
		<section class="intro">
			<p class="eyebrow">PREDICTION ONE × WEATHER</p>
			<h1>天気を<span>予測</span>する</h1>
			<p>観測値を入力して、学習済みの Prediction One モデルに予測してもらおう。</p>
		</section>

		<form class="prediction-card" onsubmit={(event) => { event.preventDefault(); submitPrediction(); }}>
			<h2>観測データ</h2>
			<div class="field-grid">
				{#each weatherFields as field}
					<label>
						<span>{field.label}</span>
						<div class="input-wrap">
							<input type={field.type} name={field.name} min={field.min} max={field.max} step={field.step} bind:value={formValues[field.name]} required />
							<small>{field.unit}</small>
						</div>
					</label>
				{/each}
			</div>
			<button type="submit" disabled={isLoading}>{isLoading ? '診断中…' : '天気を予測する'}</button>
		</form>

		{#if errorMessage}
			<p class="notice error" role="alert">{errorMessage}</p>
		{/if}

		{#if prediction}
			<section class="result-card" aria-live="polite">
				<p class="eyebrow">PREDICTION RESULT</p>
				<h2>{prediction.label}</h2>
				<div class="result-details">
					{#each prediction.details as detail}
						<div><span>{detail.name}</span><strong>{detail.value}</strong></div>
					{/each}
				</div>
				<details><summary>APIへ送ったCSVを確認</summary><pre>{sentCsv}</pre></details>
			</section>
		{/if}
	</main>
</div>
