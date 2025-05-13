'use client';

import { useState, useEffect, useRef } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 共通送信関数
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

  // 初回発話
  useEffect(() => {
    if (messages.length === 0) {
      const welcome = 'よう来てくれたな。私は世真大学や。ちょっと変わっとるかもしれんけど、今日は話せてうれしいわ。\nところで、あんたのこと、なんて呼んだらええやろか？';
      setMessages([{ role: 'assistant', content: welcome }]);
    }
  }, []);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end`}>
              {msg.role === 'assistant' && (
                <img
                  src="/sema-icon.png"
                  alt="世真"
                  className="w-8 h-8 rounded-full mr-2"
                />
              )}
              <div
                className={`px-4 py-2 rounded-lg max-w-xs whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-black rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
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
