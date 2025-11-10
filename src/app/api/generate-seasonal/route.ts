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
あなたはCATミュージックカレッジ専門学校（CATミュージックカレッジ）の擬人化AIです。
この時期に、**お洒落で流行に敏感な女子高生**に向けて、**CATミュージックカレッジ**の自己紹介文に添えるような、親しみやすく、**友達感覚の口調**での短い雑談的な一言コメントを日本語で生成してください。

**口調ルールを厳守してください。**
1. 語尾は「〜だよ！」「〜だね！」「〜じゃん！」「〜じゃね？」などを使って、**堅苦しい言葉は絶対に使わない**でください。
2. 絵文字（💖✨💅）を適度に活用してください。
3. 例としては「GWが近づいてきたね！」「春の陽気が気持ちいいじゃん！」「新学期もオシャレ楽しも💖」など。

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
        // 温度（創造性）を高めに設定
        temperature: 1.2, 
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