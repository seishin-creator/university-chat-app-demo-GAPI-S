'use client';

import { useState, useEffect } from 'react';
import Chat from './Chat';

export default function Home() {
  const [showOpening, setShowOpening] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [openingText, setOpeningText] = useState('');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'おはようございます';
    if (hour < 18) return 'こんにちは';
    return 'こんばんは';
  };

  const getSeasonalMessageFromAI = async () => {
    try {
      const res = await fetch('/api/generate-seasonal', {
        method: 'POST',
      });
      const data = await res.json();
      return data.message || '今日も元気にいきましょう。';
    } catch (error) {
      console.error('自作API呼び出し失敗:', error);
      return 'うまく取得できませんでした。';
    }
  };

  useEffect(() => {
    const prepareOpening = async () => {
      const greeting = getGreeting();
      const seasonal = await getSeasonalMessageFromAI();

      // 「」で囲まれていたら中身だけを取り出す
      let cleanSeasonal = seasonal.trim();
      const match = cleanSeasonal.match(/^「(.+?)」$/);
      if (match) {
        cleanSeasonal = match[1];
      }

      const fullText = `${greeting}\n世真大学です。\n${cleanSeasonal}\n今日はどんなお話をしましょうか？`;
      setOpeningText(fullText);

      setTimeout(() => {
        setShowOpening(true);
      }, 3000);
    };

    prepareOpening();
  }, []);

  useEffect(() => {
    if (!showOpening) return;

    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex >= openingText.length) {
        clearInterval(typingInterval);
        setTimeout(() => {
          setShowChat(true);
        }, 1000);
        return;
      }
      const nextChar = openingText.charAt(currentIndex);
      setTypedText((prev) => prev + nextChar);
      currentIndex++;
    }, 100);

    return () => clearInterval(typingInterval);
  }, [showOpening, openingText]);

  if (showChat) return <Chat />;

  return (
    <div className="flex items-center justify-center h-screen bg-white p-4">
      {showOpening ? (
        <div className="text-center whitespace-pre-line text-lg">{typedText}</div>
      ) : (
        <img src="/logo.png" alt="University Logo" className="w-48 h-48 animate-fadeOut" />
      )}
    </div>
  );
}
