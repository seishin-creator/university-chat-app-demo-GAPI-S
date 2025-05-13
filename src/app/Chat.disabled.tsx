'use client';

import { useState, useEffect } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  // ✅ 共通の送信処理（ユーザー・AI両方対応）
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
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();
      setMessages([...updatedMessages, { role: 'assistant', content: data.message }]);
    } catch {
      setMessages([...updatedMessages, { role: 'assistant', content: 'エラーが発生しました。' }]);
    }
  };

  // ✅ 初回のみ大学側から発話
  useEffect(() => {
    if (messages.length === 0) {
      const welcome = 'よう来てくれたな。私は世真大学や。ちょっと変わっとるかもしれんけど、今日は話せてうれしいわ。\nところで、あんたのこと、なんて呼んだらええやろか？';
      setMessages([{ role: 'assistant', content: welcome }]);
    }
  }, []);

  return (
    <div
      className="flex flex-col h-screen"
      style={{
        backgroundImage: "url('/school.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="flex flex-col h-full bg-white/80 p-4">
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {messages.length === 0 ? (
            <p className="text-gray-500">ここにチャットが表示されます</p>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-2 rounded max-w-lg ${
                  msg.role === 'user' ? 'bg-blue-100 self-end' : 'bg-gray-100 self-start'
                }`}
              >
                {msg.content}
              </div>
            ))
          )}
        </div>

        <div className="flex">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="メッセージを入力..."
            className="flex-1 border px-3 py-2 rounded-l"
          />
          <button
            onClick={() => sendMessage()}
            className="bg-blue-500 text-white px-4 py-2 rounded-r"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
