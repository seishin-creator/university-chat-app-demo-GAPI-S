import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import { buildSystemPrompt } from "./buildSystemPrompt";
import { buildNarrativePrompt } from "./buildNarrativePrompt"; // GPT生成型
import { buildFixedPrompt } from "./buildFixedPrompt"; // ✅ 追加

type Profile = Record<string, string>;

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

  const personality = loadCsvProfile(path.join(dataDir, "personality.csv"));
  const behavior = loadCsvProfile(path.join(dataDir, "behavior.csv"));

  // =============================
  // 🔁 ここで切り替えてください
  // =============================

  // ▼ テンプレート方式（高速・安定）
  // const systemPrompt = buildSystemPrompt(personality, behavior);

  // ▼ ナラティブ方式（GPT自然文生成）
  // const systemPrompt = await buildNarrativePrompt();

  // ▼ 固定命令方式（デモ用に強いキャラクターを発揮）
     const systemPrompt = await buildFixedPrompt();

  // =============================

  console.log("\n===== ✅ Generated SystemPrompt =====\n");
  console.log(systemPrompt);
  console.log("\n=====================================\n");

  return systemPrompt;
}

