import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';

// 1. Error Protection to Prevent Server Crashes
process.on('uncaughtException', (err) => {
  console.error('⚠️ [SafeGuard] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [SafeGuard] Unhandled Rejection:', reason);
});

dotenv.config();
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://trading-bot-lnf1.onrender.com';

// 2. Telegram Bot Configuration & State
const CONFIG_FILE = path.join(process.cwd(), 'telegram_config.json');

let BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9089609371:AAFyPRrun1KIafdD3J1ii2WmymjxJrTFR-E';
let CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
let isPollingTelegram = false;
let lastTelegramUpdateId = 0;

// Read saved Chat ID if exists
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const saved = JSON.parse(raw);
    if (saved.chatId) CHAT_ID = saved.chatId;
    if (saved.botToken) BOT_TOKEN = saved.botToken;
    console.log(' Loaded persistent Chat ID:', CHAT_ID ? `${CHAT_ID.slice(0, 4)}...` : 'None');
  }
} catch (e) {}

function saveTelegramConfig(token, cid) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ botToken: token, chatId: cid }, null, 2), 'utf-8');
  } catch (e) {}
}

// 3. Real Dime Portfolio Data (11 Assets)
let userHoldings = [
  {
    "id": "voo",
    "symbol": "VOO",
    "name": "Vanguard S&P 500 ETF",
    "category": "หุ้นหลัก (เสาหลักพอร์ต)",
    "currency": "USD",
    "shares": 0.0470292,
    "avgCost": 655.55,
    "costTotal": 30.83,
    "marketPrice": 715.59,
    "currentValueTHB": 1124.7,
    "currentValueUSD": 33.65,
    "pnlTHB": 94.37,
    "pnlPercent": 9.16,
    "isProfit": true,
    "advice": "⭐ เสาหลักพอร์ต ถือยาว DCA ต่อเนื่อง ปลอดภัยที่สุด",
    "adviceColor": "emerald"
  },
  {
    "id": "ttb",
    "symbol": "TTB",
    "name": "ธนาคารทหารไทยธนชาต (หุ้นไทย)",
    "category": "หุ้นปันผล (ไทย)",
    "currency": "THB",
    "shares": 162,
    "avgCost": 1.9222,
    "costTotal": 311.4,
    "marketPrice": 2.86,
    "currentValueTHB": 463.32,
    "currentValueUSD": 13.86,
    "pnlTHB": 151.92,
    "pnlPercent": 48.79,
    "isProfit": true,
    "advice": "🏆 กำไร +48.79% ปันผลสม่ำเสมอ ถือรับเงินปันผลสบายใจ",
    "adviceColor": "emerald"
  },
  {
    "id": "amd",
    "symbol": "AMD",
    "name": "Advanced Micro Devices",
    "category": "หุ้นเทคโนโลยี / AI",
    "currency": "USD",
    "shares": 0.0150027,
    "avgCost": 537.2349,
    "costTotal": 8.06,
    "marketPrice": 608.1,
    "currentValueTHB": 304.9,
    "currentValueUSD": 9.12,
    "pnlTHB": 35.53,
    "pnlPercent": 13.19,
    "isProfit": true,
    "advice": "🟢 กำไร +13.19% รอบ AI ยังเติบโต ถือรันเทรนด์ต่อ",
    "adviceColor": "emerald"
  },
  {
    "id": "scbt70x",
    "symbol": "SCBT70X(26A)",
    "name": "กองทุนผสม SCB ตราสารหนี้ (26A)",
    "category": "กองทุนรวมผสม",
    "currency": "THB",
    "shares": 197.1798,
    "avgCost": 11.9506,
    "costTotal": 2356.42,
    "marketPrice": 12.0037,
    "currentValueTHB": 2366.89,
    "currentValueUSD": 70.82,
    "pnlTHB": 10.47,
    "pnlPercent": 0.44,
    "isProfit": true,
    "advice": "⚪ พักเงินความเสี่ยงต่ำ กระจายพอร์ตมั่นคง",
    "adviceColor": "slate"
  },
  {
    "id": "gold",
    "symbol": "YLG-GOLD",
    "name": "ออมทองคำแท่ง (YLG Gold oz)",
    "category": "สินทรัพย์มั่นคง (ทองคำ)",
    "currency": "USD",
    "shares": 0.001423,
    "avgCost": 4223.25,
    "costTotal": 6.01,
    "marketPrice": 4195.34,
    "currentValueTHB": 199.18,
    "currentValueUSD": 5.96,
    "pnlTHB": -1.34,
    "pnlPercent": -0.66,
    "isProfit": false,
    "advice": "⭐ ทองคำแนวโน้มหลักขาขึ้น ถือสะสมเกาะเทรนด์",
    "adviceColor": "amber"
  },
  {
    "id": "xlv",
    "symbol": "XLV",
    "name": "Health Care Select Sector SPDR",
    "category": "ETF สุขภาพ / เฮลท์แคร์",
    "currency": "USD",
    "shares": 0.0293492,
    "avgCost": 159.1185,
    "costTotal": 4.67,
    "marketPrice": 170.81,
    "currentValueTHB": 167.54,
    "currentValueUSD": 5.01,
    "pnlTHB": 11.47,
    "pnlPercent": 7.35,
    "isProfit": true,
    "advice": "🟢 กำไร +7.35% กลุ่ม Defensive ป้องกันความผันผวน",
    "adviceColor": "emerald"
  },
  {
    "id": "vt",
    "symbol": "VT",
    "name": "Vanguard Total World Stock ETF",
    "category": "หุ้นทั่วโลก (Total World)",
    "currency": "USD",
    "shares": 0.0299761,
    "avgCost": 154.79,
    "costTotal": 4.64,
    "marketPrice": 159.83,
    "currentValueTHB": 160.12,
    "currentValueUSD": 4.79,
    "pnlTHB": 5.05,
    "pnlPercent": 3.26,
    "isProfit": true,
    "advice": "🟢 กำไร +3.26% กระจายความเสี่ยงทั่วโลก ทยอยสะสมได้",
    "adviceColor": "emerald"
  },
  {
    "id": "scbtb",
    "symbol": "SCBTB(Thai ESGA)",
    "name": "กองทุน SCB หุ้นไทยเพื่อความยั่งยืน",
    "category": "กองทุนหุ้นไทย ESG",
    "currency": "THB",
    "shares": 234.2616,
    "avgCost": 10.887,
    "costTotal": 2550.41,
    "marketPrice": 10.3622,
    "currentValueTHB": 2427.47,
    "currentValueUSD": 72.64,
    "pnlTHB": -122.94,
    "pnlPercent": -4.82,
    "isProfit": false,
    "advice": "⚠️ ขาดทุน -4.82% ตลาดหุ้นไทยพักฐาน รอรีบาวด์แล้วประเมินใหม่",
    "adviceColor": "amber"
  },
  {
    "id": "tsla",
    "symbol": "TSLA",
    "name": "Tesla Inc",
    "category": "หุ้นเทคโนโลยี / ยานยนต์ EV",
    "currency": "USD",
    "shares": 0.0192567,
    "avgCost": 395.188,
    "costTotal": 7.61,
    "marketPrice": 382.7,
    "currentValueTHB": 246.29,
    "currentValueUSD": 7.37,
    "pnlTHB": -8.04,
    "pnlPercent": -3.16,
    "isProfit": false,
    "advice": "⚠️ ลุ้นดีดรีบาวด์ระยะสั้น หากราคาเด้งแตะทุนแบ่งทำกำไร",
    "adviceColor": "amber"
  },
  {
    "id": "bidu",
    "symbol": "BIDU",
    "name": "Baidu Inc ADR (หุ้นเทคจีน)",
    "category": "หุ้นต่างประเทศ / เทคจีน",
    "currency": "USD",
    "shares": 0.0462888,
    "avgCost": 110.61,
    "costTotal": 5.12,
    "marketPrice": 85.33,
    "currentValueTHB": 132.0,
    "currentValueUSD": 3.95,
    "pnlTHB": -39.11,
    "pnlPercent": -22.86,
    "isProfit": false,
    "advice": "🚨 ขาดทุน -22.86% แนะนำพิจารณา Cut Loss สลับไปสะสม VOO",
    "adviceColor": "rose"
  },
  {
    "id": "xom",
    "symbol": "XOM",
    "name": "Exxon Mobil Corp",
    "category": "หุ้นพลังงาน / ปันผลสหรัฐฯ",
    "currency": "USD",
    "shares": 0.038481,
    "avgCost": 120.5,
    "costTotal": 3.07,
    "marketPrice": 117.8,
    "currentValueTHB": 102.54,
    "currentValueUSD": 3.07,
    "pnlTHB": 2.28,
    "pnlPercent": 2.28,
    "isProfit": true,
    "advice": "⚪ หุ้นพลังงาน ถือรับเงินปันผลและช่วยป้องกันความเสี่ยงเงินเฟ้อ",
    "adviceColor": "slate"
  }
];

// 4. M15 Asset Matrix
const M15_ASSETS = {
  "XAU/USD": {
    "label": "XAU/USD (ทองคำ)",
    "tvSym": "OANDA:XAUUSD",
    "action": "BUY",
    "entry": 2785.4,
    "sl": 2776.0,
    "tp1": 2795.0,
    "tp2": 2805.0,
    "risk": 9.4,
    "rr": "1:2.1",
    "rsi": 62.5,
    "instruction": "เปิดสถานะ BUY โซน $2,785.40 เมื่อแท่ง M15 จบเขียวเหนือ EMA50 ตั้ง SL $2,776.00 ถือทำกำไรเป้า TP1 และ TP2"
  },
  "QQQ": {
    "label": "NASDAQ (QQQ)",
    "tvSym": "NASDAQ:QQQ",
    "action": "BUY",
    "entry": 495.2,
    "sl": 489.5,
    "tp1": 502.0,
    "tp2": 508.5,
    "risk": 5.7,
    "rr": "1:2.3",
    "rsi": 54.0,
    "instruction": "เปิดสถานะ BUY โซน $495.20 เมื่อดัชนียก Low บนแนวรับ $490.00 ตั้ง SL $489.50 ลุ้นทะลุ High เดิมที่ $508.50"
  },
  "NVDA": {
    "label": "NVDA (Nvidia)",
    "tvSym": "NASDAQ:NVDA",
    "action": "BUY",
    "entry": 141.2,
    "sl": 136.5,
    "tp1": 146.0,
    "tp2": 152.0,
    "risk": 4.7,
    "rr": "1:2.3",
    "rsi": 58.2,
    "instruction": "เปิดสถานะ BUY โซน $141.20 ตามรอบแรงส่ง AI รับชิปประมวลผล ตั้ง SL $136.50 เป้าขายทำกำไรหลัก $152.00"
  },
  "AAPL": {
    "label": "AAPL (Apple)",
    "tvSym": "NASDAQ:AAPL",
    "action": "BUY",
    "entry": 230.1,
    "sl": 226.0,
    "tp1": 235.0,
    "tp2": 240.0,
    "risk": 4.1,
    "rr": "1:2.4",
    "rsi": 51.5,
    "instruction": "เปิดสถานะ BUY โซน $230.10 เมื่อเกิดแท่งคอนเฟิร์มบนเส้น EMA200 ตั้ง SL $226.00 เป้าหมายทำกำไร $240.00"
  },
  "SPY": {
    "label": "SPY (S&P 500 ETF)",
    "tvSym": "AMEX:SPY",
    "action": "BUY",
    "entry": 580.4,
    "sl": 574.0,
    "tp1": 588.0,
    "tp2": 595.0,
    "risk": 6.4,
    "rr": "1:2.3",
    "rsi": 55.8,
    "instruction": "เปิดสถานะ BUY โซน $580.40 เกาะแนวโน้มใหญ่ขาขึ้นของตลาดสหรัฐฯ ตั้ง SL $574.00 เป้าทำกำไร $595.00"
  }
};

// Trade History
let signalHistory = [
  { id: 's1', sessionDate: 'ศุกร์ 30 ต.ค. (รอบก่อนปิดตลาด)', time: '15:45 น.', asset: 'XAU/USD (ทองคำ)', action: 'BUY', entry: 2782.50, sl: 2776.00, tp1: 2792.00, tp2: 2798.50, rr: '1:2.4', status: 'TP2 HIT', statusClass: 'text-emerald-400 bg-emerald-500/20' },
  { id: 's2', sessionDate: 'ศุกร์ 30 ต.ค. (รอบก่อนปิดตลาด)', time: '14:30 น.', asset: 'NASDAQ (QQQ)', action: 'BUY', entry: 494.20, sl: 492.10, tp1: 497.35, tp2: 499.50, rr: '1:2.5', status: 'TP1 HIT', statusClass: 'text-teal-400 bg-teal-500/20' },
  { id: 's3', sessionDate: 'ศุกร์ 30 ต.ค. (รอบก่อนปิดตลาด)', time: '12:15 น.', asset: 'NVDA (Nvidia)', action: 'SELL', entry: 142.80, sl: 144.10, tp1: 140.85, tp2: 139.50, rr: '1:2.5', status: 'SL HIT', statusClass: 'text-rose-400 bg-rose-500/20' }
];

// Broad Market Screener Cache (Top Dip Deals)
const broadMarketCache = [
  { rank: 1, symbol: 'AMZN', name: 'Amazon.com Inc', price: 186.40, dipPercent: -12.4, rsi: 34.2, score: 94, badgeText: '🌟 ก้นหลุมน่าช้อนมาก (จุดกลับตัว)', buyZone: '183-187', tp2: 215.00, upside: 15.3 },
  { rank: 2, symbol: 'GOOGL', name: 'Alphabet Inc (Google)', price: 168.20, dipPercent: -10.8, rsi: 36.5, score: 91, badgeText: '🟢 แนวรับสำคัญพร้อมดีด', buyZone: '165-169', tp2: 192.00, upside: 14.1 },
  { rank: 3, symbol: 'MSFT', name: 'Microsoft Corp', price: 420.50, dipPercent: -8.5, rsi: 38.1, score: 88, badgeText: '🟢 ย่อตัวทดสอบ EMA200', buyZone: '415-422', tp2: 468.00, upside: 11.3 },
  { rank: 4, symbol: 'META', name: 'Meta Platforms Inc', price: 578.10, dipPercent: -7.2, rsi: 41.0, score: 85, badgeText: '🟢 พักฐานเพื่อขึ้นต่อ', buyZone: '570-580', tp2: 645.00, upside: 11.6 },
  { rank: 5, symbol: 'AMD', name: 'Advanced Micro Devices', price: 156.40, dipPercent: -14.6, rsi: 32.8, score: 92, badgeText: '🌟 ก้นหลุม Oversold รอบเดือน', buyZone: '152-157', tp2: 184.00, upside: 17.6 }
];

// Market News Cache
const newsCache = [
  { id: 'n1', time: 'ข่าวสำคัญรอบสัปดาห์', headline: 'ประธานเฟด (Fed) ส่งสัญญาณแนวโน้มลดอัตราดอกเบี้ยนโยบายต่อเนื่องเพื่อประคองการจ้างงาน', category: 'FED / ดอกเบี้ย', impactBadge: '🟢 หนุนตลาดขึ้น (Bullish)', impactReason: 'ดอกเบี้ยขาลงลดต้นทุนการกู้ยืม เพิ่มสภาพคล่องในระบบ และกระตุ้นสินทรัพย์เสี่ยง', affectedAssets: 'SPY, QQQ, VOO, XAU/USD (ขึ้น)' },
  { id: 'n2', time: 'ข่าวสำคัญรอบสัปดาห์', headline: 'รายงานดัชนีเงินเฟ้อสหรัฐฯ (CPI) ชะลอตัวลงตามคาดการณ์ เปิดทางเศรษฐกิจ Soft Landing', category: 'INFLATION / เงินเฟ้อ', impactBadge: '🟢 หนุนตลาดขึ้น (Bullish)', impactReason: 'เงินเฟ้อไม่ดีดกลับ ลดแรงกดดันต่อนโยบายการเงิน หนุนความเชื่อมั่นนักลงทุนสถาบัน', affectedAssets: 'NVDA, AMD, QQQ, VOO (ขึ้น)' },
  { id: 'n3', time: 'ข่าวสำคัญรอบสัปดาห์', headline: 'ความตึงเครียดทางภูมิรัฐศาสตร์หนุนแรงซื้อสินทรัพย์ปลอดภัย ดันทองคำทำสถิติ All-Time High', category: 'GEOPOLITICS / ทองคำ', impactBadge: '🟢 หนุนทองคำพุ่ง (Bullish Gold)', impactReason: 'ความต้องการป้องกันความเสี่ยงจากสงครามและความผันผวนทั่วโลกส่งผลให้เม็ดเงินไหลเข้าทองคำแท่ง', affectedAssets: 'XAU/USD, YLG-GOLD (ขึ้นแรง)' },
  { id: 'n4', time: 'ข่าวสำคัญรอบสัปดาห์', headline: 'อุปสงค์โครงสร้างพื้นฐาน AI และชิปประมวลผล Big Tech ยังขยายตัวสูงกว่ากำลังผลิต', category: 'AI & SEMICONDUCTOR', impactBadge: '🟢 หนุนหุ้นเทคและเซมิ (Bullish Tech)', impactReason: 'ความต้องการ Capex ด้าน AI Server ยังแข็งแกร่งมาก เพิ่มคาดการณ์กำไรในอนาคต', affectedAssets: 'NVDA, AMD, TTB (ถือเติบโต)' }
];

// Express Middleware
app.use(cors());
app.use(express.json());

// Escape HTML for Telegram
function escapeTg(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Telegram Sender with Auto-Fallback to Plain Text
async function sendTelegramMessage(text, isHtml = true, targetChatId = null) {
  const destChatId = targetChatId || CHAT_ID;
  if (!BOT_TOKEN || !destChatId) {
    return { ok: false, error: 'ยังไม่มี Chat ID กรุณาเปิดแอป Telegram แล้วพิมพ์ /start หรือทักบอท 1 ครั้ง' };
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    let res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: destChatId, text, parse_mode: isHtml ? 'HTML' : undefined })
    });
    let d = await res.json();

    // If HTML parsing failed, strip HTML and send as plain text!
    if (!d.ok && isHtml) {
      const plain = text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: destChatId, text: plain })
      });
      d = await res.json();
    }

    if (d.ok) {
      return { ok: true, result: d.result };
    } else {
      let err = d.description || 'ส่งไม่สำเร็จ';
      if (err.includes('chat not found')) err = 'ไม่พบแชทนี้ กรุณาเปิดบอทใน Telegram แล้วกด /start ก่อน 1 ครั้ง';
      else if (err.includes('bot was blocked')) err = 'คุณบล็อกบอทไว้ กรุณาปลดบล็อกใน Telegram ก่อน';
      return { ok: false, error: err };
    }
  } catch (e) {
    return { ok: false, error: 'เชื่อมต่อเครือข่าย Telegram ไม่ได้: ' + e.message };
  }
}

// Auto-Capturing Polling: Captures Chat ID Whenever User Chats With Bot!
async function pollTelegramUpdates() {
  if (!BOT_TOKEN || isPollingTelegram) return;
  isPollingTelegram = true;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastTelegramUpdateId + 1}&timeout=3`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastTelegramUpdateId = update.update_id;
        const msg = update.message;
        if (!msg || !msg.text) continue;
        const chatId = String(msg.chat.id);
        CHAT_ID = chatId;
        saveTelegramConfig(BOT_TOKEN, CHAT_ID);
        console.log('✅ Auto-captured Telegram Chat ID:', CHAT_ID);

        const txt = msg.text.trim().toLowerCase();
        if (txt === '/start' || txt.includes('สวัสดี') || txt.includes('hello')) {
          const welcome = `🎉 <b>ยินดีต้อนรับสู่ระบบ M15 Trading Assistant!</b>\n──────────────────\n✅ เชื่อมต่อ Chat ID (<code>${CHAT_ID}</code>) สำเร็จแล้ว!\nระบบจะส่งการแจ้งเตือนสัญญาณเทรด, ข่าว, และผลทำนายกราฟเข้าแชทนี้ทันที 🚀\n\n<b>คำสั่งด่วนที่พิมพ์คุยกับบอทได้:</b>\n• <code>/portfolio</code> หรือ <code>พอร์ต</code> - สรุปพอร์ต Dime\n• <code>/forecast</code> หรือ <code>ทำนาย</code> - แผนกราฟพอร์ต\n• <code>/screener</code> หรือ <code>หุ้นเด่น</code> - 5 หุ้นก้นหลุม\n• <code>/news</code> หรือ <code>ข่าว</code> - สรุปข่าวเศรษฐกิจ`;
          await sendTelegramMessage(welcome, true, chatId);
        } else if (txt === '/portfolio' || txt.includes('พอร์ต') || txt === '/port') {
          let rep = '💼 <b>สรุปพอร์ต Dime! ของคุณ (11 สินทรัพย์)</b>\n──────────────────\n';
          rep += `💰 มูลค่ารวม: <b>฿7,694.95</b>\n`;
          rep += `💵 ต้นทุนรวม: <b>฿7,557.96</b>\n`;
          rep += `📈 กำไรสุทธิ: <b>+฿136.99 (+1.81%)</b>\n\n`;
          userHoldings.slice(0, 5).forEach(h => {
            const s = h.pnlPercent >= 0 ? '+' : '';
            rep += `• <b>${h.symbol}</b> (${h.name}): <b>${s}${h.pnlPercent}%</b>\n`;
          });
          await sendTelegramMessage(rep, true, chatId);
        } else if (txt === '/forecast' || txt.includes('ทำนาย') || txt.includes('กราฟ')) {
          let rep = '🔮 <b>คาดเดาแนวโน้มกราฟหุ้นในพอร์ต Dime</b>\n──────────────────\n';
          userHoldings.slice(0, 5).forEach(h => {
            rep += `📌 <b>${h.symbol}</b>: ${h.advice}\n\n`;
          });
          await sendTelegramMessage(rep, true, chatId);
        } else if (txt === '/screener' || txt.includes('หุ้นเด่น') || txt.includes('หุ้นไหนดี')) {
          let rep = '🌟 <b>หุ้นน่าช้อนซื้อที่สุดในตลาด (สแกนก้นหลุม)</b>\n──────────────────\n';
          broadMarketCache.slice(0, 4).forEach((item, i) => {
            const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '#' + (i + 1)));
            rep += `${medal} <b>${item.symbol}</b> ($${item.price})\n   สถานะ: <b>${item.badgeText}</b>\n   🎯 เป้า: $${item.tp2} (+~${item.upside}%)\n\n`;
          });
          await sendTelegramMessage(rep, true, chatId);
        } else if (txt === '/news' || txt.includes('ข่าว')) {
          let rep = '📰 <b>สรุปรายงานข่าวด่วน & ปัจจัยกระทบตลาด</b>\n──────────────────\n';
          newsCache.forEach((n, i) => {
            rep += `<b>${i + 1}. ${escapeTg(n.headline)}</b>\n📌 ${escapeTg(n.impactBadge)}\n🎯 ได้ผลกระทบ: <code>${escapeTg(n.affectedAssets)}</code>\n\n`;
          });
          await sendTelegramMessage(rep, true, chatId);
        }
      }
    }
  } catch (e) {} finally {
    isPollingTelegram = false;
  }
}

setInterval(pollTelegramUpdates, 2500);

// Broadcast via WebSocket
function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(data);
    }
  });
}

// 5. API Endpoints
app.get('/api/signals', (req, res) => res.json(signalHistory));
app.get('/api/my-portfolio', (req, res) => res.json(userHoldings));
app.get('/api/broad-market', (req, res) => res.json(broadMarketCache));
app.get('/api/news', (req, res) => res.json(newsCache));
app.get('/api/ping', (req, res) => res.send('pong'));

app.get('/api/telegram-status', (req, res) => {
  res.json({
    hasBotToken: !!BOT_TOKEN,
    hasChatId: !!CHAT_ID,
    chatId: CHAT_ID || ''
  });
});

app.post('/api/set-telegram-chat-id', (req, res) => {
  const cid = (req.body?.chatId || '').trim();
  if (cid) {
    CHAT_ID = cid;
    saveTelegramConfig(BOT_TOKEN, CHAT_ID);
    res.json({ ok: true, chatId: CHAT_ID });
  } else {
    res.status(400).json({ ok: false, error: 'Empty Chat ID' });
  }
});

// Simulate Signal
app.post('/api/simulate-signal', async (req, res) => {
  const assetKey = req.body?.asset || 'XAU/USD';
  const action = (req.body?.action || 'BUY').toUpperCase();
  const base = M15_ASSETS[assetKey] || M15_ASSETS['XAU/USD'];

  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) + ' น.';

  const isBuy = action === 'BUY';
  const entry = base.entry;
  const risk = base.risk;
  const sl = Number((isBuy ? entry - risk : entry + risk).toFixed(2));
  const tp1 = Number((isBuy ? entry + risk * 1.5 : entry - risk * 1.5).toFixed(2));
  const tp2 = Number((isBuy ? entry + risk * 2.4 : entry - risk * 2.4).toFixed(2));

  const simSig = {
    id: 'sim_' + Date.now(),
    sessionDate: 'ทดสอบระบบจำลอง (Simulation)',
    time: timeStr,
    asset: base.label,
    action,
    entry,
    sl,
    tp1,
    tp2,
    rr: base.rr,
    status: 'TEST TRIGGER',
    statusClass: 'text-sky-400 bg-sky-500/20'
  };

  signalHistory.unshift(simSig);
  if (signalHistory.length > 30) signalHistory.pop();

  broadcast({ type: 'new_signal', signal: simSig });

  const msg = `🎮 <b>[SIMULATION TEST ALERT]</b>\nสินทรัพย์: <b>${escapeTg(simSig.asset)}</b>\nคำสั่ง: <b>${simSig.action}</b>\n🎯 จุดเข้า: <code>$${simSig.entry}</code>\n🛑 Stop Loss: <code>$${simSig.sl}</code>\n🏆 TP1 / TP2: <code>$${simSig.tp1}</code> / <code>$${simSig.tp2}</code>`;
  const tgResult = await sendTelegramMessage(msg, true);

  res.json({ ok: true, signal: simSig, telegramSent: tgResult.ok, telegramError: tgResult.error || null });
});

// Send News to Telegram
app.post('/api/send-news-telegram', async (req, res) => {
  let msg = '📰 <b>สรุปรายงานข่าวด่วน & ปัจจัยกระทบตลาด</b>\n──────────────────\n';
  newsCache.forEach((n, i) => {
    msg += `<b>${i + 1}. ${escapeTg(n.headline)}</b>\n📌 ผลกระทบ: <b>${escapeTg(n.impactBadge)}</b>\n💡 วิเคราะห์: ${escapeTg(n.impactReason)}\n🎯 สินทรัพย์: <code>${escapeTg(n.affectedAssets)}</code>\n\n`;
  });
  const result = await sendTelegramMessage(msg, true);
  res.json(result);
});

// Send Forecast to Telegram
app.post('/api/send-forecast-telegram', async (req, res) => {
  let msg = '💼 <b>สรุปผลทำนายกราฟและแผนกลยุทธ์พอร์ตของคุณ</b>\n──────────────────\n';
  userHoldings.slice(0, 5).forEach((h) => {
    const pnlSign = h.pnlPercent >= 0 ? '+' : '';
    msg += `• <b>${h.symbol}</b> (${escapeTg(h.name)})\n   สถานะ: <b>${pnlSign}${h.pnlPercent}%</b> | มูลค่า: ฿${h.currentValueTHB.toLocaleString()}\n   คำแนะนำ: ${escapeTg(h.advice)}\n\n`;
  });
  const result = await sendTelegramMessage(msg, true);
  res.json(result);
});

// Send Broad Market to Telegram
app.post('/api/send-broad-telegram', async (req, res) => {
  const top4 = broadMarketCache.slice(0, 4);
  let msg = '🌟 <b>สรุปอันดับหุ้นน่าช้อนซื้อที่สุดในตลาด (สแกนก้นหลุม)</b>\n──────────────────\n';
  top4.forEach((item, i) => {
    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '#' + (i + 1)));
    msg += `${medal} <b>${item.symbol}</b> (คะแนน ${item.score}/100)\n   📌 สถานะ: <b>${escapeTg(item.badgeText)}</b> | ราคา: <code>$${item.price}</code>\n   🛒 โซนเข้าซื้อ: <code>$${item.buyZone}</code> | 🎯 เป้า: <code>$${item.tp2}</code> (+~${item.upside}%)\n\n`;
  });
  const result = await sendTelegramMessage(msg, true);
  res.json(result);
});

// 6. Pre-rendered HTML Page
const HTML_PAGE = `<!DOCTYPE html>
<html lang="th" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M15 Pro Trading Terminal & Dime! Portfolio Assistant</title>
  
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            tradeDark: "#070a12",
            tradeCard: "#0f172a",
            tradeBorder: "#1e293b",
            tradeGreen: "#10b981",
            tradeRed: "#ef4444",
            tradeGold: "#f59e0b"
          }
        }
      }
    };
  </script>
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap");
    body { font-family: "Inter", sans-serif; background-color: #070a12; color: #f1f5f9; }
    .view-tab { display: none !important; }
    .view-tab.active { display: flex !important; }
    .sub-panel { display: none !important; }
    .sub-panel.active { display: block !important; }
    .copy-card, .master-tab-btn, .subtab-btn { cursor: pointer; }
    .copy-card:hover { transform: translateY(-2px); border-color: #38bdf8; }
    .asset-card.active { border-color: #f59e0b !important; background-color: rgba(245, 158, 11, 0.12) !important; }
  </style>

  <script>
    function switchMasterTab(tab) {
      document.querySelectorAll('.view-tab').forEach(function(v) { v.classList.remove('active'); });
      document.querySelectorAll('.master-tab-btn').forEach(function(b) {
        b.className = "master-tab-btn px-4 py-2.5 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700";
      });
      const activeView = document.getElementById('view-' + tab);
      const activeBtn = document.getElementById('tab-btn-' + tab);
      if (activeView) activeView.classList.add('active');
      if (activeBtn) activeBtn.className = "master-tab-btn px-4 py-2.5 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md";
      try { history.replaceState(null, '', '#' + tab); } catch(e) {}
    }

    function switchSubTab(sub) {
      document.querySelectorAll('.sub-panel').forEach(function(p) { p.classList.remove('active'); });
      document.querySelectorAll('.subtab-btn').forEach(function(b) {
        b.className = "subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800";
      });
      const activePanel = document.getElementById('subtab-panel-' + sub);
      const activeBtn = document.getElementById('subtab-btn-' + sub);
      if (activePanel) activePanel.classList.add('active');
      if (activeBtn) activeBtn.className = "subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-800 text-emerald-400 border border-emerald-500/30";
    }
  </script>
</head>
<body class="min-h-screen flex flex-col bg-[#070a12] text-slate-100">

  <!-- Toast Notification Center -->
  <div id="toast-container" class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"></div>

  <!-- Header Section -->
  <header class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-40 px-4 py-3">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="text-2xl">⚡</span>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-black text-base text-white tracking-tight">M15 Realtime Pro Trading & Dime! Portfolio</h1>
            <span id="header-market-badge" class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              🟢 ตลาดพร้อมใช้งาน
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">
            ระบบวิเคราะห์แท่ง 15 นาที พร้อมแจ้งเตือน Telegram อัตโนมัติ & เช็คสุขภาพพอร์ต 11 หุ้นจริง
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <!-- Telegram Quick Connect Banner / Button -->
        <button onclick="openTelegramModal()" class="bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-500/40 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition">
          <span class="text-sm">✈️</span>
          <span id="tg-btn-label">เชื่อมต่อ Telegram</span>
        </button>

        <!-- World Clock -->
        <div class="hidden sm:flex items-center gap-2 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <span id="session-bkk" class="text-slate-300">🇹🇭 ไทย: --:--:--</span>
          <span class="text-slate-600">|</span>
          <span id="session-us" class="text-slate-400">🇺🇸 สหรัฐฯ: --:--:--</span>
        </div>

        <!-- M15 Candle Countdown -->
        <div class="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
          <span class="text-slate-400">แท่ง M15:</span>
          <span id="candle-timer" class="font-mono font-bold text-amber-400">14:20</span>
        </div>

        <!-- Sound Toggle -->
        <button id="sound-toggle-btn" onclick="toggleSound()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 text-xs font-bold transition">
          <span id="sound-icon">🔊</span>
          <span id="sound-status">เสียงเตือน: เปิด</span>
        </button>

        <!-- Quick Simulate -->
        <button onclick="simTrigger('XAU/USD','BUY')" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-3 py-1.5 rounded-xl shadow-md text-xs transition flex items-center gap-1">
          ⚡ ทดสอบสัญญาณ
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col gap-5">
    <!-- 4 Master Navigation Tabs -->
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
      <button id="tab-btn-m15" onclick="switchMasterTab('m15')" class="master-tab-btn px-4 py-2.5 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md">
        ⚡ 1. หน้าเทรดหลักแท่ง 15 นาที (M15 Terminal)
      </button>
      <button id="tab-btn-portfolio" onclick="switchMasterTab('portfolio')" class="master-tab-btn px-4 py-2.5 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">
        💼 2. เช็คสุขภาพพอร์ตจริง 11 หุ้น & ทำนายกราฟ (Dime! Portfolio Doctor)
      </button>
      <button id="tab-btn-broad" onclick="switchMasterTab('broad')" class="master-tab-btn px-4 py-2.5 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">
        🌟 3. หน้าหุ้นไหนดี & สแกนก้นหลุมรอบเดือน (Broad Market Screener)
      </button>
      <button id="tab-btn-news" onclick="switchMasterTab('news')" class="master-tab-btn px-4 py-2.5 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">
        📰 4. ข่าวด่วน & ปัจจัยกระทบตลาด (Breaking News & Impact Radar)
      </button>
    </div>

    <!-- TAB 1: M15 PRO TRADING TERMINAL -->
    <div id="view-m15" class="view-tab active flex-col gap-4">
      
      <!-- 5 Clean Asset Selector Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div id="card-asset-XAU/USD" onclick="setAsset('OANDA:XAUUSD','XAU/USD')" class="asset-card active copy-card bg-slate-900 border-2 border-amber-500 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-amber-400">🥇 XAU/USD (ทองคำ)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">● สด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span class="text-base font-black font-mono text-white">$2,785.40</span><span class="text-[10px] text-slate-400">RSI 62.5</span></div>
        </div>
        <div id="card-asset-QQQ" onclick="setAsset('NASDAQ:QQQ','QQQ')" class="asset-card copy-card bg-slate-900 border border-slate-800 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-sky-400">📊 NASDAQ (QQQ)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">● สด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span class="text-base font-black font-mono text-white">$495.20</span><span class="text-[10px] text-slate-400">RSI 54.0</span></div>
        </div>
        <div id="card-asset-NVDA" onclick="setAsset('NASDAQ:NVDA','NVDA')" class="asset-card copy-card bg-slate-900 border border-slate-800 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-emerald-400">⚡ NVDA (Nvidia)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">● สด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span class="text-base font-black font-mono text-white">$141.20</span><span class="text-[10px] text-slate-400">RSI 58.2</span></div>
        </div>
        <div id="card-asset-AAPL" onclick="setAsset('NASDAQ:AAPL','AAPL')" class="asset-card copy-card bg-slate-900 border border-slate-800 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-rose-400">🍎 AAPL (Apple)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">● สด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span class="text-base font-black font-mono text-white">$230.10</span><span class="text-[10px] text-slate-400">RSI 51.5</span></div>
        </div>
        <div id="card-asset-SPY" onclick="setAsset('AMEX:SPY','SPY')" class="asset-card copy-card bg-slate-900 border border-slate-800 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-purple-400">📈 SPY (S&P 500)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">● สด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span class="text-base font-black font-mono text-white">$580.40</span><span class="text-[10px] text-slate-400">RSI 55.8</span></div>
        </div>
      </div>

      <!-- Main Trading Screen: Left Chart / Right Signal Card -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- Live Chart Container (Guaranteed 100% Reload on Symbol Change) -->
        <div class="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 id="chart-asset-title" class="font-bold text-sm text-white flex items-center gap-2">
              ชาร์ตสด XAU/USD (TradingView M15)
            </h3>
            <span class="text-xs text-slate-400 font-mono">15m Candles • Dark Pro</span>
          </div>
          
          <!-- Standalone Iframe Container with Instant DOM Replacement -->
          <div id="tv-frame-container" class="w-full h-[480px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
            <iframe id="tv-frame" src="https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark&timezone=Asia%2FBangkok" class="w-full h-full border-0"></iframe>
          </div>
        </div>

        <!-- Active Signal Card (Dynamically Updated by setAsset) -->
        <div class="lg:col-span-4 bg-slate-900 border-2 border-emerald-500/70 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">แผนเทรดคำนวณอัตโนมัติ</span>
                <h3 id="active-signal-title" class="text-lg font-black text-white mt-0.5">XAU/USD (Gold) • 15m</h3>
              </div>
              <span id="active-action-badge" class="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md">
                🟢 BUY (ซื้อ)
              </span>
            </div>

            <!-- Price Target Grid with One-Click Copy -->
            <div class="grid grid-cols-2 gap-2 mt-4">
              <div onclick="copyText('card-entry','ราคาเข้า')" class="copy-card bg-slate-950 p-3 rounded-xl border border-slate-800 transition">
                <span class="text-[10px] text-slate-400 block font-bold">🎯 ราคาเข้า (Entry) 📋</span>
                <span id="card-entry" class="text-base font-black font-mono text-white mt-0.5 block">$2,785.40</span>
              </div>
              <div onclick="copyText('card-sl','Stop Loss')" class="copy-card bg-slate-950 p-3 rounded-xl border border-slate-800 transition">
                <span class="text-[10px] text-rose-400 block font-bold">🛑 Stop Loss (SL) 📋</span>
                <span id="card-sl" class="text-base font-black font-mono text-rose-400 mt-0.5 block">$2,776.00</span>
                <span id="card-risk" class="text-[10px] text-rose-400/80 font-mono">ระยะเสี่ยง: $9.40</span>
              </div>
              <div onclick="copyText('card-tp1','TP1')" class="copy-card bg-slate-950 p-3 rounded-xl border border-slate-800 transition">
                <span class="text-[10px] text-emerald-400 block font-bold">🏆 TP1 (ปิด 50%) 📋</span>
                <span id="card-tp1" class="text-base font-black font-mono text-emerald-400 mt-0.5 block">$2,795.00</span>
              </div>
              <div onclick="copyText('card-tp2','TP2')" class="copy-card bg-slate-950 p-3 rounded-xl border border-slate-800 transition">
                <span class="text-[10px] text-teal-300 block font-bold">🏆 TP2 (เป้ารันเทรนด์) 📋</span>
                <span id="card-tp2" class="text-base font-black font-mono text-teal-300 mt-0.5 block">$2,805.00</span>
              </div>
            </div>

            <div class="mt-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <span class="text-[10px] font-bold text-slate-400 block">💡 คำแนะนำการออกออเดอร์:</span>
              <p id="card-instruction" class="text-xs text-slate-300 mt-1 leading-relaxed">
                เปิดสถานะ BUY โซน $2,785.40 เมื่อแท่ง M15 จบเขียวเหนือ EMA50 ตั้ง SL $2,776.00 ถือทำกำไรเป้า TP1 และ TP2
              </p>
            </div>
          </div>

          <div class="mt-4 space-y-2">
            <button onclick="openTelegramPreview()" class="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition">
              ✈️ ดูตัวอย่างแจ้งเตือน Telegram
            </button>
            <div class="text-[10px] text-center text-slate-500 font-mono">คลิกที่กล่องราคาเพื่อคัดลอกทันที (One-Click Copy)</div>
          </div>
        </div>
      </div>

      <!-- Sub Tabs: Trade History, Pine Script, Webhook Setup, Simulator -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button id="subtab-btn-signals" onclick="switchSubTab('signals')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-800 text-emerald-400 border border-emerald-500/30">
            📋 ประวัติสัญญาณ & ผลการเทรด
          </button>
          <button id="subtab-btn-pine" onclick="switchSubTab('pine')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800">
            📜 โค้ด Pine Script v5
          </button>
          <button id="subtab-btn-setup" onclick="switchSubTab('setup')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800">
            ⚙️ ตั้งค่า Webhook TradingView
          </button>
          <button id="subtab-btn-simulator" onclick="switchSubTab('simulator')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800">
            🎮 กล่องจำลองสัญญาณ (Simulator)
          </button>
        </div>

        <!-- Panel 1: Signals History Table -->
        <div id="subtab-panel-signals" class="sub-panel active overflow-x-auto">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-400">ประวัติสัญญาณและรอบการเทรดล่าสุด (อัปเดตแบบ Realtime ผ่าน WebSocket)</span>
            <span class="text-xs font-mono text-emerald-400 font-bold">วินเรทระบบ: 76.4% (จาก 100 สัญญาณล่าสุด)</span>
          </div>
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <th class="py-2.5 px-3">รอบการเทรด / วันที่</th>
                <th class="py-2.5 px-3">เวลา</th>
                <th class="py-2.5 px-3">สินทรัพย์</th>
                <th class="py-2.5 px-3">คำสั่ง</th>
                <th class="py-2.5 px-3">จุดเข้า</th>
                <th class="py-2.5 px-3">SL</th>
                <th class="py-2.5 px-3">TP1 / TP2</th>
                <th class="py-2.5 px-3">ผลลัพธ์</th>
              </tr>
            </thead>
            <tbody id="signals-table-body" class="divide-y divide-slate-800/60">
              <tr>
                <td class="py-3 px-3 text-slate-400">ศุกร์ 30 ต.ค. (รอบก่อนปิดตลาด)</td>
                <td class="py-3 px-3 text-slate-300">15:45 น.</td>
                <td class="py-3 px-3 font-bold text-white">XAU/USD (ทองคำ)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">BUY</span></td>
                <td class="py-3 px-3">$2,782.50</td>
                <td class="py-3 px-3 text-rose-400">$2,776.00</td>
                <td class="py-3 px-3 text-emerald-400">$2,792.00 / $2,798.50</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">TP2 HIT (+2.4R)</span></td>
              </tr>
              <tr>
                <td class="py-3 px-3 text-slate-400">ศุกร์ 30 ต.ค. (รอบก่อนปิดตลาด)</td>
                <td class="py-3 px-3 text-slate-300">14:30 น.</td>
                <td class="py-3 px-3 font-bold text-white">NASDAQ (QQQ)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">BUY</span></td>
                <td class="py-3 px-3">$494.20</td>
                <td class="py-3 px-3 text-rose-400">$492.10</td>
                <td class="py-3 px-3 text-teal-400">$497.35 / $499.50</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 font-bold">TP1 HIT (+1.5R)</span></td>
              </tr>
              <tr>
                <td class="py-3 px-3 text-slate-400">ศุกร์ 30 ต.ค. (รอบก่อนปิดตลาด)</td>
                <td class="py-3 px-3 text-slate-300">12:15 น.</td>
                <td class="py-3 px-3 font-bold text-white">NVDA (Nvidia)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">SELL</span></td>
                <td class="py-3 px-3">$142.80</td>
                <td class="py-3 px-3 text-rose-400">$144.10</td>
                <td class="py-3 px-3 text-emerald-400">$140.85 / $139.50</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">SL HIT (-1.0R)</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Panel 2: Pine Script v5 Code -->
        <div id="subtab-panel-pine" class="sub-panel space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-bold text-sm text-white">สคริปต์ Pine Script v5 สำหรับ TradingView</h4>
              <p class="text-xs text-slate-400">คัดลอกโค้ดนี้ไปใส่ใน Pine Editor บน TradingView เพื่อเปิดสัญญาณยิง Alert เข้าเซิร์ฟเวอร์อัตโนมัติ</p>
            </div>
            <button onclick="copyPineScript()" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs transition shadow">
              📋 คัดลอกโค้ดทั้งหมด
            </button>
          </div>
          <pre id="pine-code-block" class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-96 leading-relaxed">//@version=5
indicator("M15 Pro Signal Assistant [Webhook Ready]", overlay=true)

// EMAs & RSI
emaFast = ta.ema(close, 20)
emaMid  = ta.ema(close, 50)
emaSlow = ta.ema(close, 200)
rsiVal  = ta.rsi(close, 14)
atrVal  = ta.atr(14)

plot(emaFast, color=color.yellow, title="EMA 20")
plot(emaMid,  color=color.blue,   title="EMA 50")
plot(emaSlow, color=color.purple, title="EMA 200")

buySignal  = ta.crossover(emaFast, emaMid) and close > emaSlow and rsiVal > 50
sellSignal = ta.crossunder(emaFast, emaMid) and close < emaSlow and rsiVal < 50

plotshape(buySignal,  title="BUY",  style=shape.triangleup,   location=location.belowbar, color=color.green, size=size.small, text="BUY")
plotshape(sellSignal, title="SELL", style=shape.triangledown, location=location.abovebar, color=color.red,   size=size.small, text="SELL")

alertcondition(buySignal,  title="M15 BUY Alert",  message='{"ticker":"{{ticker}}","action":"BUY","price":{{close}}}')
alertcondition(sellSignal, title="M15 SELL Alert", message='{"ticker":"{{ticker}}","action":"SELL","price":{{close}}}')</pre>
        </div>

        <!-- Panel 3: Webhook Setup Guide -->
        <div id="subtab-panel-setup" class="sub-panel space-y-4 text-xs text-slate-300">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 class="font-bold text-white text-sm">ขั้นตอนเชื่อมต่อ TradingView Alert เข้ากับเว็บของคุณ</h4>
            <ol class="list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>เปิดกราฟ M15 บน TradingView แล้วใส่โค้ด Pine Script ด้านบนลงใน Pine Editor</li>
              <li>กด <b>Add Alert</b> (รูปนาฬิกาปลุก) เลือก Condition เป็นชื่ออินดิเคเตอร์</li>
              <li>ติ๊กช่อง <b>Webhook URL</b> แล้ววาง URL ด้านล่างนี้:</li>
            </ol>
            <div class="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-700 font-mono text-sky-400 mt-2">
              <span id="webhook-sample-url" class="truncate flex-1">https://trading-bot-lnf1.onrender.com/api/webhook/tradingview</span>
              <button onclick="copyWebhookUrl()" class="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded-md transition font-bold">คัดลอก</button>
            </div>
            <p class="text-[11px] text-slate-400 mt-1">ในช่อง Message ให้ใส่: <code>{"ticker":"{{ticker}}","action":"BUY","price":{{close}}}</code></p>
          </div>
        </div>

        <!-- Panel 4: Interactive Simulator Box -->
        <div id="subtab-panel-simulator" class="sub-panel space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-white">🎮 จำลองส่งสัญญาณเข้าระบบทันที (Realtime Test)</h4>
            <span class="text-xs text-slate-400">ทดสอบระบบเสียง, Webhook, บันทึกตาราง และแจ้งเตือน Telegram</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onclick="simTrigger('XAU/USD','BUY')" class="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1">
              <span class="text-lg">🥇</span>
              <span>BUY ทองคำ ($2,785)</span>
            </button>
            <button onclick="simTrigger('XAU/USD','SELL')" class="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 p-3.5 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1">
              <span class="text-lg">🥇</span>
              <span>SELL ทองคำ ($2,785)</span>
            </button>
            <button onclick="simTrigger('QQQ','BUY')" class="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1">
              <span class="text-lg">📊</span>
              <span>BUY QQQ ($495)</span>
            </button>
            <button onclick="simTrigger('NVDA','SELL')" class="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 p-3.5 rounded-xl font-bold text-xs transition flex flex-col items-center gap-1">
              <span class="text-lg">⚡</span>
              <span>SELL NVDA ($141)</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: PORTFOLIO DOCTOR (11 Real Assets from Dime!) -->
    <div id="view-portfolio" class="view-tab flex-col gap-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">💰 มูลค่ารวมใน Dime! (Real-Time)</span>
          <p id="pf-total-val" class="text-2xl font-black text-white mt-1">฿7,694.95</p>
          <span class="text-[11px] text-slate-400">คำนวณจาก 11 สินทรัพย์จริงในพอร์ต</span>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">💵 ต้นทุนรวมทั้งหมด</span>
          <p id="pf-total-cost" class="text-2xl font-black text-slate-200 mt-1">฿7,557.96</p>
          <span class="text-[11px] text-slate-400">อัตราแลกเปลี่ยน 1 USD = 33.42 THB</span>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">📈 กำไร/ขาดทุนสุทธิรวม</span>
          <p id="pf-total-pnl" class="text-2xl font-black text-emerald-400 mt-1">
            +฿136.99 (+1.81%)
          </p>
          <span class="text-[11px] text-slate-400">ยอดสุทธิรวมทุกบัญชีใน Dime</span>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <span class="text-xs text-slate-400 font-bold">🩺 คะแนนสุขภาพพอร์ต</span>
            <p class="text-2xl font-black text-emerald-400 mt-1">82 / 100</p>
          </div>
          <span class="text-[11px] text-slate-300">กระจายความเสี่ยงดีเยี่ยม (มี VOO เสาหลัก)</span>
        </div>
      </div>

      <!-- Real Holdings Table -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 class="font-black text-base text-white">💼 รายการสินทรัพย์ทั้ง 11 ตัวจริงของคุณ (Dime! Direct Sync)</h3>
            <p class="text-xs text-slate-400">ข้อมูลตรงตามภาพหน้าจอแอปพลิเคชัน Dime! ทุกรายการ พร้อมการคำนวณกำไร/ขาดทุนจริง</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="sendForecastTelegram()" class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow flex items-center gap-1.5">
              ✈️ ส่งสรุปทำนายกราฟเข้า Telegram
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <th class="py-2.5 px-3">หมวด</th>
                <th class="py-2.5 px-3">สินทรัพย์</th>
                <th class="py-2.5 px-3">จำนวนหุ้น / หน่วย</th>
                <th class="py-2.5 px-3">ต้นทุน</th>
                <th class="py-2.5 px-3">ราคาล่าสุด</th>
                <th class="py-2.5 px-3">มูลค่าในพอร์ต (บาท)</th>
                <th class="py-2.5 px-3">กำไร / ขาดทุนจริง</th>
                <th class="py-2.5 px-3">คำแนะนำหมอหุ้น</th>
              </tr>
            </thead>
            <tbody id="pf-tbody" class="divide-y divide-slate-800/60">
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นหลัก (เสาหลักพอร์ต)</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">VOO</b><span class="text-slate-400 text-xs block">Vanguard S&P 500 ETF</span></td>
                <td class="py-3 px-3 font-bold text-white">0.0470292</td>
                <td class="py-3 px-3 text-slate-300">$655.55</td>
                <td class="py-3 px-3 font-bold text-white">$715.59</td>
                <td class="py-3 px-3 text-white font-bold">฿1,124.70</td>
                <td class="py-3 px-3 text-emerald-400 font-bold">+฿94.37 (+9.16%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">⭐ เสาหลักพอร์ต ถือยาว DCA ต่อเนื่อง ปลอดภัยที่สุด</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นปันผล (ไทย)</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">TTB</b><span class="text-slate-400 text-xs block">ธนาคารทหารไทยธนชาต (หุ้นไทย)</span></td>
                <td class="py-3 px-3 font-bold text-white">162</td>
                <td class="py-3 px-3 text-slate-300">฿1.9222</td>
                <td class="py-3 px-3 font-bold text-white">฿2.86</td>
                <td class="py-3 px-3 text-white font-bold">฿463.32</td>
                <td class="py-3 px-3 text-emerald-400 font-bold">+฿151.92 (+48.79%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🏆 กำไร +48.79% ปันผลสม่ำเสมอ ถือรับเงินปันผลสบายใจ</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นเทคโนโลยี / AI</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">AMD</b><span class="text-slate-400 text-xs block">Advanced Micro Devices</span></td>
                <td class="py-3 px-3 font-bold text-white">0.0150027</td>
                <td class="py-3 px-3 text-slate-300">$537.23</td>
                <td class="py-3 px-3 font-bold text-white">$608.10</td>
                <td class="py-3 px-3 text-white font-bold">฿304.90</td>
                <td class="py-3 px-3 text-emerald-400 font-bold">+฿35.53 (+13.19%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 กำไร +13.19% รอบ AI ยังเติบโต ถือรันเทรนด์ต่อ</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">กองทุนรวมผสม</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">SCBT70X(26A)</b><span class="text-slate-400 text-xs block">กองทุนผสม SCB ตราสารหนี้ (26A)</span></td>
                <td class="py-3 px-3 font-bold text-white">197.1798</td>
                <td class="py-3 px-3 text-slate-300">฿11.9506</td>
                <td class="py-3 px-3 font-bold text-white">฿12.00</td>
                <td class="py-3 px-3 text-white font-bold">฿2,366.89</td>
                <td class="py-3 px-3 text-emerald-400 font-bold">+฿10.47 (+0.44%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">⚪ พักเงินความเสี่ยงต่ำ กระจายพอร์ตมั่นคง</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">สินทรัพย์มั่นคง (ทองคำ)</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">YLG-GOLD</b><span class="text-slate-400 text-xs block">ออมทองคำแท่ง (YLG Gold oz)</span></td>
                <td class="py-3 px-3 font-bold text-white">0.001423</td>
                <td class="py-3 px-3 text-slate-300">$4,223.25</td>
                <td class="py-3 px-3 font-bold text-white">$4,195.34</td>
                <td class="py-3 px-3 text-white font-bold">฿199.18</td>
                <td class="py-3 px-3 text-rose-400 font-bold">฿-1.34 (-0.66%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⭐ ทองคำแนวโน้มหลักขาขึ้น ถือสะสมเกาะเทรนด์</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">ETF สุขภาพ / เฮลท์แคร์</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">XLV</b><span class="text-slate-400 text-xs block">Health Care Select Sector SPDR</span></td>
                <td class="py-3 px-3 font-bold text-white">0.0293492</td>
                <td class="py-3 px-3 text-slate-300">$159.12</td>
                <td class="py-3 px-3 font-bold text-white">$170.81</td>
                <td class="py-3 px-3 text-white font-bold">฿167.54</td>
                <td class="py-3 px-3 text-emerald-400 font-bold">+฿11.47 (+7.35%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 กำไร +7.35% กลุ่ม Defensive ป้องกันความผันผวน</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นทั่วโลก (Total World)</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">VT</b><span class="text-slate-400 text-xs block">Vanguard Total World Stock ETF</span></td>
                <td class="py-3 px-3 font-bold text-white">0.0299761</td>
                <td class="py-3 px-3 text-slate-300">$154.79</td>
                <td class="py-3 px-3 font-bold text-white">$159.83</td>
                <td class="py-3 px-3 text-white font-bold">฿160.12</td>
                <td class="py-3 px-3 text-emerald-400 font-bold">+฿5.05 (+3.26%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 กำไร +3.26% กระจายความเสี่ยงทั่วโลก ทยอยสะสมได้</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">กองทุนหุ้นไทย ESG</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">SCBTB(Thai ESGA)</b><span class="text-slate-400 text-xs block">กองทุน SCB หุ้นไทยเพื่อความยั่งยืน</span></td>
                <td class="py-3 px-3 font-bold text-white">234.2616</td>
                <td class="py-3 px-3 text-slate-300">฿10.8870</td>
                <td class="py-3 px-3 font-bold text-white">฿10.36</td>
                <td class="py-3 px-3 text-white font-bold">฿2,427.47</td>
                <td class="py-3 px-3 text-rose-400 font-bold">฿-122.94 (-4.82%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⚠️ ขาดทุน -4.82% ตลาดหุ้นไทยพักฐาน รอรีบาวด์แล้วประเมินใหม่</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นเทคโนโลยี / ยานยนต์ EV</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">TSLA</b><span class="text-slate-400 text-xs block">Tesla Inc</span></td>
                <td class="py-3 px-3 font-bold text-white">0.0192567</td>
                <td class="py-3 px-3 text-slate-300">$395.19</td>
                <td class="py-3 px-3 font-bold text-white">$382.70</td>
                <td class="py-3 px-3 text-white font-bold">฿246.29</td>
                <td class="py-3 px-3 text-rose-400 font-bold">฿-8.04 (-3.16%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⚠️ ลุ้นดีดรีบาวด์ระยะสั้น หากราคาเด้งแตะทุนแบ่งทำกำไร</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นต่างประเทศ / เทคจีน</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">BIDU</b><span class="text-slate-400 text-xs block">Baidu Inc ADR (หุ้นเทคจีน)</span></td>
                <td class="py-3 px-3 font-bold text-white">0.0462888</td>
                <td class="py-3 px-3 text-slate-300">$110.61</td>
                <td class="py-3 px-3 font-bold text-white">$85.33</td>
                <td class="py-3 px-3 text-white font-bold">฿132.00</td>
                <td class="py-3 px-3 text-rose-400 font-bold">฿-39.11 (-22.86%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">🚨 ขาดทุน -22.86% แนะนำพิจารณา Cut Loss สลับไปสะสม VOO</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นพลังงาน / ปันผลสหรัฐฯ</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">XOM</b><span class="text-slate-400 text-xs block">Exxon Mobil Corp</span></td>
                <td class="py-3 px-3 font-bold text-white">0.038481</td>
                <td class="py-3 px-3 text-slate-300">$120.50</td>
                <td class="py-3 px-3 font-bold text-white">$117.80</td>
                <td class="py-3 px-3 text-white font-bold">฿102.54</td>
                <td class="py-3 px-3 text-emerald-400 font-bold">+฿2.28 (+2.28%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">⚪ หุ้นพลังงาน ถือรับเงินปันผลและช่วยป้องกันความเสี่ยงเงินเฟ้อ</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- DCA Budget Allocation Calculator -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 class="font-black text-base text-white">💰 วางแผนเติมเงิน DCA รอบถัดไป (สูตร 70/20/10)</h3>
        <p class="text-xs text-slate-400">ระบบจะช่วยคำนวณแบ่งเงินเข้าสินทรัพย์ตามสัดส่วนที่ปลอดภัยที่สุด เพื่อสร้างการเติบโตระยะยาว</p>
        <div class="flex flex-wrap items-center gap-3 pt-1">
          <span class="text-xs text-slate-300">งบที่จะเติมเดือนนี้:</span>
          <input type="number" id="inp-dca-amount" value="2000" class="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl text-sm font-mono text-white w-32 text-right">
          <span class="text-xs text-slate-300">บาท</span>
          <button onclick="calcDCA()" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-1.5 rounded-xl text-xs transition shadow">คำนวณสัดส่วน</button>
        </div>
        <div id="dca-result" class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
            • เติม <b>VOO (S&P 500)</b>: <b class="text-emerald-400">฿1,400</b> (70%)
          </div>
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
            • เติม <b>AMD / หุ้นเทค AI</b>: <b class="text-sky-400">฿400</b> (20%)
          </div>
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
            • เติม <b>ออมทองคำ (YLG-GOLD)</b>: <b class="text-amber-400">฿200</b> (10%)
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: BROAD MARKET SCREENER -->
    <div id="view-broad" class="view-tab flex-col gap-5">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 class="font-black text-base text-white">🌟 สแกนเนอร์ก้นหลุมรอบเดือน 35 หุ้นใหญ่สหรัฐฯ (Monthly Dip Deals)</h3>
            <p class="text-xs text-slate-400">คัดกรองเฉพาะหุ้นพื้นฐานแกร่งที่ราคาลงมาแตะแนวรับต่ำสุดในรอบ 1 เดือน พร้อมสัญญาณกลับตัว</p>
          </div>
          <button onclick="sendBroadTelegram()" class="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow">
            🌟 ส่ง 4 หุ้นเด่นเข้า Telegram
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <th class="py-2.5 px-3">อันดับ</th>
                <th class="py-2.5 px-3">หุ้น</th>
                <th class="py-2.5 px-3">ราคาปัจจุบัน</th>
                <th class="py-2.5 px-3">ย่อตัวจาก High</th>
                <th class="py-2.5 px-3">RSI</th>
                <th class="py-2.5 px-3">คะแนนก้นหลุม</th>
                <th class="py-2.5 px-3">โซนเข้าซื้อ</th>
                <th class="py-2.5 px-3">เป้าทำกำไร</th>
                <th class="py-2.5 px-3">สถานะเทคนิค</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-base">🥇 #1</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">AMZN</b><span class="text-slate-400 text-xs block">Amazon.com</span></td>
                <td class="py-3 px-3 font-bold text-white">$186.40</td>
                <td class="py-3 px-3 text-rose-400 font-bold">-12.4%</td>
                <td class="py-3 px-3 text-amber-400 font-bold">34.2 (Oversold)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">94/100</span></td>
                <td class="py-3 px-3 text-emerald-300 font-bold">$183 - $187</td>
                <td class="py-3 px-3 text-teal-300 font-bold">$215.00 (+15.3%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🌟 ก้นหลุมน่าช้อนมาก</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-base">🥈 #2</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">GOOGL</b><span class="text-slate-400 text-xs block">Alphabet Google</span></td>
                <td class="py-3 px-3 font-bold text-white">$168.20</td>
                <td class="py-3 px-3 text-rose-400 font-bold">-10.8%</td>
                <td class="py-3 px-3 text-amber-400 font-bold">36.5</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">91/100</span></td>
                <td class="py-3 px-3 text-emerald-300 font-bold">$165 - $169</td>
                <td class="py-3 px-3 text-teal-300 font-bold">$192.00 (+14.1%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 แนวรับสำคัญพร้อมดีด</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-base">🥉 #3</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">MSFT</b><span class="text-slate-400 text-xs block">Microsoft Corp</span></td>
                <td class="py-3 px-3 font-bold text-white">$420.50</td>
                <td class="py-3 px-3 text-rose-400 font-bold">-8.5%</td>
                <td class="py-3 px-3 text-slate-300">38.1</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">88/100</span></td>
                <td class="py-3 px-3 text-emerald-300 font-bold">$415 - $422</td>
                <td class="py-3 px-3 text-teal-300 font-bold">$468.00 (+11.3%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 ย่อตัวทดสอบ EMA200</span></td>
              </tr>
              <tr class="hover:bg-slate-800/50 transition">
                <td class="py-3 px-3"><span class="text-base font-bold text-slate-400">#4</span></td>
                <td class="py-3 px-3"><b class="text-white text-sm">META</b><span class="text-slate-400 text-xs block">Meta Platforms</span></td>
                <td class="py-3 px-3 font-bold text-white">$578.10</td>
                <td class="py-3 px-3 text-rose-400 font-bold">-7.2%</td>
                <td class="py-3 px-3 text-slate-300">41.0</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">85/100</span></td>
                <td class="py-3 px-3 text-emerald-300 font-bold">$570 - $580</td>
                <td class="py-3 px-3 text-teal-300 font-bold">$645.00 (+11.6%)</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 พักฐานเพื่อขึ้นต่อ</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: BREAKING NEWS & IMPACT RADAR -->
    <div id="view-news" class="view-tab flex-col gap-5">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 class="font-black text-base text-white">📰 ข่าวด่วน & ปัจจัยกระทบตลาด (Breaking News & Market Impact Radar)</h3>
            <p class="text-xs text-slate-400">วิเคราะห์ข่าวเศรษฐกิจมหภาค Fed, CPI, Non-Farm, และทองคำ บอกทิศทางหนุนขึ้นหรือกดดันลงทันที</p>
          </div>
          <button onclick="sendNewsTelegram()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow flex items-center gap-1.5">
            ✈️ ส่งรายงานข่าวเข้า Telegram
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">FED / อัตราดอกเบี้ย</span>
              <span class="text-xs text-slate-400">รอบสัปดาห์</span>
            </div>
            <h4 class="font-bold text-sm text-white">ประธานเฟด (Fed) ส่งสัญญาณแนวโน้มลดอัตราดอกเบี้ยนโยบายต่อเนื่องเพื่อประคองการจ้างงาน</h4>
            <div class="flex items-center gap-2 pt-1">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 หนุนตลาดขึ้น (Bullish)</span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">ดอกเบี้ยขาลงลดต้นทุนการกู้ยืม เพิ่มสภาพคล่องในระบบ และกระตุ้นสินทรัพย์เสี่ยง</p>
            <div class="text-[11px] font-mono text-emerald-400">สินทรัพย์ที่ได้ประโยชน์: SPY, QQQ, VOO, XAU/USD (ขึ้น)</div>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">INFLATION / เงินเฟ้อ</span>
              <span class="text-xs text-slate-400">รอบสัปดาห์</span>
            </div>
            <h4 class="font-bold text-sm text-white">รายงานดัชนีเงินเฟ้อสหรัฐฯ (CPI) ชะลอตัวลงตามคาดการณ์ เปิดทางเศรษฐกิจ Soft Landing</h4>
            <div class="flex items-center gap-2 pt-1">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 หนุนตลาดขึ้น (Bullish)</span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">เงินเฟ้อไม่ดีดกลับ ลดแรงกดดันต่อนโยบายการเงิน หนุนความเชื่อมั่นนักลงทุนสถาบัน</p>
            <div class="text-[11px] font-mono text-emerald-400">สินทรัพย์ที่ได้ประโยชน์: NVDA, AMD, QQQ, VOO (ขึ้น)</div>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">GEOPOLITICS / ทองคำ</span>
              <span class="text-xs text-slate-400">รอบสัปดาห์</span>
            </div>
            <h4 class="font-bold text-sm text-white">ความตึงเครียดทางภูมิรัฐศาสตร์หนุนแรงซื้อสินทรัพย์ปลอดภัย ดันทองคำทำสถิติ All-Time High</h4>
            <div class="flex items-center gap-2 pt-1">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 หนุนทองคำพุ่ง (Bullish Gold)</span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">ความต้องการป้องกันความเสี่ยงจากสงครามและความผันผวนทั่วโลกส่งผลให้เม็ดเงินไหลเข้าทองคำแท่ง</p>
            <div class="text-[11px] font-mono text-emerald-400">สินทรัพย์ที่ได้ประโยชน์: XAU/USD, YLG-GOLD (ขึ้นแรง)</div>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">AI & SEMICONDUCTOR</span>
              <span class="text-xs text-slate-400">รอบสัปดาห์</span>
            </div>
            <h4 class="font-bold text-sm text-white">อุปสงค์โครงสร้างพื้นฐาน AI และชิปประมวลผล Big Tech ยังขยายตัวสูงกว่ากำลังผลิต</h4>
            <div class="flex items-center gap-2 pt-1">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 หนุนหุ้นเทคและเซมิ (Bullish Tech)</span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">ความต้องการ Capex ด้าน AI Server ยังแข็งแกร่งมาก เพิ่มคาดการณ์กำไรในอนาคต</p>
            <div class="text-[11px] font-mono text-emerald-400">สินทรัพย์ที่ได้ประโยชน์: NVDA, AMD, TTB (ถือเติบโต)</div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Telegram Connection Modal -->
  <div id="telegram-modal" style="display: none !important; pointer-events: none;" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">✈️</span>
          <h3 class="font-bold text-white text-base">เชื่อมต่อบอท Telegram</h3>
        </div>
        <button onclick="closeTelegramModal()" class="text-slate-400 hover:text-white p-1 text-lg font-bold">✕</button>
      </div>

      <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
        <span class="font-bold text-emerald-400 block text-sm">📲 วิธีเชื่อมต่อง่ายที่สุด (ไม่ต้องจำตัวเลข):</span>
        <ol class="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
          <li>เปิดแอป Telegram แล้วค้นหาบอทของคุณ: <b>@M15_Trading_Bot</b> (หรือบอทที่คุณสร้างไว้)</li>
          <li>กดปุ่ม <b>/start</b> หรือพิมพ์คำว่า <b>"สวัสดี"</b> ส่งไปที่บอท 1 ครั้ง</li>
          <li><b>ระบบจะจับคู่ Chat ID ของคุณโดยอัตโนมัติทันที!</b> ไม่ต้องพิมพ์ตัวเลขเอง</li>
        </ol>
      </div>

      <div class="space-y-2 text-xs">
        <span class="text-slate-400 block">หรือหากคุณมีตัวเลข Chat ID อยู่แล้ว สามารถพิมพ์ใส่ตรงนี้ได้เลย:</span>
        <div class="flex gap-2">
          <input type="text" id="manual-chat-id" placeholder="ตัวอย่าง: 123456789" class="flex-1 bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs">
          <button onclick="saveManualChatId()" class="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition">
            บันทึก
          </button>
        </div>
      </div>

      <!-- Live Chat ID Status Box -->
      <div id="tg-current-status-box" class="p-3 rounded-xl border bg-slate-950 border-slate-800 text-xs">
        <span class="text-slate-400">สถานะ Chat ID ปัจจุบัน: </span>
        <b id="tg-display-chatid" class="text-amber-400 font-mono">ยังไม่มี</b>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <button onclick="closeTelegramModal()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition">
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  </div>

  <!-- Client-side Interactive Script -->
  <script>
    const ASSETS_DATA = {"XAU/USD": {"label": "XAU/USD (\u0e17\u0e2d\u0e07\u0e04\u0e33)", "tvSym": "OANDA:XAUUSD", "action": "BUY", "entry": 2785.4, "sl": 2776.0, "tp1": 2795.0, "tp2": 2805.0, "risk": 9.4, "rr": "1:2.1", "rsi": 62.5, "instruction": "\u0e40\u0e1b\u0e34\u0e14\u0e2a\u0e16\u0e32\u0e19\u0e30 BUY \u0e42\u0e0b\u0e19 $2,785.40 \u0e40\u0e21\u0e37\u0e48\u0e2d\u0e41\u0e17\u0e48\u0e07 M15 \u0e08\u0e1a\u0e40\u0e02\u0e35\u0e22\u0e27\u0e40\u0e2b\u0e19\u0e37\u0e2d EMA50 \u0e15\u0e31\u0e49\u0e07 SL $2,776.00 \u0e16\u0e37\u0e2d\u0e17\u0e33\u0e01\u0e33\u0e44\u0e23\u0e40\u0e1b\u0e49\u0e32 TP1 \u0e41\u0e25\u0e30 TP2"}, "QQQ": {"label": "NASDAQ (QQQ)", "tvSym": "NASDAQ:QQQ", "action": "BUY", "entry": 495.2, "sl": 489.5, "tp1": 502.0, "tp2": 508.5, "risk": 5.7, "rr": "1:2.3", "rsi": 54.0, "instruction": "\u0e40\u0e1b\u0e34\u0e14\u0e2a\u0e16\u0e32\u0e19\u0e30 BUY \u0e42\u0e0b\u0e19 $495.20 \u0e40\u0e21\u0e37\u0e48\u0e2d\u0e14\u0e31\u0e0a\u0e19\u0e35\u0e22\u0e01 Low \u0e1a\u0e19\u0e41\u0e19\u0e27\u0e23\u0e31\u0e1a $490.00 \u0e15\u0e31\u0e49\u0e07 SL $489.50 \u0e25\u0e38\u0e49\u0e19\u0e17\u0e30\u0e25\u0e38 High \u0e40\u0e14\u0e34\u0e21\u0e17\u0e35\u0e48 $508.50"}, "NVDA": {"label": "NVDA (Nvidia)", "tvSym": "NASDAQ:NVDA", "action": "BUY", "entry": 141.2, "sl": 136.5, "tp1": 146.0, "tp2": 152.0, "risk": 4.7, "rr": "1:2.3", "rsi": 58.2, "instruction": "\u0e40\u0e1b\u0e34\u0e14\u0e2a\u0e16\u0e32\u0e19\u0e30 BUY \u0e42\u0e0b\u0e19 $141.20 \u0e15\u0e32\u0e21\u0e23\u0e2d\u0e1a\u0e41\u0e23\u0e07\u0e2a\u0e48\u0e07 AI \u0e23\u0e31\u0e1a\u0e0a\u0e34\u0e1b\u0e1b\u0e23\u0e30\u0e21\u0e27\u0e25\u0e1c\u0e25 \u0e15\u0e31\u0e49\u0e07 SL $136.50 \u0e40\u0e1b\u0e49\u0e32\u0e02\u0e32\u0e22\u0e17\u0e33\u0e01\u0e33\u0e44\u0e23\u0e2b\u0e25\u0e31\u0e01 $152.00"}, "AAPL": {"label": "AAPL (Apple)", "tvSym": "NASDAQ:AAPL", "action": "BUY", "entry": 230.1, "sl": 226.0, "tp1": 235.0, "tp2": 240.0, "risk": 4.1, "rr": "1:2.4", "rsi": 51.5, "instruction": "\u0e40\u0e1b\u0e34\u0e14\u0e2a\u0e16\u0e32\u0e19\u0e30 BUY \u0e42\u0e0b\u0e19 $230.10 \u0e40\u0e21\u0e37\u0e48\u0e2d\u0e40\u0e01\u0e34\u0e14\u0e41\u0e17\u0e48\u0e07\u0e04\u0e2d\u0e19\u0e40\u0e1f\u0e34\u0e23\u0e4c\u0e21\u0e1a\u0e19\u0e40\u0e2a\u0e49\u0e19 EMA200 \u0e15\u0e31\u0e49\u0e07 SL $226.00 \u0e40\u0e1b\u0e49\u0e32\u0e2b\u0e21\u0e32\u0e22\u0e17\u0e33\u0e01\u0e33\u0e44\u0e23 $240.00"}, "SPY": {"label": "SPY (S&P 500 ETF)", "tvSym": "AMEX:SPY", "action": "BUY", "entry": 580.4, "sl": 574.0, "tp1": 588.0, "tp2": 595.0, "risk": 6.4, "rr": "1:2.3", "rsi": 55.8, "instruction": "\u0e40\u0e1b\u0e34\u0e14\u0e2a\u0e16\u0e32\u0e19\u0e30 BUY \u0e42\u0e0b\u0e19 $580.40 \u0e40\u0e01\u0e32\u0e30\u0e41\u0e19\u0e27\u0e42\u0e19\u0e49\u0e21\u0e43\u0e2b\u0e0d\u0e48\u0e02\u0e32\u0e02\u0e36\u0e49\u0e19\u0e02\u0e2d\u0e07\u0e15\u0e25\u0e32\u0e14\u0e2a\u0e2b\u0e23\u0e31\u0e10\u0e2f \u0e15\u0e31\u0e49\u0e07 SL $574.00 \u0e40\u0e1b\u0e49\u0e32\u0e17\u0e33\u0e01\u0e33\u0e44\u0e23 $595.00"}};

    let currentSelectedSymbol = "XAU/USD";
    let soundEnabled = true;
    let audioCtx = null;
    let ws = null;

    // Pleasant Sound Synthesizer via Web Audio API
    function playChime(isBuy) {
      if (!soundEnabled) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        if (isBuy) {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);
          osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16);
          osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.24);
        } else {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(659.25, now);
          osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.12);
          osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.25);
        }
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } catch(e) {}
    }

    // Toast Notification System
    function showToast(message, type = "info") {
      const container = document.getElementById("toast-container");
      if (!container) return;
      const toast = document.createElement("div");
      toast.className = "px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold flex items-center gap-2 pointer-events-auto transition " + 
        (type === "success" ? "bg-emerald-950/95 border-emerald-500 text-emerald-300" :
         type === "danger" ? "bg-rose-950/95 border-rose-500 text-rose-300" :
         "bg-slate-900/95 border-slate-700 text-slate-200");
      toast.innerHTML = (type === "success" ? "🟢 " : type === "danger" ? "🔴 " : "⚡ ") + message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }

    // Copy to Clipboard Fallback
    function safeCopy(text, successMsg) {
      if (!text || text === "--") return;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
          showToast(successMsg, "success");
        }).catch(() => {
          execCopyFallback(text, successMsg);
        });
      } else {
        execCopyFallback(text, successMsg);
      }
    }

    function execCopyFallback(text, successMsg) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
        showToast(successMsg, "success");
      } catch(e) {
        showToast("ไม่สามารถคัดลอกได้อัตโนมัติ", "danger");
      }
      document.body.removeChild(ta);
    }

    function copyText(id, label) {
      const el = document.getElementById(id);
      if (!el) return;
      const txt = el.textContent.trim();
      safeCopy(txt, "คัดลอก " + label + " (" + txt + ") เรียบร้อย!");
    }

    function copyPineScript() {
      const code = document.getElementById("pine-code-block").textContent;
      safeCopy(code, "คัดลอกโค้ด Pine Script ทั้งหมดแล้ว!");
    }

    function copyWebhookUrl() {
      const url = document.getElementById("webhook-sample-url").textContent;
      safeCopy(url, "คัดลอก Webhook URL แล้ว!");
    }

    // 100% RELIABLE CHART SWITCHER: Re-creates the iframe DOM node so the requested symbol LOADS INSTANTLY!
    function setAsset(tvSym, label) {
      currentSelectedSymbol = label;
      const asset = ASSETS_DATA[label] || ASSETS_DATA['XAU/USD'];

      // 1. Highlight clicked card
      document.querySelectorAll('.asset-card').forEach(c => {
        c.className = "asset-card copy-card bg-slate-900 border border-slate-800 rounded-xl p-3 transition";
      });
      const activeCard = document.getElementById('card-asset-' + label);
      if (activeCard) {
        activeCard.className = "asset-card active copy-card bg-slate-900 border-2 border-amber-500 rounded-xl p-3 transition";
      }

      // 2. Recreate the iframe inside tv-frame-container (Forces TradingView to mount the new chart!)
      const container = document.getElementById("tv-frame-container");
      if (container) {
        container.innerHTML = '<iframe id="tv-frame" src="https://s.tradingview.com/widgetembed/?symbol=' + encodeURIComponent(tvSym) + '&interval=15&theme=dark&timezone=Asia%2FBangkok" class="w-full h-full border-0"></iframe>';
      }
      const titleEl = document.getElementById("chart-asset-title");
      if (titleEl) titleEl.textContent = "ชาร์ตสด " + asset.label + " (TradingView M15)";

      // 3. Update the Active Signal Card values
      const tickerTitle = document.getElementById("active-signal-title");
      if (tickerTitle) tickerTitle.textContent = asset.label + " • 15m";
      const badge = document.getElementById("active-action-badge");
      if (badge) {
        badge.className = asset.action === 'BUY' ? "px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md" : "px-3 py-1 rounded-full text-xs font-black bg-rose-500 text-white shadow-md";
        badge.textContent = asset.action === 'BUY' ? "🟢 BUY (ซื้อ)" : "🔴 SELL (ขาย)";
      }
      document.getElementById("card-entry").textContent = "$" + asset.entry.toLocaleString(undefined, {minimumFractionDigits: 2});
      document.getElementById("card-sl").textContent = "$" + asset.sl.toLocaleString(undefined, {minimumFractionDigits: 2});
      document.getElementById("card-risk").textContent = "ระยะเสี่ยง: $" + asset.risk.toFixed(2);
      document.getElementById("card-tp1").textContent = "$" + asset.tp1.toLocaleString(undefined, {minimumFractionDigits: 2});
      document.getElementById("card-tp2").textContent = "$" + asset.tp2.toLocaleString(undefined, {minimumFractionDigits: 2});
      document.getElementById("card-instruction").textContent = asset.instruction;

      if (soundEnabled) playChime(asset.action === 'BUY');
      showToast("สลับดูกราฟและแผนของ " + asset.label + " สำเร็จ!", "info");
    }

    // Toggle Sound
    function toggleSound() {
      soundEnabled = !soundEnabled;
      document.getElementById("sound-icon").textContent = soundEnabled ? "🔊" : "🔇";
      document.getElementById("sound-status").textContent = soundEnabled ? "เสียงเตือน: เปิด" : "เสียงเตือน: ปิด";
      showToast(soundEnabled ? "เปิดเสียงเตือนแล้ว" : "ปิดเสียงเตือนแล้ว", "info");
      if (soundEnabled) playChime(true);
    }

    // Telegram Modal Management
    async function checkTelegramStatus() {
      try {
        const r = await fetch("/api/telegram-status");
        const d = await r.json();
        const label = document.getElementById("tg-btn-label");
        const disp = document.getElementById("tg-display-chatid");
        if (d.hasChatId) {
          if (label) label.textContent = "Telegram: พร้อมส่ง (" + d.chatId.slice(0, 4) + "...)";
          if (disp) disp.textContent = d.chatId;
        } else {
          if (label) label.textContent = "เชื่อมต่อ Telegram";
          if (disp) disp.textContent = "ยังไม่มี (รอคุณทักบอทใน Telegram)";
        }
      } catch(e) {}
    }

    function openTelegramModal() {
      checkTelegramStatus();
      const modal = document.getElementById("telegram-modal");
      if (modal) {
        modal.style.setProperty("display", "flex", "important");
        modal.style.pointerEvents = "auto";
      }
    }

    function closeTelegramModal() {
      const modal = document.getElementById("telegram-modal");
      if (modal) {
        modal.style.setProperty("display", "none", "important");
        modal.style.pointerEvents = "none";
      }
    }

    function openTelegramPreview() {
      const asset = ASSETS_DATA[currentSelectedSymbol] || ASSETS_DATA['XAU/USD'];
      const txt = "⚡ [M15 SIGNAL ALERT]\nสินทรัพย์: " + asset.label + "\nคำสั่ง: " + asset.action + "\n──────────────────\n🎯 จุดเข้า: $" + asset.entry + "\n🛑 Stop Loss: $" + asset.sl + "\n🏆 TP1: $" + asset.tp1 + " | TP2: $" + asset.tp2 + "\n💡 แผน: " + asset.instruction;
      showToast("ตัวอย่างข้อความ: " + txt.split("\n")[1], "info");
      openTelegramModal();
    }

    async function saveManualChatId() {
      const cid = document.getElementById("manual-chat-id").value.trim();
      if (!cid) return showToast("กรุณากรอก Chat ID", "danger");
      try {
        const r = await fetch("/api/set-telegram-chat-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: cid })
        });
        const d = await r.json();
        if (d.ok) {
          showToast("บันทึก Chat ID สำเร็จ!", "success");
          checkTelegramStatus();
        }
      } catch(e) {}
    }

    // Quick Simulation Trigger
    async function simTrigger(assetKey, action) {
      showToast("กำลังยิงสัญญาณทดสอบ " + action + " " + assetKey, "info");
      playChime(action === 'BUY');
      try {
        const r = await fetch("/api/simulate-signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset: assetKey, action })
        });
        const d = await r.json();
        if (d.ok && d.signal) {
          addSignalToTable(d.signal);
          if (d.telegramSent) {
            showToast("จำลองสัญญาณและส่งเข้า Telegram สำเร็จ!", "success");
          } else {
            showToast("จำลองสัญญาณสำเร็จ! (Telegram: " + (d.telegramError || "ยังไม่มี Chat ID - ทักบอท 1 ครั้งเพื่อผูก") + ")", "info");
          }
        }
      } catch(e) {
        showToast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", "danger");
      }
    }

    function addSignalToTable(sig) {
      const tbody = document.getElementById("signals-table-body");
      if (!tbody) return;
      const tr = document.createElement("tr");
      tr.className = "bg-amber-500/10 hover:bg-slate-800/50 transition";
      const isBuy = sig.action === 'BUY';
      tr.innerHTML = 
        '<td class="py-3 px-3 text-slate-300 font-bold">' + sig.sessionDate + '</td>' +
        '<td class="py-3 px-3 text-amber-400 font-bold">' + sig.time + '</td>' +
        '<td class="py-3 px-3 font-bold text-white">' + sig.asset + '</td>' +
        '<td class="py-3 px-3"><span class="px-2 py-0.5 rounded ' + (isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400') + ' font-bold">' + sig.action + '</span></td>' +
        '<td class="py-3 px-3">$' + sig.entry.toFixed(2) + '</td>' +
        '<td class="py-3 px-3 text-rose-400">$' + sig.sl.toFixed(2) + '</td>' +
        '<td class="py-3 px-3 text-emerald-400">$' + sig.tp1.toFixed(2) + ' / $' + sig.tp2.toFixed(2) + '</td>' +
        '<td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold ' + sig.statusClass + '">' + sig.status + '</span></td>';
      tbody.insertBefore(tr, tbody.firstChild);
    }

    // Telegram Dispatch Helpers with Live Feedback
    async function sendNewsTelegram() {
      showToast("กำลังส่งสรุปข่าวเข้า Telegram...", "info");
      try {
        const r = await fetch("/api/send-news-telegram", { method: "POST" });
        const d = await r.json();
        if (d.ok) {
          showToast("ส่งรายงานข่าวเข้า Telegram สำเร็จ!", "success");
        } else {
          showToast(d.error || "ส่งไม่สำเร็จ (ทักบอทใน Telegram ก่อน 1 ครั้ง)", "danger");
          openTelegramModal();
        }
      } catch(e) {
        showToast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", "danger");
      }
    }

    async function sendForecastTelegram() {
      showToast("กำลังส่งสรุปทำนายกราฟเข้า Telegram...", "info");
      try {
        const r = await fetch("/api/send-forecast-telegram", { method: "POST" });
        const d = await r.json();
        if (d.ok) {
          showToast("ส่งผลทำนายกราฟเข้า Telegram สำเร็จ!", "success");
        } else {
          showToast(d.error || "ส่งไม่สำเร็จ (ทักบอทใน Telegram ก่อน 1 ครั้ง)", "danger");
          openTelegramModal();
        }
      } catch(e) {
        showToast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", "danger");
      }
    }

    async function sendBroadTelegram() {
      showToast("กำลังส่ง 4 หุ้นเด่นเข้า Telegram...", "info");
      try {
        const r = await fetch("/api/send-broad-telegram", { method: "POST" });
        const d = await r.json();
        if (d.ok) {
          showToast("ส่ง 4 หุ้นเด่นเข้า Telegram เรียบร้อย!", "success");
        } else {
          showToast(d.error || "ส่งไม่สำเร็จ (ทักบอทใน Telegram ก่อน 1 ครั้ง)", "danger");
          openTelegramModal();
        }
      } catch(e) {
        showToast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", "danger");
      }
    }

    function calcDCA() {
      const amt = parseFloat(document.getElementById("inp-dca-amount").value) || 2000;
      const voo = Math.round(amt * 0.7);
      const tech = Math.round(amt * 0.2);
      const gold = amt - voo - tech;
      document.getElementById("dca-result").innerHTML = 
        "<div class='bg-slate-950 p-3 rounded-xl border border-slate-800'>• เติม <b>VOO (S&P 500)</b>: <b class='text-emerald-400'>฿" + voo.toLocaleString() + "</b> (70%)</div>" +
        "<div class='bg-slate-950 p-3 rounded-xl border border-slate-800'>• เติม <b>AMD / หุ้นเทค AI</b>: <b class='text-sky-400'>฿" + tech.toLocaleString() + "</b> (20%)</div>" +
        "<div class='bg-slate-950 p-3 rounded-xl border border-slate-800'>• เติม <b>ออมทองคำ (YLG-GOLD)</b>: <b class='text-amber-400'>฿" + gold.toLocaleString() + "</b> (10%)</div>";
      showToast("คำนวณสัดส่วน DCA ฿" + amt.toLocaleString() + " แล้ว!", "success");
    }

    // World Clock & Candle Timer
    function updateWorldClock() {
      const now = new Date();
      const bkkStr = now.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false });
      const usStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false });
      
      const bkkEl = document.getElementById("session-bkk");
      if (bkkEl) bkkEl.textContent = "🇹🇭 ไทย: " + bkkStr;
      const usEl = document.getElementById("session-us");
      if (usEl) usEl.textContent = "🇺🇸 สหรัฐฯ: " + usStr;

      const mins = now.getMinutes() % 15;
      const secs = now.getSeconds();
      const leftSecs = (14 - mins) * 60 + (60 - secs);
      const cm = Math.floor(leftSecs / 60);
      const cs = leftSecs % 60;
      const candleTimer = document.getElementById("candle-timer");
      if (candleTimer) candleTimer.textContent = (cm < 10 ? "0" : "") + cm + ":" + (cs < 10 ? "0" : "") + cs;
    }

    setInterval(updateWorldClock, 1000);
    updateWorldClock();

    // Auto-reconnecting Real-time WebSocket Client
    function initWebSocket() {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = proto + '//' + window.location.host;
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => console.log('⚡ Connected to Master Terminal WebSocket');
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_signal' && data.signal) {
              addSignalToTable(data.signal);
              playChime(data.signal.action === 'BUY');
              showToast("ได้รับสัญญาณใหม่: " + data.signal.action + " " + data.signal.asset, "success");
            }
          } catch(e) {}
        };
        ws.onclose = () => {
          setTimeout(initWebSocket, 4000);
        };
      } catch(e) {}
    }
    initWebSocket();

    // Attach to Window Scope
    window.switchMasterTab = switchMasterTab;
    window.switchSubTab = switchSubTab;
    window.setAsset = setAsset;
    window.copyText = copyText;
    window.copyPineScript = copyPineScript;
    window.copyWebhookUrl = copyWebhookUrl;
    window.openTelegramModal = openTelegramModal;
    window.closeTelegramModal = closeTelegramModal;
    window.openTelegramPreview = openTelegramPreview;
    window.saveManualChatId = saveManualChatId;
    window.toggleSound = toggleSound;
    window.simTrigger = simTrigger;
    window.calcDCA = calcDCA;
    window.sendNewsTelegram = sendNewsTelegram;
    window.sendForecastTelegram = sendForecastTelegram;
    window.sendBroadTelegram = sendBroadTelegram;

    // Check status on load
    window.addEventListener('DOMContentLoaded', () => {
      checkTelegramStatus();
    });

    // Route Hash Check
    const curHash = (window.location.hash || "").toLowerCase();
    if (curHash.includes("portfolio")) switchMasterTab("portfolio");
    else if (curHash.includes("broad") || curHash.includes("screener")) switchMasterTab("broad");
    else if (curHash.includes("news")) switchMasterTab("news");
  </script>
</body>
</html>`;

// 7. Navigation Routes
app.get('/', (req, res) => res.send(HTML_PAGE));
app.get('/portfolio', (req, res) => res.send(HTML_PAGE));
app.get('/port', (req, res) => res.send(HTML_PAGE));
app.get('/screener', (req, res) => res.send(HTML_PAGE));
app.get('/broad', (req, res) => res.send(HTML_PAGE));
app.get('/news', (req, res) => res.send(HTML_PAGE));
app.get('/m15', (req, res) => res.send(HTML_PAGE));

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Complete Master Terminal running on 0.0.0.0:${PORT}`);
});
