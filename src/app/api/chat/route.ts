import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { generateSystemPrompt } from '@/utils/generateSystemPrompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ グローバルにセッション情報を保持（Vercelなどで一貫性保つならDB推奨）
const globalAny = globalThis as any;
if (!globalAny.sessionTracker) {
  globalAny.sessionTracker = {};
}
const sessionTracker: Record<string, { turnCount: number; lastUserInputTime: number }> = globalAny.sessionTracker;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, sessionId } = body;

    if (!messages || !Array.isArray(messages)) {
      console.error('❌ 不正なmessages:', messages);
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const now = Date.now();
    if (!sessionId) {
      console.warn('⚠️ sessionId が未指定です');
    }

    // ✅ セッションのターン数と時間を更新
    if (sessionId) {
      if (!sessionTracker[sessionId]) {
        sessionTracker[sessionId] = {
          turnCount: 1,
          lastUserInputTime: now,
        };
      } else {
        sessionTracker[sessionId].turnCount += 1;
        sessionTracker[sessionId].lastUserInputTime = now;
      }
    }

    // ✅ Bランクニュース挿入条件チェック
    const shouldInsertBNews = (() => {
      if (!sessionId) return false;
      const session = sessionTracker[sessionId];
      const silenceExceeded = now - session.lastUserInputTime > 10000; // 10秒無言
      const turnsExceeded = session.turnCount >= 3; // 3ターン
      return silenceExceeded || turnsExceeded;
    })();

    // ✅ ログ出力
    console.log("🧪 sessionId:", sessionId);
    console.log("🧮 turnCount:", sessionTracker[sessionId]?.turnCount);
    console.log("⏱ lastUserInputTime:", new Date(sessionTracker[sessionId]?.lastUserInputTime || 0).toISOString());
    console.log("🎯 shouldInsertBNews:", shouldInsertBNews);

    // ✅ システムプロンプトを生成
    let systemPromptRaw = await generateSystemPrompt();

    // ✅ Bランクニュース挿入フラグが立っていれば末尾に追加文字列
    if (shouldInsertBNews && typeof systemPromptRaw === 'string') {
      systemPromptRaw += '\n##INSERT_B_NEWS##';
    }

    let systemPrompt = { role: 'system', content: systemPromptRaw };
    if (typeof systemPromptRaw === 'object' && 'content' in systemPromptRaw) {
      systemPrompt = systemPromptRaw;
    }

    // ✅ OpenAIへ送信（gpt-4oを使用）
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [systemPrompt, ...messages],
    });

    const reply = response.choices?.[0]?.message?.content ?? 'すまん、うまく返せへんかったわ。';
    return NextResponse.json({ message: reply });
  } catch (error) {
    console.error('❌ API処理中のエラー:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
