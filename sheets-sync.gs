/**
 * 買取・出品ワークボード：出品表 → アプリ 自動集計
 * 「2611月 実売データ」の出品表2シートから、出品日×出品担当コードの件数を数えて、アプリに送ります。
 * 使い方：setup を1回実行して許可するだけ。以後10分ごとに自動で動きます。
 */
const SOURCE_SPREADSHEET_ID = '1Io5h_3j-OMGE8qXDqW_fxfdLi3nLsYbLf8zLmpCaKZY';
const SOURCES = [
  {sheet: '本社1スタ出品表', store: '相模原'},
  {sheet: '本社1スタ出品表 新山下', store: '新山下'}
];
const COL_CODE = 2;     // B列：出品担当
const COL_STATUS = 9;   // I列：決済
const COL_DATE = 15;    // O列：出品日
const EXCLUDE_STATUS = ['取消', '中止'];
const SUPABASE_URL = 'https://pgtmijmpuhstddlwbqjq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BFYZq-4aCRc4ETS4J2UvLA_cFS_gIdX';

/** 最初に1回だけ実行：集計して、10分ごとの自動実行を登録します */
function setup() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'sync') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(10).create();
  sync();
  Logger.log('設定完了：10分ごとに出品数をアプリへ送ります。');
}

function sync() {
  const tz = 'Asia/Tokyo';
  const now = new Date();
  const y = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const m = Number(Utilities.formatDate(now, tz, 'M'));
  const prev = m === 1 ? {y: y - 1, m: 12} : {y: y, m: m - 1};
  const months = [ym(prev.y, prev.m), ym(y, m)];
  const ss = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const counts = {};
  SOURCES.forEach(src => {
    const sh = ss.getSheetByName(src.sheet);
    if (!sh) { Logger.log('シートが見つかりません：' + src.sheet); return; }
    const last = sh.getLastRow();
    if (last < 2) return;
    const values = sh.getRange(2, 1, last - 1, COL_DATE).getDisplayValues();
    values.forEach(r => {
      const code = normCode(r[COL_CODE - 1]);
      const status = String(r[COL_STATUS - 1]).trim();
      const date = toDate(String(r[COL_DATE - 1]).trim(), y, m);
      if (!code || !date) return;
      if (EXCLUDE_STATUS.some(x => status.indexOf(x) === 0)) return;
      if (months.indexOf(date.slice(0, 7)) < 0) return;
      const key = src.store + '_' + code + '_' + date;
      counts[key] = counts[key] || {id: key, store: src.store, code: code, date: date, month: date.slice(0, 7), count: 0, updated_at: now.getTime()};
      counts[key].count++;
    });
  });
  const rows = Object.keys(counts).map(k => counts[k]);
  // 対象月の古い集計を消してから、最新の集計を入れ直す
  api('delete', '/rest/v1/listing_counts?month=in.(' + months.join(',') + ')');
  for (let i = 0; i < rows.length; i += 500) api('post', '/rest/v1/listing_counts', rows.slice(i, i + 500));
  Logger.log('送信しました：' + rows.length + '件（' + months.join('、') + '）');
}

function ym(y, m) { return y + '-' + ('0' + m).slice(-2); }
function normCode(v) { return String(v || '').normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
/** 「10/15」「2026/10/15」などを yyyy-mm-dd に。年がない場合は今の年（来月より先なら前年） */
function toDate(s, y, m) {
  if (!s) return '';
  s = s.normalize('NFKC');
  let mt = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (mt) return mt[1] + '-' + ('0' + mt[2]).slice(-2) + '-' + ('0' + mt[3]).slice(-2);
  mt = s.match(/^(\d{1,2})[\/\-.](\d{1,2})/);
  if (!mt) return '';
  const mm = Number(mt[1]), dd = Number(mt[2]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
  const yy = mm > m + 1 ? y - 1 : y;
  return yy + '-' + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2);
}
function api(method, path, body) {
  const opt = {method: method, muteHttpExceptions: true, headers: {apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, Prefer: 'return=minimal'}};
  if (body) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch(SUPABASE_URL + path, opt);
  if (res.getResponseCode() >= 300) throw new Error('アプリへの送信に失敗しました（' + res.getResponseCode() + '）：' + res.getContentText().slice(0, 300));
}
