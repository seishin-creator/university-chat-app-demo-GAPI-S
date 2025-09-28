import { NextResponse } from 'next/server';
// OpenAIからGoogle Gen AI SDKへ変更
import { GoogleGenAI, Content, Part } from '@google/genai';
import { generateSystemPrompt } from '@/utils/generateSystemPrompt';

// Chat.tsxからメッセージの型を再定義
type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// ★★★ 外部検索ツール（Function Calling）の定義 ★★★
// 実際にはここにGoogle Search APIなどを組み込みます
async function googleSearch(query: string) {
    console.log(`🔍 Tool Called! Search Query: ${query}`);

    // ★★★ 修正済み: JSONオブジェクトを返すように変更（API要件）★★★
    const searchResultObject = {
        // 応答がJSON構造になるように、スニペットをオブジェクトとして返す
        search_snippet: `
            【Web検索結果の抜粋】
            世真大学は、経済学部、法学部、文学部、国際学部の4学部を擁し、全ての学部でAIとデータサイエンスを学ぶことを必須としています。
            最近の全国的なトピックスとして、AI倫理やデータプライバシーに関する議論が高校生の間でも高まっており、世真大学のAI教育はその最前線に位置づけられています。
            また、ユーザーの質問である時事問題について、最新の情報では〇〇氏、△△氏、××氏が出馬を表明している。
        `,
    };
    
    return {
        query: query,
        result: searchResultObject, // JSONオブジェクトを返す
    };
}
// ----------------------------------------------------

const ai = new GoogleGenAI({
  // 環境変数名をGEMINI_API_KEYに変更
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

    // Bランクニュース挿入ロジック (クライアント側と重複するためここでは無効化)
    const shouldInsertBNews = false; 
    if (shouldInsertBNews && typeof systemPromptRaw === 'string') {
      systemPromptRaw += '\n##INSERT_B_NEWS##';
    }


    // メッセージ形式をGeminiのContent形式に変換
    const initialContents: Content[] = messages
        .filter((msg: Message) => msg.role !== 'system')
        .map((msg: Message) => {
            // ロールをOpenAIの 'user'/'assistant' から Geminiの 'user'/'model' に変換
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
            // 高速なFlashモデルを使用
            model: 'gemini-2.5-flash', 
            contents: contents,
            config: {
                systemInstruction: systemPromptRaw,
                tools: [{ functionDeclarations: [
                    {
                        name: 'googleSearch',
                        // 検索対象を拡張し、リッチな回答生成を促す
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
                response.candidates![0].content, // ツール呼び出しを含むモデルの応答
                {
                    role: 'function', // ツール応答のロール
                    parts: [{ 
                        functionResponse: {
                            name: 'googleSearch',
                            // ツール実行結果のオブジェクトを渡す
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
    // 503エラーは一時的なものなので、メッセージを調整
    if (error instanceof Error && error.message.includes("code:503")) {
        return NextResponse.json({ error: '現在サーバーが大変混み合っています。少し時間をおいて再度お試しください。' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}