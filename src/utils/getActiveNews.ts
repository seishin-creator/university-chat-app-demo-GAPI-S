// src/utils/getActiveNews.ts
import newsData from '@/data/news.json';

// ニュース型定義
export type NewsItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  body_past?: string;
  date?: string;
  target: string;
  rank: string;
  tags: string;
  prefixes?: string[];
  prefix?: string;
  expiry?: string; // expiry date
};

// 有効なニュースを取得（expiryチェック付き）＋prefixランダム付与
export function getRankedNewsWithPrefix(rank: string): NewsItem[] {
  const now = new Date();

  return newsData
    .filter((item: NewsItem) => {
      // 期限切れチェック
      if (item.expiry) {
        const expiryDate = new Date(item.expiry);
        if (expiryDate < now) return false;
      }
      return item.rank === rank;
    })
    .map((item: NewsItem) => ({
      ...item,
      prefix: Array.isArray(item.prefixes)
        ? item.prefixes[Math.floor(Math.random() * item.prefixes.length)]
        : '',
    }));
}
