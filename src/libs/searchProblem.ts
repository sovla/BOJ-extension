import * as vscode from "vscode";
import axios from "axios";
import * as cheerio from "cheerio";

interface ProblemData {
	title: string;
	info: string | null;
	description: string;
	input: string | null;
	output: string | null;
	limit: string | null;
	sampleInputs: string[] | null;
	sampleOutputs: string[] | null;
	sampleExplains: string[] | null;
	hint: string | null;
	source: string | null;
}

export async function searchProblem(
	problemNumber: string,
	context: vscode.ExtensionContext
): Promise<ProblemData> {
	const cacheKey = `problem-${problemNumber}`;
	const cachedData = context.globalState.get<ProblemData>(cacheKey);
	if (cachedData) {
		return cachedData;
	}

	const response = await fetchWithRetry(3);

	// Check if response.data exists before proceeding
	if (!response.data) {
		throw new Error("Failed to fetch problem data");
	}

	const htmlData = response.data.toString("utf-8"); // 바이너리 데이터를 문자열로 변환


	// Cheerio를 사용하여 HTML 파싱
	const $ = cheerio.load(htmlData);

	const baseURL = "https://www.acmicpc.net";

	$("img").each((index, element) => {
		const src = $(element).attr("src");
		if (src && !src.startsWith("http") && baseURL) {
			// base URL과 img 요소의 src 속성을 조합하여 절대 URL로 변환
			$(element).attr("src", baseURL + src);
		}
	});

	// 제목 추출
	const title = $("#problem_title").text();

	// 문제 정보 추출
	const info = $("#problem-info").html();

	// 본문 추출
	const description = $("#problem_description").html()!.replace(/\t/g, "");

	// 입력, 출력, 예제 입력, 예제 출력 추출
	const input = $("#problem_input").html()!.replace(/\t/g, "");
	const output = $("#problem_output").html()!.replace(/\t/g, "");

	// 제한 추출
	const limit = $("#problem_limit").html();

	// 예제 입력, 예제 출력, 예제 설명 추출 (배열로 처리)
	const sampleInputs: string[] = [];
	const sampleOutputs: string[] = [];
	const sampleExplains: string[] = [];

	let i = 1;
	while (true) {
		const sampleInput = $(`#sample-input-${i}`).html();
		const sampleOutput = $(`#sample-output-${i}`).html();
		const sampleExplain = $(`#sample_explain_${i}`).html();

		if (!sampleInput || !sampleOutput) {
			break;
		}

		sampleInputs.push(sampleInput);
		sampleOutputs.push(sampleOutput);
		if (sampleExplain) {
			sampleExplains.push(sampleExplain);
		}
		i++;
	}

	// 힌트 추출
	const hint = $("#problem_hint").html();

	// 출처 추출
	const source = $("#source").html();

	const problemData: ProblemData = {
		title,
		info,
		description,
		input,
		output,
		limit,
		sampleInputs,
		sampleOutputs,
		sampleExplains,
		hint,
		source,
	};

	await context.globalState.update(cacheKey, problemData);

	return problemData;

	async function fetchWithRetry(retries:number) {
		for (let index = 0; index < retries; index++) {
			try {
				const userAgents = [
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15",
					"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
					"Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
				];
				
				// Add jitter to request timing and select different User-Agent on each try
				const randomDelay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms random delay
				await new Promise(resolve => setTimeout(resolve, randomDelay));
				
				const selectedUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
				const response = await axios.get(
					`https://www.acmicpc.net/problem/${problemNumber}`,
					{
						headers: {
							"User-Agent": selectedUserAgent,
							"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
							"Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
							"Accept-Encoding": "gzip, deflate, br, zstd",
							"Referer": "https://www.acmicpc.net/",
							"Cache-Control": "no-cache",
							"Pragma": "no-cache",
							"Connection": "keep-alive",
							"Sec-Fetch-Dest": "document",
							"Sec-Fetch-Mode": "navigate",
							"Sec-Fetch-Site": "same-origin",
							"Sec-Fetch-User": "?1",
							"Upgrade-Insecure-Requests": "1"
						},
						decompress: true,
						responseType: "arraybuffer",
						maxRedirects: 5,
						validateStatus: status => status < 400
					}
				)
				if(response.status === 200 && response.data) {
					return response;
				}
				throw new Error("Failed to fetch problem data");
			} catch (error) {
				await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기 후 재시도
			}
		}
		vscode.window.showErrorMessage("Failed to fetch problem data after multiple attempts.");
		throw new Error("Failed to fetch problem data after multiple attempts");
	}
}
