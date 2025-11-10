// =========================================================
// 📄 ファイルの役割
// = 1. フロントエンド (Chat.tsx) からのチャットリクエストを受け取るAPIエンドポイントです。
// = 2. Google Geminiモデル (Function Calling対応) を使用して、ユーザーとの会話を処理します。
// = 3. 必要に応じてWeb検索ツール (googleSearch) を呼び出し、リアルタイム情報を提供します。
// = 4. セッションIDに基づき、チャット履歴を管理します。
// =========================================================
import { NextResponse } from 'next/server';
import { GoogleGenAI, Content, Part } from '@google/genai';
import { generateSystemPrompt } from '@/utils/generateSystemPrompt';
import { google } from 'googleapis';

// 🚨 汎用性を持たせるための定数定義 (この部分を変更して切り替える)
const AI_NICKNAME = 'CATミュージックカレッジ';
const NEW_PERSONA_DESCRIPTION = '親しみやすい友達、美容テーマ、若者言葉';

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

        const searchResults = response.data.items?.map(item => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link,
        })) || [];

        if (searchResults.length === 0) {
            return {
                result: '検索結果は見つかりませんでした。',
            };
        }

        // 結果をモデルに渡しやすいよう整形
        const result = searchResults.map(item =>
            `タイトル: ${item.title}\nスニペット: ${item.snippet}\nURL: ${item.link}`
        ).join('\n---\n');

        return {
            result: result,
        };
    } catch (error) {
        console.error('Web Search Error:', error);
        return {
            result: 'Web検索の実行中にエラーが発生しました。',
        };
    }
}

// Next.jsのAPIルート (POSTメソッド)
export async function POST(req: Request) {
    const { messages, sessionId } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Gemini APIキーが設定されていません。' }, { status: 500 });
    }

    // 履歴管理の準備
    // ★★★ Firestore の代わりに In-Memory なマップを使用（簡易的なデモ用） ★★★
    // ⚠ 本番環境では、永続化されたデータベース（Firestoreなど）を使用してください。
    if (typeof global.chatHistoryMap === 'undefined') {
        global.chatHistoryMap = new Map();
    }
    const chatHistory: Message[] = global.chatHistoryMap.get(sessionId) || [];

    // 現在のメッセージを履歴に追加
    const currentMessage = messages[messages.length - 1];
    chatHistory.push(currentMessage);
    global.chatHistoryMap.set(sessionId, chatHistory);

    // AIのシステムプロンプトを生成
    // 🚨 毎回生成するのは非効率なので、本番ではキャッシュを検討してください
    const systemInstruction = await generateSystemPrompt();

    // Gemini API用の Content 形式に変換
    const contents: Content[] = chatHistory.map(msg => {
        const role = msg.role === 'user' ? 'user' : 'model';
        return {
            role,
            parts: [{ text: msg.content }],
        };
    });

    try {
        const ai = new GoogleGenAI({ apiKey });

        let fullResponse;
        let contentsLength = contents.length; // ツール呼び出しの無限ループを防ぐため

        // ★★★ Tool Calling 反復処理の開始 ★★★
        // ツール呼び出しを伴う再リクエストは最大3回までとする
        for (let i = 0; i < 3; i++) {
            // 履歴の重複送信を防ぐ
            if (contents.length > contentsLength) {
                contentsLength = contents.length;
            } else if (i > 0) {
                // 2回目以降のループでContentsが増えていない場合、ツールが呼ばれなかったと判断し、ループを抜ける
                break;
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro', // 🚨 Function Callingには 'gemini-2.5-pro' が推奨されます
                contents: contents,
                config: {
                    systemInstruction: systemInstruction, // カスタムペルソナ
                    tools: [{
                        functionDeclarations: [
                            {
                                name: 'googleSearch',
                                description: 'リアルタイムのニュース、日付、最新の出来事、一般的なWeb情報など、モデルの訓練データにない外部情報が必要な時に使用する。',
                                parameters: {
                                    type: 'OBJECT',
                                    properties: {
                                        query: {
                                            type: 'STRING',
                                            description: 'Web検索に使用する具体的な検索クエリ（日本語）',
                                        },
                                    },
                                    required: ['query'],
                                },
                            },
                        ],
                    }],
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
                    response.candidates![0].content, // ツール呼び出しの記述
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
        // 🚨 エラーメッセージも定数と口調を使用
        const reply = fullResponse?.text ?? `ごめん、${AI_NICKNAME}はマジでうまく返せへんかったわ😭！`;

        // 成功したら、チャット履歴を最新の応答で更新
        chatHistory.push({ role: 'assistant', content: reply });
        global.chatHistoryMap.set(sessionId, chatHistory);

        return NextResponse.json({ message: reply });
    } catch (error) {
        console.error('❌ API処理中のエラー:', error);
        if (error instanceof Error && error.message.includes("code:503")) {
            return NextResponse.json({ error: '現在サーバーが大変混み合っています。少し時間をおいて再度お試しください。' }, { status: 503 });
        }
        // 🚨 エラーメッセージも定数と口調を使用
        const errorReply = `マジごめん！APIとの通信中にヤバいエラーが出ちゃったみたい...！😭 ${NEW_PERSONA_DESCRIPTION}の私は、今ちょっとお話できないみたい。また後で試してみてくれると嬉しいな！`;
        return NextResponse.json({ error: errorReply }, { status: 500 });
    }
}
