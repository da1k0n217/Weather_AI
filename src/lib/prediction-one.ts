/** Prediction One の「1件予測」APIに送るための小さなクライアント。 */

export type PredictionOneInput = {
	name: string;
	type: 'csv' | 'boolean';
	data: string | boolean;
};

type PredictionOneResponse = {
	outputs?: Array<{ data?: string }>;
	message?: string;
};

type PredictionOneError = {
	error?: {
		code?: string;
		message?: string;
		error_info?: Array<{ key?: string; value?: string }>;
	};
};

export function encodeBase64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
	return btoa(binary);
}

export function decodeBase64(value: string): string {
	const binary = atob(value);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

export async function requestPrediction(url: string, apiKey: string, csv: string): Promise<string> {
	const inputs: PredictionOneInput[] = [
		{ name: 'pr', type: 'csv', data: encodeBase64(csv) },
		{ name: 'ar', type: 'boolean', data: false },
		{ name: 'ad', type: 'boolean', data: true },
		{ name: 'nc', type: 'boolean', data: false },
		{ name: 'nr', type: 'boolean', data: true }
	];

	const response = await fetch(url, {
		method: 'POST',
		mode: 'cors',
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-api-key': apiKey },
		body: JSON.stringify({ inputs })
	});

	if (!response.ok) throw new Error(`Prediction One API エラー (${response.status})`);
	const body = (await response.json()) as PredictionOneResponse;
	const output = body.outputs?.find((item) => item.name === 'prediction_valid.csv') ?? body.outputs?.[0];
	const encoded = output?.data;
	if (!encoded) throw new Error(body.message || 'Prediction One から予測データを受け取れませんでした。');
	const decoded = decodeBase64(encoded);

	// Prediction One はHTTP 200でも outputs[0].name === 'error' で失敗を返すことがある。
	if (output?.name === 'error') {
		try {
			const responseError = JSON.parse(decoded) as PredictionOneError;
			const error = responseError.error;
			const columnName = error?.error_info?.find((item) => item.key === 'ColumnName')?.value;
			if (columnName) {
				throw new Error(`モデルが必要とする列「${columnName}」がCSVにありません。学習データと同じ列名・順番にしてください。`);
			}
			throw new Error(`Prediction One エラー${error?.code ? ` (${error.code})` : ''}: ${error?.message || '予測に失敗しました。'}`);
		} catch (error) {
			if (error instanceof Error) throw error;
			throw new Error('Prediction One が予測エラーを返しました。');
		}
	}

	return decoded;
}

/** CSV の最低限の引用符を扱えるパーサー。Prediction One の出力を表示用に読む。 */
function readCsvLine(line: string): string[] {
	const cells: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < line.length; i += 1) {
		const character = line[i];
		if (character === '"') {
			if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
		} else if (character === ',' && !quoted) { cells.push(cell.trim()); cell = ''; } else cell += character;
	}
	cells.push(cell.trim());
	return cells;
}

export type ParsedPrediction = { label: string; details: Array<{ name: string; value: string }> };

export function parsePrediction(csv: string): ParsedPrediction {
	const lines = csv.split(/\r?\n/).filter((line) => line.trim());
	if (lines.length === 0) throw new Error('予測結果が空でした。');
	const headers = readCsvLine(lines[0]);
	const values = readCsvLine(lines[1] ?? lines[0]);
	const allDetails = values.map((value, index) => ({ name: headers[index] || `結果 ${index + 1}`, value }));

	// nc: false の分類結果は先頭セルに予測ラベルが入る。
	if (values[0] && !Number.isFinite(Number(values[0]))) {
		return { label: values[0], details: allDetails.slice(0, 5) };
	}

	// 分類モデルが「score,0.1,0.8,...」のように返す場合は最大スコアを採用する。
	// 先頭の "score" 列は数値ではないため、数値のセルだけを比較する。
	if (lines.length >= 2 && headers.length === values.length) {
		const scores = values
			.map((value, index) => ({ index, score: Number(value) }))
			.filter((item) => Number.isFinite(item.score));
		if (scores.length > 1) {
			const best = scores.reduce((current, item) => (item.score > current.score ? item : current));
			return { label: headers[best.index], details: allDetails.slice(0, 5) };
		}
	}
	return { label: values[0] || headers[0], details: allDetails.slice(0, 5) };
}

export function toCsv(headers: string[], values: string[]): string {
	const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
	return `${headers.map(escape).join(',')}\n${values.map(escape).join(',')}`;
}
