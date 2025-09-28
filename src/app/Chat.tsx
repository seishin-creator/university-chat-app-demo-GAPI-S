'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

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
        content: 'よう来てくれたな。私は世真大学や。ちょっと変わっとるかもしれんけど、今日は話せてうれしいわ。',
      };

      const askName: Message = {
        role: 'assistant',
        content: 'ところで、あんたのこと、なんて呼んだらええやろか？',
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
      const assistantMessage = data.message ?? 'ごめん、うまく答えられへんかったわ。';
      setMessages([...updatedMessages, { role: 'assistant', content: assistantMessage }]);
    } catch (err) {
      console.error("❌ 通信エラー:", err);
      setMessages([...updatedMessages, { role: 'assistant', content: 'エラーが発生しました。' }]);
    }
  };

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
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2`}>
                {!isUser && (
                  <img
                    src="/sema-icon.png"
                    alt="AI"
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div
                  className={`p-2 rounded-md max-w-[70%] ${
                    isUser ? 'bg-blue-100 text-right' : 'bg-gray-100 text-left'
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
            className="bg-blue-500 text-white px-4 py-2 rounded-md"
            onClick={() => sendMessage()}
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
