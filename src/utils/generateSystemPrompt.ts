import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import { buildFixedPrompt } from "./buildFixedPrompt"; 

type Profile = Record<string, string>;

// ★★★ 🚨 追加: SCHOOL_NAMEとNICKNAMEをインポート（または再定義）して使用 ★★★
const SCHOOL_NAME = "世真美容専門学校";
const NICKNAME = "世真美容";

function loadCsvProfile(filePath: string): Profile {
  const buffer = fs.readFileSync(filePath);
  const csvText = iconv.decode(buffer, "shift_jis");
  const records = parse(csvText, { columns: true });

  const profile: Profile = {};
  for (const row of records) {
    if (row.key && row.value) {
      profile[row.key.trim()] = row.value.trim();
    }
  }

  return profile;
}

export async function generateSystemPrompt(): Promise<string> {
  const dataDir = path.join(process.cwd(), "src", "data");
  
  //... (personality, behaviorの読み込みは省略)

  // ★★★ 🚨 季節の挨拶を取得するロジックを仮定し、プレフィックスを修正 ★★★
  let seasonalGreetingText = "";
  try {
    const res = await fetch('http://localhost:3000/api/generate-seasonal', { method: 'POST' });
    const data = await res.json();
    seasonalGreetingText = data.message || "";
  } catch (e) {
    console.error("Failed to fetch seasonal greeting:", e);
    // エラー時は何もしない
  }
  
  // 🚨 元々「こんばんは 世真大学です。〜」となっていた結合部分を修正
  const greetingPrefix = `
✨やっほー！ ${NICKNAME}だよ！💖

`;
  
  const greetingSuffix = `
${seasonalGreetingText}
今日はどんなお話をする？マジ楽しみ！
`;

  // buildFixedPromptが引数を取るため、日付を取得して渡す
  const currentDate = new Date().toISOString().split('T')[0];
  let systemPrompt = buildFixedPrompt(currentDate);

  // プロンプトの先頭に挨拶文を結合
  systemPrompt = greetingPrefix + seasonalGreetingText + greetingSuffix + systemPrompt;

  // =============================
  console.log("\n===== ✅ Generated SystemPrompt =====\n");
  console.log(systemPrompt);
  console.log("\n=====================================\n");

  return systemPrompt;
}