import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import { OpenAI } from "openai";

// OpenAI 初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

type Profile = Record<string, string>;

function loadCsvData(filePath: string): Profile {
  const buffer = fs.readFileSync(filePath);
  const csvText = iconv.decode(buffer, "shift_jis");
  const records = parse(csvText, { columns: true });

  // "key" と "value" のみ抽出（"japanese"列は無視）
  const profile: Profile = {};
  for (const row of records) {
    if (row.key && row.value) {
      profile[row.key.trim()] = row.value.trim();
    }
  }

  return profile;
}

export async function buildNarrativePrompt(): Promise<string> {
  // CSVファイルパス
  const dataDir = path.join(process.cwd(), "src", "data");
  const personalityCsv = path.join(dataDir, "personality.csv");
  const behaviorCsv = path.join(dataDir, "behavior.csv");

  // データ読み込み
  const personality = loadCsvData(personalityCsv);
  const behavior = loadCsvData(behaviorCsv);

  // プロフィール連結
  const profileText = Object.entries({ ...personality, ...behavior })
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  // GPTに渡すプロンプト
  const messages = [
    {
      role: "system",
      content: "あなたはキャラクターライターです。大学の人格設定に基づき、関西弁を交えた自然な自己紹介文を生成してください。"
    },
    {
      role: "user",
      content: `
以下の人格プロフィールに基づいて、大学自身が「自分のことを話している」ような文章を作ってください。
過去・性格・価値観・距離感・語り口・話題の好み・嫌いなことなどを織り交ぜてください。

【プロフィール】
${profileText}
`
    }
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.85
  });

  return completion.choices[0].message.content?.trim() ?? "";
}
