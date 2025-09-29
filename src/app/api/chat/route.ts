import { NextResponse } from 'next/server';
import { GoogleGenAI, Content, Part } from '@google/genai';
import { generateSystemPrompt } from '@/utils/generateSystemPrompt';
// ★★★ 追記: googleapisライブラリをインポート ★★★
import { google } from 'googleapis';

// Chat.tsxからメッセージの型を再定義
type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// Google Custom Search APIクライアントを初期化
const customsearch = google.customsearch('v1');

// ★★★ 外部検索ツール（Function Calling）- 実際のWeb検索実装 ★★★
async function googleSearch(query: string) {
    console.log(`🔍 Tool Called! Running Web Search for: ${query}`);

    try {
        const response = await customsearch.cse.list({
            auth: process.env.GOOGLE_SEARCH_API_KEY, // APIキーを参照
            cx: process.env.GOOGLE_SEARCH_CX,     // 検索エンジンIDを参照
            q: query,                              // モデルが生成した検索クエリ
            num: 3,                                // 上位3件の結果を取得
        });

        // 検索結果のスニペットを整形
        const searchResults = response.data.items?.map(item => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link,
        })) || [];

        if (searchResults.length === 0) {
            return {
                query: query,
                result: { search_snippet: `検索結果は見つかりませんでした。` },
            };
        }

        // 検索結果をJSON構造で返す
        return {
            query: query,
            // JSON.stringifyで検索結果のオブジェクトを文字列化して渡す
            result: { 
                search_snippet: `【Web検索結果の抜粋】: ${JSON.stringify(searchResults)}` 
            },
        };

    } catch (error) {
        console.error('❌ Google Search API Error:', error);
        // エラー時もモデルが次の回答を生成できるよう、エラーメッセージを返す
        return {
            query: query,
            result: { search_snippet: `検索中にエラーが発生しました。Web検索APIでエラーが発生しました。` },
        };
    }
}
// ----------------------------------------------------

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY, 
});

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

    // システムプロンプトを生成
    let systemPromptRaw = await generateSystemPrompt();

    // ★★★ 検索結果参照の指示をシステムプロンプトに追加し、利用を義務化する ★★★
    systemPromptRaw += `\n
    【🔍 検索結果参照の特別ルール】
    もし Tool Calling（外部検索）の結果が提供された場合、あなたの回答は必ずその情報に基づいて構成し、
    ペルソナ（関西弁、仏教テーマ）を維持しつつ、その情報を会話に織り交ぜて回答を完結させること。
    外部情報を無視したり、使用せずに回答を生成してはいけません。
    `;
    // ★★★ 検索結果参照の指示ここまで ★★★

    // Bランクニュース挿入ロジック (クライアント側と重複するためここでは無効化)
    const shouldInsertBNews = false; 
    if (shouldInsertBNews && typeof systemPromptRaw === 'string') {
      systemPromptRaw += '\n##INSERT_B_NEWS##';
    }


    // メッセージ形式をGeminiのContent形式に変換
    const initialContents: Content[] = messages
        .filter((msg: Message) => msg.role !== 'system')
        .map((msg: Message) => {
            const role = msg.role === 'user' ? 'user' : 'model';
            return {
                role: role,
                parts: [{ text: msg.content } as Part],
            } as Content;
        });

    let contents = initialContents;
    let fullResponse;
    let maxIterations = 5; 

    // ★★★ Tool Calling 反復処理の開始 ★★★
    for (let i = 0; i < maxIterations; i++) {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: contents,
            config: {
                systemInstruction: systemPromptRaw,
                tools: [{ functionDeclarations: [
                    {
                        name: 'googleSearch',
                        description: '回答の深みや具体性を増すため、またはユーザーの質問が求めている客観的な事実（ニュース、歴史、一般的な社会情勢、特定の人物名など）について検索が必要な場合に利用する。',
                        parameters: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'ユーザーの質問に答えるために必要な検索クエリ。',
                                },
                            },
                            required: ['query'],
                        },
                    },
                ]}],
            },
        });
        
        fullResponse = response;
        const call = response.functionCalls?.[0];

        // ツール呼び出しが無ければループを抜けて回答を返す
        if (!call) {
            break; 
        }

        // ★★★ ツール呼び出しを処理 ★★★
        const functionName = call.name;
        const args = call.args;

        if (functionName === 'googleSearch') {
            const toolResult = await googleSearch(args.query);

            // ツールからの応答を履歴に追加して、モデルに再度送信
            contents.push(
                response.candidates![0].content, 
                {
                    role: 'function', 
                    parts: [{ 
                        functionResponse: {
                            name: 'googleSearch',
                            response: toolResult.result, 
                        },
                    }],
                }
            );
        } else {
            throw new Error(`Unknown function call: ${functionName}`);
        }
    }
    // ★★★ Tool Calling 反復処理の終了 ★★★

    // 最終応答を抽出
    const reply = fullResponse?.text ?? 'ごめん、うまく返せへんかったわ。';
    return NextResponse.json({ message: reply });
  } catch (error) {
    console.error('❌ API処理中のエラー:', error);
    if (error instanceof Error && error.message.includes("code:503")) {
        return NextResponse.json({ error: '現在サーバーが大変混み合っています。少し時間をおいて再度お試しください。' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}