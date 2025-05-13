export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { generateSystemPrompt } from '@/utils/generateSystemPrompt';
import { getOnStartNews } from '@/utils/getActiveNews'; // ← 追加

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'APIキーが未設定です' }, { status: 500 });
  }

  const { messages } = await req.json();

  // ✅ システムプロンプトを取得
  const systemPrompt = {
    role: 'system',
    content: await generateSystemPrompt()
  };

  // ✅ on_start ニュースを取得し、assistantロールで挿入
  const onStartNewsMessages = getOnStartNews().map((item) => ({
    role: 'assistant',
    content: item.body,
  }));

  // ✅ メッセージ順序：system → ニュース → ユーザー
  const allMessages = [systemPrompt, ...onStartNewsMessages, ...messages];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: allMessages,
      temperature: 0.8,
    }),
  });

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim();

  return NextResponse.json({ message: reply });
}
