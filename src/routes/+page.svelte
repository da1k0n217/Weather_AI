<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/header.svelte';
	import { getWeatherInputValues } from '$lib/open-meteo';
	import { parsePrediction, requestPrediction, toCsv, type ParsedPrediction } from '$lib/prediction-one';

	type InputField = {
		name: string;
		label: string;
		value: string;
		type: 'number' | 'text' | 'select';
		unit?: string;
		min?: number;
		max?: number;
		step?: string;
		options?: string[];
		readonly?: boolean;
	};
	type ObservationField = Omit<InputField, 'value'> & { values: string[] };
	type WeatherForecast = { hours: number; prediction: ParsedPrediction };

	const observationFields: ObservationField[] = [
		{ name: '気温_℃', label: '気温', unit: '℃', values: ['25', '24', '23', '22'], type: 'number', min: -30, max: 50, step: '0.1' },
		{ name: '降水量_mm', label: '降水量', unit: 'mm', values: ['0', '0', '0', '0'], type: 'number', min: 0, max: 500, step: '0.1' },
		{ name: '日照時間_h', label: '日照時間', unit: 'h', values: ['1', '1', '1', '1'], type: 'number', min: 0, max: 24, step: '0.1' },
		{ name: '風速_m_s', label: '風速', unit: 'm/s', values: ['3', '3', '3', '3'], type: 'number', min: 0, max: 100, step: '1' },
		{ name: '風向', label: '風向', values: ['北', '北', '北', '北'], type: 'text' },
		{ name: '現地気圧_hPa', label: '現地気圧', unit: 'hPa', values: ['1013', '1013', '1012', '1012'], type: 'number', min: 800, max: 1100, step: '0.1' },
		{ name: '相対湿度_pct', label: '相対湿度', unit: '%', values: ['60', '61', '62', '63'], type: 'number', min: 0, max: 100, step: '1' },
		{ name: '雲量_10分比', label: '雲量', unit: '/10', values: ['3', '3', '3', '3'], type: 'number', min: 0, max: 10, step: '1' },
		{ name: '現在の天気', label: '現在の天気', values: ['晴', '晴', '晴', '晴'], type: 'text' }
	];

	// 天気Prediction Oneモデルの学習CSVと同じ39列を、同じ順番で生成する。
	const weatherFields: InputField[] = [
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

	// 競馬Prediction Oneモデルの学習CSVと同じ列名に合わせること。
	const horseFields: InputField[] = [
		{ name: '馬番', label: '馬番', value: '1', type: 'number', min: 1, max: 18, step: '1' },
		{ name: '枠番', label: '枠番', value: '1', type: 'number', min: 1, max: 8, step: '1' },
		{ name: '人気', label: '人気', value: '1', type: 'number', min: 1, max: 18, step: '1' },
		{ name: '芝・ダート区分', label: '芝・ダート', value: '芝', type: 'select', options: ['芝', 'ダート'] },
		{ name: '馬体重', label: '馬体重', value: '480', type: 'number', min: 250, max: 700, step: '1', unit: 'kg' },
		{ name: '馬齢', label: '馬齢', value: '3', type: 'number', min: 2, max: 15, step: '1', unit: '歳' },
		{ name: '競馬場名', label: '競馬場名', value: '中京', type: 'text' },
		{ name: '距離(m)', label: '距離', value: '1600', type: 'number', min: 1000, max: 4000, step: '100', unit: 'm' },
		{ name: '性別', label: '性別', value: '牡', type: 'select', options: ['牡', '牝', 'セン'] },
		{ name: '競争条件', label: '競争条件', value: '3歳以上1勝クラス', type: 'text' },
		{ name: '騎手', label: '騎手', value: '', type: 'text' },
		{ name: '天候', label: '天候（自動入力）', value: '', type: 'text', readonly: true },
		{ name: '斤量', label: '斤量', value: '55', type: 'number', min: 40, max: 70, step: '0.5', unit: 'kg' }
	];

	const weatherPredictionUrl = import.meta.env.VITE_WEATHER_API_URL ?? '';
	const weatherPredictionKey = import.meta.env.VITE_WEATHER_API_KEY ?? '';
	const horsePredictionUrl = import.meta.env.VITE_HORSE_API_URL ?? '';
	const horsePredictionKey = import.meta.env.VITE_HORSE_API_KEY ?? '';
	const forecastHours = [1, 2, 5];
	const location = { latitude: 35.1815, longitude: 136.9066, name: '名古屋市' };

	let weatherValues = $state<Record<string, string>>(Object.fromEntries(weatherFields.map((field) => [field.name, field.value])));
	let horseValues = $state<Record<string, string>>(Object.fromEntries(horseFields.map((field) => [field.name, field.value])));
	let forecasts = $state<WeatherForecast[]>([]);
	let isStarting = $state(true);
	let startupMessage = $state('天気情報を取得しています…');
	let startupError = $state('');
	let showHorseForm = $state(false);
	let selectedForecastHour = $state('1');
	let isPredictingHorse = $state(false);
	let horseError = $state('');
	let horsePrediction = $state<ParsedPrediction | null>(null);

	function randomInteger(min: number, max: number): string {
		return String(Math.floor(Math.random() * (max - min + 1)) + min);
	}

	function randomHorseValues(): Record<string, string> {
		const tracks = ['中京', '東京', '阪神', '京都', '札幌', '函館'];
		const conditions = ['3歳以上1勝クラス', '4歳以上2勝クラス', '新馬', '未勝利'];
		const jockeys = ['デバッグ騎手', 'テスト騎手', 'サンプル騎手'];
		return {
			'馬番': randomInteger(1, 18),
			'枠番': randomInteger(1, 8),
			'人気': randomInteger(1, 18),
			'芝・ダート区分': Math.random() < 0.65 ? '芝' : 'ダート',
			'馬体重': randomInteger(420, 560),
			'馬齢': randomInteger(2, 8),
			'競馬場名': tracks[Math.floor(Math.random() * tracks.length)],
			'距離(m)': String([1000, 1200, 1400, 1600, 1800, 2000, 2400][Math.floor(Math.random() * 7)]),
			'性別': ['牡', '牝', 'セン'][Math.floor(Math.random() * 3)],
			'競争条件': conditions[Math.floor(Math.random() * conditions.length)],
			'騎手': jockeys[Math.floor(Math.random() * jockeys.length)],
			'天候': horseValues['天候'],
			'斤量': (50 + Math.floor(Math.random() * 16) / 2).toFixed(1)
		};
	}

	async function submitRandomHorsePrediction() {
		horseValues = randomHorseValues();
		await submitHorsePrediction();
	}

	function weatherCsv(values: Record<string, string>, hours: number): string {
		const predictionValues = { ...values, '予測する時間_時間後': String(hours) };
		return toCsv(weatherFields.map((field) => field.name), weatherFields.map((field) => predictionValues[field.name]));
	}

	function setHorseWeather(hours: number) {
		const forecast = forecasts.find((item) => item.hours === hours);
		if (forecast) horseValues = { ...horseValues, 天候: forecast.prediction.label };
	}

	function changeForecastHour(event: Event) {
		selectedForecastHour = (event.currentTarget as HTMLSelectElement).value;
		setHorseWeather(Number(selectedForecastHour));
	}

	async function prepareForecasts() {
		isStarting = true;
		startupError = '';
		forecasts = [];
		try {
			if (!weatherPredictionUrl || !weatherPredictionKey) throw new Error('天気Prediction OneのURLまたはAPIキーが未設定です。');
			startupMessage = `${location.name}の現在・過去3時間の天気を取得しています…`;
			const fetchedValues = await getWeatherInputValues(location.latitude, location.longitude);
			weatherValues = { ...weatherValues, ...fetchedValues };
			startupMessage = '1・2・5時間後の天気を予測しています…';
			const results: WeatherForecast[] = [];
			for (const hours of forecastHours) {
				const result = await requestPrediction(weatherPredictionUrl, weatherPredictionKey, weatherCsv(fetchedValues, hours));
				results.push({ hours, prediction: parsePrediction(result) });
			}
			forecasts = results;
			setHorseWeather(forecastHours[0]);
		} catch (error) {
			startupError = error instanceof Error ? error.message : '天気予測の準備に失敗しました。';
		} finally {
			isStarting = false;
		}
	}

	async function submitHorsePrediction() {
		horseError = '';
		horsePrediction = null;
		if (!horsePredictionUrl || !horsePredictionKey) {
			horseError = '競馬Prediction OneのURLまたはAPIキーが未設定です。';
			return;
		}
		isPredictingHorse = true;
		try {
			const csv = toCsv(horseFields.map((field) => field.name), horseFields.map((field) => horseValues[field.name]));
			const result = await requestPrediction(horsePredictionUrl, horsePredictionKey, csv);
			horsePrediction = parsePrediction(result);
		} catch (error) {
			horseError = error instanceof Error ? error.message : '競馬予測に失敗しました。';
		} finally {
			isPredictingHorse = false;
		}
	}

	onMount(() => {
		void prepareForecasts();
	});
</script>

<svelte:head>
	<title>Weather & Horse AI</title>
	<meta name="description" content="天気予測と競馬予測をつなぐPrediction Oneアプリ" />
</svelte:head>

<div class="weather-shell min-h-screen">
	<Header />
	{#if isStarting}
		<div class="loading-screen flex justify-center items-center" role="status" aria-live="polite">
			<div class="loader-card"><h1>予測を準備中</h1><p>{startupMessage}</p></div>
		</div>
	{:else}
		<main class="dashboard mx-auto max-w-5xl px-5 pb-12 pt-28 sm:px-8">
			<section class="intro">
				<p class="eyebrow">WEATHER × HORSE RACING AI</p>
				<p>{location.name}の観測値から、レース時刻に合わせた天候を先に予測するよ。</p>
			</section>

			{#if startupError}
				<section class="notice error" role="alert"><p>{startupError}</p><button class="retry-button" onclick={prepareForecasts}>もう一度試す</button></section>
			{:else}
				<section class="forecast-panel" aria-live="polite">
					<div class="panel-heading"><div><p class="eyebrow">WEATHER FORECAST</p><h2>レース前の天気予測</h2></div><span>{location.name}</span></div>
					<div class="forecast-grid">
						{#each forecasts as forecast}
							<article class="forecast-result"><span>{forecast.hours}時間後</span><strong>{forecast.prediction.label}</strong><small>{forecast.prediction.details.slice(1).map((detail) => `${detail.name} ${detail.value}`).join(' · ')}</small></article>
						{/each}
					</div>
				</section>

				<section class="race-start-card">
					<div><p class="eyebrow">RACE PREDICTION</p><h2>競馬を予想する？</h2><p>馬とレースの情報を入れると、予測天候も一緒に競馬AIへ渡すよ。</p></div>
					<button onclick={() => showHorseForm = !showHorseForm}>{showHorseForm ? '入力欄を閉じる' : '競馬予想を始める'}</button>
				</section>

				{#if showHorseForm}
					<form class="prediction-card horse-form" onsubmit={(event) => { event.preventDefault(); submitHorsePrediction(); }}>
						<div class="panel-heading"><div><p class="eyebrow">RACE DATA</p><h2>レース情報を入力</h2></div><label class="forecast-select">天候の時刻<select value={selectedForecastHour} onchange={changeForecastHour}>{#each forecastHours as hours}<option value={hours}>{hours}時間後</option>{/each}</select></label></div>
						<div class="field-grid">
							{#each horseFields as field}
								<label>
									<span>{field.label}</span>
									<div class="input-wrap">
										{#if field.type === 'select'}
											<select name={field.name} bind:value={horseValues[field.name]}>{#each field.options ?? [] as option}<option value={option}>{option}</option>{/each}</select>
										{:else}
											<input type={field.type} name={field.name} min={field.min} max={field.max} step={field.step} readonly={field.readonly} bind:value={horseValues[field.name]} required />
										{/if}
										{#if field.unit}<small>{field.unit}</small>{/if}
									</div>
								</label>
							{/each}
						</div>
						<div class="prediction-actions">
							<button type="submit" disabled={isPredictingHorse}>{isPredictingHorse ? '競馬AIが考え中…' : '競馬を予想する'}</button>
							<button type="button" class="secondary-button" onclick={submitRandomHorsePrediction} disabled={isPredictingHorse}>
								{isPredictingHorse ? '送信中…' : '🎲 ランダムデータを送信'}
							</button>
						</div>
					</form>
					{#if horseError}<p class="notice error" role="alert">{horseError}</p>{/if}
					{#if horsePrediction}<section class="result-card" aria-live="polite"><p class="eyebrow">RACE PREDICTION RESULT</p><h2>{horsePrediction.label}</h2><div class="result-details">{#each horsePrediction.details as detail}<div><span>{detail.name}</span><strong>{detail.value}</strong></div>{/each}</div></section>{/if}
				{/if}
			{/if}
		</main>
	{/if}
</div>
