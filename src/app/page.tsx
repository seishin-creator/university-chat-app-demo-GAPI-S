'use client';

import { useState, useEffect } from 'react';
import Chat from './Chat';

// 🚨 汎用化のための定数定義 (この部分を変更して切り替える)
const AI_INTRODUCTION_NAME = 'CATミュージックカレッジ';
// AIの口調に合わせた挨拶文全体を定義
// Chat.tsxの最初の挨拶とトーンを合わせ、オープニング画面用にアレンジ
const AI_INTRODUCTION_PHRASE = `✨やっほー！ようこそ、${AI_INTRODUCTION_NAME}だよ！💖`; 

export default function Home() {
  const [showOpening, setShowOpening] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [openingText, setOpeningText] = useState('');

  // 🚨 元のgetGreeting()関数は、硬い口調（おはようございます/こんにちは/こんばんは）のため使用しない
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
      // 挨拶APIの応答は既にCATミュージックカレッジの口調になっているはず
      return data.message || '今日も元気にいきましょう。'; 
    } catch (error) {
      console.error('自作API呼び出し失敗:', error);
      return 'うまく取得できませんでした。';
    }
  };

  useEffect(() => {
    const prepareOpening = async () => {
      // 🚨 getGreeting() は使用しない

      const seasonal = await getSeasonalMessageFromAI();

      // 「」で囲まれていたら中身だけを取り出す
      let cleanSeasonal = seasonal.trim();
      const match = cleanSeasonal.match(/^「(.+?)」$/);
      if (match) {
        cleanSeasonal = match[1];
      }

      // 🚨 修正箇所: AI_INTRODUCTION_PHRASEと季節の挨拶を結合し、口調を統一
      // 「世真大学です。」の硬い表現を削除し、「CATミュージックカレッジ」のトーンに完全に合わせる
      // 構造: [オープニング挨拶]\n[季節のコメント]\n[会話への誘導]
      const fullText = `${AI_INTRODUCTION_PHRASE}\n${cleanSeasonal}\n今日はどんなお話をする？マジ楽しみ！`;
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
        <img src="/CAT-logo.png" alt="University Logo" className="w-48 h-48 animate-fadeOut" />
      )}
    </div>
  );
}