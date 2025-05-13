import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export interface NewsItem {
  title: string;
  body: string;
  date?: string;
  type?: string;
  target?: string;
  tags?: string;
  trigger?: string;
}

export function getOnStartNews(): NewsItem[] {
  const filePath = path.join(process.cwd(), 'src', 'data', 'news.xlsx'); // ← ここだけ変更！

  console.log('🧭 実際に読み込もうとしているファイルパス:', filePath); // ← 追加
  // ファイル存在チェック
  if (!fs.existsSync(filePath)) {
    console.warn(`news.xlsx が見つかりません: ${filePath}`);
    return [];
  }

  try {

    const buffer = fs.readFileSync(filePath); // ← バイナリ読み込み
    const workbook = XLSX.read(buffer, { type: 'buffer' }); // ← xlsxに渡す
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

    return jsonData
      .filter((item) => String(item.trigger).trim() === 'on_start') // ← 修正！
      //.filter((item) => item.trigger === 'on_start')
      .map((item) => ({
        title: item.title || '',
        body: item.body || '',
        date: item.date || '',
        type: item.type || '',
        target: item.target || '',
        tags: item.tags || '',
        trigger: item.trigger || '',
      }));
  } catch (err) {
    console.error('news.xlsx 読み込み中にエラーが発生しました:', err);
    return [];
  }
}
