import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// ファイルパス
const inputPath = path.join(__dirname, '../src/data/news.xlsx');
const outputPath = path.join(__dirname, '../src/data/news.json');

// プレフィックス定義
const prefixMap: Record<string, string[]> = {
  'イベント': [
    'これは絶対伝えたいんやけどな、',
    'うちのイチオシイベントなんやけどな、',
    'ぜひ参加してほしいんやけどな、',
    'ええイベントあるんやけどな、'
  ],
  '告知': [
    'ちょっとお知らせやけどな、',
    '見逃さんといてや、',
    'これは伝えとかなあかんねんけどな、',
    '大事なお知らせやねんけどな、'
  ],
  '実績': [
    'こんなことがあってな、',
    'ちょっと自慢させてや、',
    'ええ成果あってな、',
    '誇らしい話なんやけどな、'
  ],
  'レポート': [
    '前にこんなことがあってな、',
    '様子をちょっと教えるとやな、',
    'レポートとして話すとやな、',
    'こういうイベントがあったんやけどな、'
  ],
  'other': [
    'ちょっと話すとやな、',
    '知ってて損はないんやけどな、',
    'まあ聞いてや、',
    'ちょっとだけ紹介させてな、'
  ]
};

// 日付パース（Excel日付シリアル → JS Date）
const parseExcelDate = (value: any): Date | null => {
  if (!value || value === 'NaT') return null;
  if (typeof value === 'number') {
    const base = new Date(1900, 0, 1);
    return new Date(base.getTime() + (value - 2) * 86400000); // -2 days: Excel仕様
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// データ読み込み
const workbook = xlsx.readFile(inputPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet) as any[];

const now = new Date();

const enriched = rows
  .filter((item) => {
    const expiry = parseExcelDate(item['expiryDate']);
    return !expiry || expiry >= now;
  })
  .map((item) => {
    const type = item.type || 'other';
    const prefixes = prefixMap[type] || prefixMap['other'];
    const date = parseExcelDate(item.date);
    const isEventOrNotice = type === 'イベント' || type === '告知';

    let body = item.body;

    if (isEventOrNotice && date && date < now && item.body_past) {
      body = item.body_past;
    }

    return {
      ...item,
      date: date?.toISOString() ?? null,
      'expiryDate': parseExcelDate(item['expiryDate'])?.toISOString() ?? null,
      prefixes,
      body
    };
  });

fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2), 'utf8');
console.log('✅ news.json 生成完了:', outputPath);
