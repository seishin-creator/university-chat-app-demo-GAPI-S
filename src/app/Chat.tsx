'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

// 🚨 汎用性を持たせるための定数定義 (この部分を変更して切り替える)
const AI_NICKNAME = 'CATミュージックカレッジ';
const GREETING_MESSAGE = `✨やっほー！ようこそ、${AI_NICKNAME}へ！私もあんたとお喋りできてめっちゃ嬉しいわ！`;
const ASK_NAME_MESSAGE = `ところで、あんたのことなんて呼んだらいい？友達みたいに話そっ💖`;
const DEFAULT_ERROR_MESSAGE = `ごめん、なんかうまく答えられへんかったみたい💦マジごめんね！`;
const NETWORK_ERROR_MESSAGE = `ごめん！通信エラーが出ちゃったよ😭ちょっと待ってまた話しかけてみて！`;

// UIデザインの定数
const AI_ICON_PATH = '/CAT-icon.png'; // ⚠️ アイコン画像
const BG_IMAGE_PATH = '/CAT-background.png'; // ⚠️ 背景画像
const PRIMARY_COLOR_CLASSES = 'bg-pink-500 hover:bg-pink-600'; // ボタンカラー
const USER_BUBBLE_COLOR_CLASS = 'bg-pink-100'; // ユーザーメッセージの背景色
const ASSISTANT_BUBBLE_COLOR_CLASS = 'bg-gray-100'; // AIメッセージの背景色

const generateOrLoadSessionId = (): string => {
  if (typeof window === 'undefined') return '';
  let sid = localStorage.getItem('sessionId');
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem('sessionId', sid);
  }
  return sid;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const sessionId = useMemo(() => generateOrLoadSessionId(), []);

  // --- 初期表示 ---
  useEffect(() => {
    if (messages.length === 0) {
      console.log("🧪 初期useEffect実行された");

      const greeting: Message = {
        role: 'assistant',
        content: GREETING_MESSAGE, // 定数を使用
      };

      const askName: Message = {
        role: 'assistant',
        content: ASK_NAME_MESSAGE, // 定数を使用
      };

      setMessages([greeting, askName]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (newMessageContent?: string) => {
    const content = newMessageContent ?? input.trim();
    if (!content) return;

    const userMessage: Message = { role: 'user', content };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    if (!newMessageContent) setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: updatedMessages,
          sessionId: sessionIdRef.current,
        }),
      });

      if (!res.ok) {
        const errorDetails = await res.text();
        console.error("❌ APIエラー:", errorDetails);
        throw new Error('APIエラー');
      }

      const data = await res.json();
      // 🚨 エラーメッセージも定数を使用
      const assistantMessage = data.message ?? DEFAULT_ERROR_MESSAGE; 
      setMessages([...updatedMessages, { role: 'assistant', content: assistantMessage }]);
    } catch (err) {
      console.error("❌ 通信エラー:", err);
      // 🚨 エラーメッセージも定数を使用
      setMessages([...updatedMessages, { role: 'assistant', content: NETWORK_ERROR_MESSAGE }]);
    }
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{
        backgroundImage: `url('${BG_IMAGE_PATH}')`, // 定数を使用
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="flex flex-col h-full bg-white/80 p-4">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2`}>
                {!isUser && (
                  <img
                    src={AI_ICON_PATH} // 定数を使用
                    alt={AI_NICKNAME}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div
                  className={`p-2 rounded-md max-w-[70%] ${
                    isUser ? `${USER_BUBBLE_COLOR_CLASS} text-right` : `${ASSISTANT_BUBBLE_COLOR_CLASS} text-left` 
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 p-2 border rounded-md"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendMessage();
            }}
          />
          <button
            className={`${PRIMARY_COLOR_CLASSES} text-white px-4 py-2 rounded-md transition-colors`} // 定数を使用
            onClick={() => sendMessage()}
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}