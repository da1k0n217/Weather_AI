const WEATHER_VARIABLES = [
	'temperature_2m',
	'precipitation',
	'sunshine_duration',
	'wind_speed_10m',
	'wind_direction_10m',
	'surface_pressure',
	'relative_humidity_2m',
	'cloud_cover',
	'weather_code'
] as const;

type WeatherVariable = (typeof WEATHER_VARIABLES)[number];
type OpenMeteoHourly = { time: string[] } & { [key in WeatherVariable]: Array<number | null> };
type OpenMeteoResponse = { hourly?: OpenMeteoHourly };

export type WeatherInputValues = Record<string, string>;

function toTokyoHourKey(date = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		hourCycle: 'h23'
	})
		.formatToParts(date)
		.reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00`;
}

function directionToJapanese(degrees: number): string {
	const directions = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
	return directions[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

function weatherCodeToJapanese(code: number): string {
	if (code <= 1) return '晴';
	if (code <= 48) return '曇';
	if (code >= 71) return '雪';
	return '雨';
}

function numberAt(hourly: OpenMeteoHourly, variable: WeatherVariable, index: number): number {
	const value = hourly[variable][index];
	if (value === null || value === undefined || !Number.isFinite(value)) {
		throw new Error(`天気APIの「${variable}」に必要な時刻のデータがありません。`);
	}
	return value;
}

function formatNumber(value: number): string {
	return String(Math.round(value * 100) / 100);
}

export async function getWeatherInputValues(latitude: number, longitude: number): Promise<WeatherInputValues> {
	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.search = new URLSearchParams({
		latitude: String(latitude),
		longitude: String(longitude),
		timezone: 'Asia/Tokyo',
		past_hours: '4',
		forecast_hours: '1',
		wind_speed_unit: 'ms',
		hourly: WEATHER_VARIABLES.join(',')
	}).toString();

	const response = await fetch(url);
	if (!response.ok) throw new Error(`天気APIエラー (${response.status})`);
	const responseBody = (await response.json()) as OpenMeteoResponse;
	const hourly = responseBody.hourly;
	if (!hourly?.time?.length) throw new Error('天気APIから時間別の観測値を受け取れませんでした。');

	const nowKey = toTokyoHourKey();
	let currentIndex = -1;
	for (let index = 0; index < hourly.time.length; index += 1) {
		if (hourly.time[index] <= nowKey) currentIndex = index;
	}
	if (currentIndex < 3) throw new Error('現在から3時間前までの天気データを取得できませんでした。');

	const values: WeatherInputValues = {};
	const currentTime = hourly.time[currentIndex];
	values['月'] = String(Number(currentTime.slice(5, 7)));
	values['時刻'] = String(Number(currentTime.slice(11, 13)));

	for (let hoursAgo = 0; hoursAgo <= 3; hoursAgo += 1) {
		const index = currentIndex - hoursAgo;
		const suffix = hoursAgo === 0 ? '' : `_${hoursAgo}時間前`;
		values[`気温_℃${suffix}`] = formatNumber(numberAt(hourly, 'temperature_2m', index));
		values[`降水量_mm${suffix}`] = formatNumber(numberAt(hourly, 'precipitation', index));
		values[`日照時間_h${suffix}`] = formatNumber(numberAt(hourly, 'sunshine_duration', index) / 3600);
		values[`風速_m_s${suffix}`] = String(Math.round(numberAt(hourly, 'wind_speed_10m', index)));
		values[`風向${suffix}`] = directionToJapanese(numberAt(hourly, 'wind_direction_10m', index));
		values[`現地気圧_hPa${suffix}`] = formatNumber(numberAt(hourly, 'surface_pressure', index));
		values[`相対湿度_pct${suffix}`] = formatNumber(numberAt(hourly, 'relative_humidity_2m', index));
		values[`雲量_10分比${suffix}`] = String(Math.round(numberAt(hourly, 'cloud_cover', index) / 10));
		values[`現在の天気${suffix}`] = weatherCodeToJapanese(numberAt(hourly, 'weather_code', index));
	}

	return values;
}
