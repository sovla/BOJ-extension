import * as vscode from "vscode";
import path from "path";
import fs from "fs";
import { showProblem } from "./showProblem";
import { headerComment } from "./headerComment";
import { searchProblem } from "../libs/searchProblem";
import { tierAxios } from "../libs/tierAxios";

export function createProblem(context: vscode.ExtensionContext) {
	// 출력 채널 생성 (여러번 호출되어도 중복 생성되지 않도록 주의)
	const outputChannel = vscode.window.createOutputChannel("BOJ Extension");

	vscode.window
		.showInputBox({
			prompt: "문제 번호를 입력해주세요.",
			placeHolder: "예: 1000",
		})
		.then(async (problemNumber) => {
			if (!problemNumber) {
				vscode.window.showErrorMessage("문제 번호가 입력되지 않았습니다.");
				return;
			}

			try {
				const config = vscode.workspace.getConfiguration("BOJ");
				const extension = config.get<string>("extension", "");

				const sp = await searchProblem(problemNumber, context);
				const tier = await tierAxios(problemNumber);

				// 제목 추출 및 폴더명에 사용할 수 없는 문자 치환
				const problemName = sp.title
					.replace(/:/g, "：")
					.replace(/\*/g, "＊")
					.replace(/\?/g, "？")
					.replace(/"/g, "＂")
					.replace(/</g, "＜")
					.replace(/>/g, "＞")
					.replace(/\|/g, "｜")
					.replace(/\//g, "／")
					.replace(/\\/g, "＼")
					.replace(/\^/g, "＾");

				// 폴더명 생성
				const folderName = `${problemNumber}번： ${problemName}`;
				const folderPath = path.join(
					vscode.workspace.workspaceFolders![0].uri.fsPath,
					folderName
				);
				fs.mkdirSync(folderPath);

				// 파일명 생성
				let fileName = "";
				if (extension === "java") {
					fileName = `Main.java`;
				} else {
					fileName = `${problemName}.${extension}`;
				}
				// md 파일명 생성
				const readme = `README.md`;

				// 폴더 안에 파일 생성
				const fnUri = vscode.Uri.joinPath(
					vscode.workspace.workspaceFolders![0].uri,
					folderName,
					fileName
				);
				const readmeUri = vscode.Uri.joinPath(
					vscode.workspace.workspaceFolders![0].uri,
					folderName,
					readme
				);

				// README.md 파일 내용 생성
				const readmeContent = `# ${problemNumber}번: ${problemName} - <img src="${tier.svg}" style="height:20px" /> ${tier.name}
				
<!-- performance -->

<!-- 문제 제출 후 깃허브에 푸시를 했을 때 제출한 코드의 성능이 입력될 공간입니다.-->

<!-- end -->

## 문제

[문제 링크](https://boj.kr/${problemNumber})

${sp.description}

## 입력

${sp.input}

## 출력

${sp.output}

## 소스코드

[소스코드 보기](${fileName.replace(/ /g, "%20")})`;
				const encoder = new TextEncoder();
				const readmeData = encoder.encode(readmeContent);

				// 파일 생성
				await vscode.workspace.fs.writeFile(fnUri, new Uint8Array());
				await vscode.workspace.fs.writeFile(readmeUri, readmeData);

				// 텍스트 에디터 열기
				const document = await vscode.workspace.openTextDocument(fnUri);
				await vscode.window.showTextDocument(document, {
					viewColumn: vscode.ViewColumn.One,
				});
				// 완료 메시지
				vscode.window.showInformationMessage(
					`'${fileName}' 파일이 생성되었습니다.`
				);

				showProblem(problemNumber, context);
				headerComment(problemNumber);
			} catch (error) {
				// 에러 로그 출력
				if (error instanceof Error) {
					outputChannel.appendLine(
						`[${new Date().toLocaleString()}] Error: ${error.message}`
					);
					if (error.stack) {
						outputChannel.appendLine(error.stack);
					}
					console.error("Error:", error);
				} else {
					outputChannel.appendLine(
						`[${new Date().toLocaleString()}] Unknown error: ${error}`
					);
					console.error("Unknown error:", error);
				}

				// 에러 종류에 따른 사용자 알림
				if (error instanceof Error && (error as any).code === "EEXIST") {
					vscode.window.showErrorMessage(
						"이미 해당 문제의 폴더가 존재합니다."
					);
				} else if (
					error instanceof Error &&
					(error as any).code === "ERR_BAD_REQUEST"
				) {
					vscode.window.showErrorMessage("문제를 찾을 수 없습니다.");
				} else {
					vscode.window.showErrorMessage("문제 생성 중 오류가 발생했습니다.");
				}
				return;
			}
		});
}