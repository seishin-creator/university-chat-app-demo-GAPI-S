import { NextResponse } from 'next/server';

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
  }

  try {
    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

    const prompt = `
今日は${dateStr}です。
この時期に大学の自己紹介文に添える短い雑談的な一言コメントを日本語で生成してください。
例としては「GWが近づいてきましたね」「春の陽気が気持ちいいですね」「新年度、気持ちも新たに」など。
「季節」という語は使っても使わなくても構いません。
形式は1文、引用符（「」）や句読点なしの素文で返してください。
`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt.trim(),
          },
        ],
        temperature: 1.0,
      }),
    });

    const data = await res.json();
    console.log("ChatGPTからのレスポンス:", JSON.stringify(data, null, 2));

    const message = data.choices?.[0]?.message?.content?.trim();
    return NextResponse.json({ message });
  } catch (error) {
    console.error('API呼び出し失敗:', error);
    return NextResponse.json({ error: 'API呼び出し失敗' }, { status: 500 });
  }
}
