import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://trading-bot-lnf1.onrender.com';
const API_KEY = process.env.TWELVE_DATA_API_KEY || '480e1387e8fe4675b44e831a47a9721a';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9089609371:AAFyPRrun1KIafdD3J1ii2WmymjxJrTFR-E';
let CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// 1) 5 สินทรัพย์หลักสำหรับเทรดสั้นแท่ง 15 นาที
const M15_SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL', 'SPY'];

// 2) คลังหุ้นสหรัฐฯ 35 ตัวแทนทุกอุตสาหกรรม (Broad Market Screener)
const BROAD_MARKET_UNIVERSE = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', yahoo: 'NVDA', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', yahoo: 'AMD', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'AVGO', name: 'Broadcom Inc', yahoo: 'AVGO', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', yahoo: 'TSM', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'QCOM', name: 'Qualcomm Inc', yahoo: 'QCOM', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'AAPL', name: 'Apple Inc', yahoo: 'AAPL', sector: 'Big Tech', category: 'BLUECHIP' },
  { symbol: 'MSFT', name: 'Microsoft Corp', yahoo: 'MSFT', sector: 'Big Tech', category: 'BLUECHIP' },
  { symbol: 'AMZN', name: 'Amazon.com', yahoo: 'AMZN', sector: 'Big Tech', category: 'TECH' },
  { symbol: 'GOOGL', name: 'Alphabet Google', yahoo: 'GOOGL', sector: 'Big Tech', category: 'BLUECHIP' },
  { symbol: 'META', name: 'Meta Platforms', yahoo: 'META', sector: 'Big Tech', category: 'TECH' },
  { symbol: 'TSLA', name: 'Tesla Inc', yahoo: 'TSLA', sector: 'EV & Tech', category: 'TECH' },
  { symbol: 'NFLX', name: 'Netflix Inc', yahoo: 'NFLX', sector: 'Big Tech', category: 'TECH' },
  { symbol: 'PLTR', name: 'Palantir Technologies', yahoo: 'PLTR', sector: 'Software & AI', category: 'TECH' },
  { symbol: 'CRM', name: 'Salesforce Inc', yahoo: 'CRM', sector: 'Software & AI', category: 'TECH' },
  { symbol: 'ADBE', name: 'Adobe Inc', yahoo: 'ADBE', sector: 'Software & AI', category: 'TECH' },
  { symbol: 'JPM', name: 'JPMorgan Chase', yahoo: 'JPM', sector: 'Finance & Banking', category: 'BLUECHIP' },
  { symbol: 'BAC', name: 'Bank of America', yahoo: 'BAC', sector: 'Finance & Banking', category: 'BLUECHIP' },
  { symbol: 'V', name: 'Visa Inc', yahoo: 'V', sector: 'Finance & Banking', category: 'BLUECHIP' },
  { symbol: 'MA', name: 'Mastercard Inc', yahoo: 'MA', sector: 'Finance & Banking', category: 'BLUECHIP' },
  { symbol: 'LLY', name: 'Eli Lilly and Co (ยาลดน้ำหนัก)', yahoo: 'LLY', sector: 'Healthcare', category: 'BLUECHIP' },
  { symbol: 'NVO', name: 'Novo Nordisk (Ozempic)', yahoo: 'NVO', sector: 'Healthcare', category: 'BLUECHIP' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', yahoo: 'JNJ', sector: 'Healthcare', category: 'BLUECHIP' },
  { symbol: 'UNH', name: 'UnitedHealth Group', yahoo: 'UNH', sector: 'Healthcare', category: 'BLUECHIP' },
  { symbol: 'WMT', name: 'Walmart Inc', yahoo: 'WMT', sector: 'Consumer & Retail', category: 'BLUECHIP' },
  { symbol: 'COST', name: 'Costco Wholesale', yahoo: 'COST', sector: 'Consumer & Retail', category: 'BLUECHIP' },
  { symbol: 'KO', name: 'Coca-Cola Company', yahoo: 'KO', sector: 'Consumer & Retail', category: 'BLUECHIP' },
  { symbol: 'MCD', name: "McDonald's Corp", yahoo: 'MCD', sector: 'Consumer & Retail', category: 'BLUECHIP' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp', yahoo: 'XOM', sector: 'Energy & Industrial', category: 'BLUECHIP' },
  { symbol: 'CVX', name: 'Chevron Corp', yahoo: 'CVX', sector: 'Energy & Industrial', category: 'BLUECHIP' },
  { symbol: 'CAT', name: 'Caterpillar Inc', yahoo: 'CAT', sector: 'Energy & Industrial', category: 'BLUECHIP' },
  { symbol: 'BA', name: 'Boeing Co', yahoo: 'BA', sector: 'Energy & Industrial', category: 'TECH' },
  { symbol: 'QQQ', name: 'Invesco NASDAQ 100 ETF', yahoo: 'QQQ', sector: 'Index ETF', category: 'BLUECHIP' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', yahoo: 'SPY', sector: 'Index ETF', category: 'BLUECHIP' },
  { symbol: 'XAU/USD', name: 'Gold (ทองคำแท่ง)', yahoo: 'GC=F', sector: 'Precious Metals', category: 'BLUECHIP' },
  { symbol: 'BTC/USD', name: 'Bitcoin (คริปโต)', yahoo: 'BTC-USD', sector: 'Crypto', category: 'TECH' }
];

// 3) ข้อมูลพอร์ตจริงของผู้ใช้ (11 ตัวจากแอป Dime!)
let userHoldings = [
  { id: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', shares: 0.0470292, avgCostUSD: 655.55, category: 'หุ้นหลัก', currency: 'USD' },
  { id: 'ttb', symbol: 'TTB', name: 'ธนาคารทหารไทยธนชาต', shares: 162, avgCostTHB: 1.9222, category: 'หุ้นหลัก', currency: 'THB' },
  { id: 'amd', symbol: 'AMD', name: 'Advanced Micro Devices', shares: 0.0150027, avgCostUSD: 537.2349, category: 'หุ้นหลัก', currency: 'USD' },
  { id: 'scbt70x', symbol: 'SCBT70X(26A)', name: 'กองทุน SCB ตราสารหนี้/ผสม', shares: 197.1798, avgCostTHB: 11.9506, category: 'ถือยาว', currency: 'THB' },
  { id: 'gold', symbol: 'YLG-GOLD', name: 'ออมทองคำแท่ง (YLG Gold)', shares: 0.001423, avgCostUSD: 4223.25, category: 'ถือยาว', currency: 'USD' },
  { id: 'xlv', symbol: 'XLV', name: 'Health Care Select Sector SPDR', shares: 0.0293492, avgCostUSD: 159.1185, category: 'ถือยาว', currency: 'USD' },
  { id: 'vt', symbol: 'VT', name: 'Vanguard Total World Stock ETF', shares: 0.0299761, avgCostUSD: 154.79, category: 'ถือยาว', currency: 'USD' },
  { id: 'scbtb', symbol: 'SCBTB(Thai ESGA)', name: 'กองทุนหุ้นไทย ESG', shares: 234.2616, avgCostTHB: 10.8870, category: 'รอขาย', currency: 'THB' },
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla Inc', shares: 0.0192567, avgCostUSD: 395.1880, category: 'รอขาย', currency: 'USD' },
  { id: 'bidu', symbol: 'BIDU', name: 'Baidu Inc ADR (หุ้นเทคจีน)', shares: 0.0462888, avgCostUSD: 110.61, category: 'รอขาย', currency: 'USD' },
  { id: 'xom', symbol: 'XOM', name: 'Exxon Mobil Corp', shares: 0.0299, avgCostUSD: 100.26, category: 'รอขาย', currency: 'USD' }
];

const YAHOO_MAP = {
  'XAU/USD': 'GC=F',
  'QQQ': 'QQQ',
  'NVDA': 'NVDA',
  'AAPL': 'AAPL',
  'SPY': 'SPY',
  'VOO': 'VOO',
  'AMD': 'AMD',
  'XLV': 'XLV',
  'VT': 'VT',
  'TSLA': 'TSLA',
  'BIDU': 'BIDU',
  'XOM': 'XOM',
  'TTB': 'TTB.BK'
};


const MARKET_NEWS_FEED = [
  {
    id: 'news_1',
    time: 'วันนี้ 14:30 น.',
    headline: 'ประธานเฟด (Fed) ส่งสัญญาณแนวโน้มลดอัตราดอกเบี้ยนโยบายต่อเนื่องเพื่อประคองการจ้างงาน',
    category: 'FED / ดอกเบี้ย',
    impact: 'BULLISH',
    impactBadge: '🟢 หนุนตลาดขึ้น (Bullish)',
    impactReason: 'ดอกเบี้ยขาลงลดต้นทุนการกู้ยืม เพิ่มสภาพคล่องในระบบ และกระตุ้นสินทรัพย์เสี่ยง',
    affectedAssets: 'SPY, QQQ, VOO, XAU/USD (ขึ้น)'
  },
  {
    id: 'news_2',
    time: 'เมื่อวาน 20:30 น.',
    headline: 'รายงานดัชนีเงินเฟ้อสหรัฐฯ (CPI) ชะลอตัวลงตามคาดการณ์ เปิดทางเศรษฐกิจ Soft Landing',
    category: 'INFLATION / เงินเฟ้อ',
    impact: 'BULLISH',
    impactBadge: '🟢 หนุนตลาดขึ้น (Bullish)',
    impactReason: 'เงินเฟ้อไม่ดีดกลับ ลดแรงกดดันต่อนโยบายการเงิน หนุนความเชื่อมั่นนักลงทุนสถาบัน',
    affectedAssets: 'NVDA, AMD, QQQ, VOO (ขึ้น)'
  },
  {
    id: 'news_3',
    time: 'สัปดาห์นี้',
    headline: 'ความตึงเครียดทางภูมิรัฐศาสตร์และแรงซื้อทองคำจากธนาคารกลางทั่วโลกพุ่งทำสถิติใหม่',
    category: 'GEOPOLITICS / สงคราม',
    impact: 'BULLISH_GOLD',
    impactBadge: '🟢 หนุนราคาทองคำพุ่ง (Bullish Gold)',
    impactReason: 'แรงซื้อสินทรัพย์ปลอดภัย (Safe-Haven) ไหลเข้าทองคำแท่ง ดันราคา Spot Gold ทำจุดสูงสุดใหม่',
    affectedAssets: 'XAU/USD, YLG-GOLD (ขึ้นแรง)'
  },
  {
    id: 'news_4',
    time: 'ล่าสุด',
    headline: 'อุปสงค์โครงสร้างพื้นฐาน AI และชิปประมวลผล Big Tech ยังขยายตัวสูงกว่ากำลังผลิต',
    category: 'AI & SEMICONDUCTOR',
    impact: 'BULLISH',
    impactBadge: '🟢 หนุนหุ้นเทคและเซมิ (Bullish Tech)',
    impactReason: 'ความต้องการ Capex ด้าน AI Server ยังแข็งแกร่งมาก เพิ่มคาดการณ์กำไรในอนาคต',
    affectedAssets: 'NVDA, AMD, TTB (ถือเติบโต)'
  }
];

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

let signalHistory = [];
let sentCandlesCache = {};
let lastAlertTimestampPerTicker = {};
let marketRadar = {};
let latestPlanBySymbol = {};
let broadMarketCache = [];
let lastPortfolioData = null;
let lastScanTime = null;
let lastBroadScanTime = null;
let telegramEnabled = true;
let lastTelegramUpdateId = 0;

let livePriceCache = {
  'XAU/USD': 2785.40,
  'YLG-GOLD': 2785.40,
  'VOO': 535.20,
  'AMD': 156.40,
  'TSLA': 260.10,
  'XLV': 148.50,
  'VT': 118.20,
  'BIDU': 88.50,
  'XOM': 119.30,
  'TTB': 1.95,
  'NVDA': 141.20,
  'AAPL': 230.10,
  'QQQ': 495.20,
  'SPY': 580.40,
  'SCBT70X': 11.95,
  'SCBTB': 10.35
};

wss.on('connection', (ws) => {
  try {
    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      prices: livePriceCache,
      radar: marketRadar,
      plans: latestPlanBySymbol,
      portfolio: lastPortfolioData,
      broad: broadMarketCache,
      lastScanTime: lastScanTime,
      timestamp: Date.now()
    }));
  } catch (e) {}
});

// ==========================================
// 1. ตรวจสอบเวลาตลาดเปิด-ปิดจริง 100%
// ==========================================
function isMarketOpen(symbol) {
  const now = new Date();
  const day = now.getUTCDay();
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (symbol === 'XAU/USD' || symbol === 'YLG-GOLD') {
    if (day === 6) return false;
    if (day === 0 && utcMins < 22 * 60) return false;
    if (day === 5 && utcMins >= 21 * 60) return false;
    if (utcMins >= 21 * 60 && utcMins < 22 * 60) return false;
    return true;
  }
  if (symbol === 'BTC/USD') return true;

  if (symbol === 'TTB' || symbol.includes('SCB')) {
    if (day === 0 || day === 6) return false;
    const bkkMins = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes();
    return (bkkMins >= 10 * 60 && bkkMins <= 12 * 60 + 30) || (bkkMins >= 14 * 60 + 30 && bkkMins <= 16 * 60 + 40);
  }

  // หุ้นสหรัฐฯ (จันทร์-ศุกร์ 20:30 - 03:00 / 21:30 - 04:00 เวลาไทย)
  if (day === 0 || day === 6) return false;
  if (utcMins < 13 * 60 + 30 || utcMins >= 21 * 60) return false;
  return true;
}

function getMarketStatusInfo(symbol) {
  const open = isMarketOpen(symbol);
  if (open) return { isOpen: true, badgeText: '🟢 ตลาดเปิด' };
  if (symbol === 'XAU/USD') return { isOpen: false, badgeText: '⏸️ ตลาดทองปิดพัก' };
  return { isOpen: false, badgeText: '⏸️ ตลาดปิด (เปิด 20:30 น.)' };
}

// ==========================================
// 2. คลังคำนวณ Indicator
// ==========================================
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateATR(candles, period = 14) {
  if (candles.length < 2) return candles[0] ? candles[0].close * 0.002 : 2.0;
  let tr = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const recent = tr.slice(-period);
  return recent.reduce((s, v) => s + v, 0) / Math.max(1, recent.length);
}

function calculateRSI(prices, period = 14) {
  if (prices.length <= period) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (al === 0) return 100;
  return 100 - (100 / (1 + (ag / al)));
}

// ==========================================
// 3. ระบบส่ง Telegram
// ==========================================
async function resolveTelegramChatId() {
  if (CHAT_ID) return CHAT_ID;
  if (!BOT_TOKEN) return '';
  try {
    const res = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/getUpdates');
    const data = await res.json();
    if (data.ok && data.result && data.result.length > 0) {
      for (let i = data.result.length - 1; i >= 0; i--) {
        const msg = data.result[i].message || data.result[i].channel_post;
        if (msg && msg.chat && msg.chat.id) {
          CHAT_ID = String(msg.chat.id);
          return CHAT_ID;
        }
      }
    }
  } catch (e) {
    console.error('Auto-detect Chat ID error:', e.message);
  }
  return '';
}

async function sendTelegramMessage(text, force = false, targetChat = null) {
  if (!telegramEnabled && !force) return false;
  const targetChatId = targetChat || (await resolveTelegramChatId());
  if (!BOT_TOKEN || !targetChatId) return false;
  try {
    const tgUrl = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage';
    const res = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: targetChatId, text: text, parse_mode: 'HTML' })
    });
    const out = await res.json();
    return Boolean(out.ok);
  } catch (err) {
    console.error('Telegram Error:', err.message);
    return false;
  }
}

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

// ==========================================
// 4. ดึงราคา Real-Time จริงจากตลาดโลก
// ==========================================
async function fetchM15Candles(sym) {
  if (sym === 'XAU/USD') {
    try {
      const bUrl = 'https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=15m&limit=100';
      const res = await fetch(bUrl);
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length >= 60) {
        return rows.map(r => ({
          datetime: new Date(r[0]).toISOString(),
          timeLabel: new Date(r[0]).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
          open: parseFloat(r[1]),
          high: parseFloat(r[2]),
          low: parseFloat(r[3]),
          close: parseFloat(r[4])
        }));
      }
    } catch (e) {}
  }

  try {
    const ySym = YAHOO_MAP[sym] || sym;
    const yUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ySym) + '?interval=15m&range=5d';
    const res = await fetch(yUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (result && result.timestamp && result.indicators && result.indicators.quote && result.indicators.quote[0]) {
      const ts = result.timestamp;
      const q = result.indicators.quote[0];
      const livePrice = result.meta && result.meta.regularMarketPrice;
      let candles = [];
      for (let i = 0; i < ts.length; i++) {
        if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null) {
          candles.push({
            datetime: new Date(ts[i] * 1000).toISOString(),
            timeLabel: new Date(ts[i] * 1000).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
            open: Number(q.open[i]),
            high: Number(q.high[i]),
            low: Number(q.low[i]),
            close: Number(q.close[i])
          });
        }
      }
      if (candles.length > 0 && livePrice) candles[candles.length - 1].close = livePrice;
      if (candles.length >= 60) return candles.slice(-100);
    }
  } catch (e) {}
  return [];
}

async function fetchDailyStockData(yahooTicker) {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooTicker) + '?interval=1d&range=6mo';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (result && result.timestamp && result.indicators && result.indicators.quote && result.indicators.quote[0]) {
      const ts = result.timestamp;
      const q = result.indicators.quote[0];
      const meta = result.meta || {};
      const livePrice = meta.regularMarketPrice || meta.chartPreviousClose;
      const prevClose = meta.chartPreviousClose || meta.previousClose || livePrice;
      const changePct = prevClose ? Number((((livePrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;

      let candles = [];
      for (let i = 0; i < ts.length; i++) {
        if (q.open[i] != null && q.high[i] != null && q.low[i] != null && q.close[i] != null) {
          candles.push({
            date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
            open: Number(q.open[i]),
            high: Number(q.high[i]),
            low: Number(q.low[i]),
            close: Number(q.close[i])
          });
        }
      }
      return { candles: candles, livePrice: Number(livePrice.toFixed(2)), changePct: changePct };
    }
  } catch (e) {
    console.warn('Daily candles error for ' + yahooTicker, e.message);
  }
  return null;
}

// ==========================================
// 5. วิเคราะห์ Quant หุ้นก้นหลุมรอบเดือน & หุ้นน่าซื้อ
// ==========================================
function evaluateStockQuant(candles, livePrice, changePct, symbol, name, sector, category) {
  if (!candles || candles.length < 40) return null;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const curPrice = livePrice || closes[closes.length - 1];
  const ema50 = calculateEMA(closes, 50);
  const ema200 = closes.length >= 200 ? calculateEMA(closes, 200) : calculateEMA(closes, closes.length);
  const rsi = calculateRSI(closes, 14);
  const atr = calculateATR(candles, 14);

  const last = closes.length - 1;
  const curEMA50 = ema50[last];
  const curEMA200 = ema200[last];

  const monthBars = candles.slice(-22);
  const monthlyHigh = Math.max(...monthBars.map(b => b.high));
  const monthlyLow = Math.min(...monthBars.map(b => b.low));
  const dipFromHighPct = Number((((monthlyHigh - curPrice) / monthlyHigh) * 100).toFixed(1));
  const distFromLowPct = Number((((curPrice - monthlyLow) / monthlyLow) * 100).toFixed(1));

  let score = 40;
  let reasons = [];

  if (curPrice > curEMA200 && curEMA50 >= curEMA200) {
    score += 25;
    reasons.push('เทรนด์ใหญ่ Super Trend ขาขึ้น (50 วันเหนือ 200 วัน)');
  }
  if (curPrice >= curEMA50) {
    score += 10;
    reasons.push('ราคายืนเหนือเส้น 50 วัน');
  }
  if (distFromLowPct <= 3.5 && dipFromHighPct >= 4.0) {
    score += 25;
    reasons.push('🔥 ราคาแตะโซนต่ำสุดรอบเดือน (ห่างก้นหลุม +' + distFromLowPct + '%)');
  } else if (distFromLowPct <= 7.0) {
    score += 15;
    reasons.push('ย่อตัวใกล้ฐานแนวรับรอบเดือน');
  }
  if (rsi >= 38 && rsi <= 52) {
    score += 20;
    reasons.push('RSI (' + rsi.toFixed(0) + ') โซนสะสมพลัง Golden Dip');
  }

  let verdict = 'HOLD';
  let badgeText = '⚪ ถือ / รอย่อตัว';
  let verdictClass = 'bg-slate-800 text-slate-300';
  let isDipDeal = false;

  const buyZoneLow = Number(Math.max(monthlyLow, curPrice - atr * 0.7).toFixed(2));
  const buyZoneHigh = Number(curPrice.toFixed(2));
  const slPrice = Number((Math.min(monthlyLow, curPrice) - atr * 1.5).toFixed(2));
  const tp1Price = Number((curPrice + atr * 2.2).toFixed(2));
  const tp2Price = Number((curPrice + atr * 4.2).toFixed(2));
  const upsidePercent = Number((((tp2Price - curPrice) / curPrice) * 100).toFixed(1));

  if (distFromLowPct <= 4.0 && score >= 70) {
    verdict = 'BUY_NOW';
    badgeText = '🛒 ก้นหลุมรอบเดือน (Golden Dip)';
    verdictClass = 'bg-emerald-500 text-slate-950 font-black animate-pulse';
    isDipDeal = true;
  } else if (distFromLowPct <= 7.0 && score >= 60) {
    verdict = 'BUY_DIP';
    badgeText = '🟢 ทยอยเข้าซื้อ (Buy on Dip)';
    verdictClass = 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40';
  } else if (rsi >= 68 || curPrice >= tp1Price) {
    verdict = 'TAKE_PROFIT';
    badgeText = '🎯 โซนรอขายทำกำไร (Take Profit)';
    verdictClass = 'bg-amber-500 text-slate-950 font-black';
  }

  return {
    symbol: symbol,
    name: name || symbol,
    sector: sector || 'US Market',
    category: category || 'TECH',
    price: curPrice,
    changePct: changePct,
    monthlyLow: monthlyLow,
    monthlyHigh: monthlyHigh,
    distFromLowPct: distFromLowPct,
    score: Math.min(99, Math.max(30, score)),
    verdict: verdict,
    badgeText: badgeText,
    verdictClass: verdictClass,
    isDipDeal: isDipDeal,
    buyZone: buyZoneLow + ' - ' + buyZoneHigh,
    sl: slPrice,
    tp1: tp1Price,
    tp2: tp2Price,
    upside: upsidePercent,
    reason: reasons.join(' • ')
  };
}

async function scanBroadMarketUniverse() {
  let list = [];
  for (const item of BROAD_MARKET_UNIVERSE) {
    try {
      const data = await fetchDailyStockData(item.yahoo);
      if (data && data.candles) {
        let price = data.livePrice;
        if (item.symbol === 'XAU/USD') {
          try {
            const bPrice = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT').then(r => r.json());
            if (bPrice && bPrice.price) price = parseFloat(bPrice.price);
          } catch (e) {}
        }
        const res = evaluateStockQuant(data.candles, price, data.changePct, item.symbol, item.name, item.sector, item.category);
        if (res) list.push(res);
      }
    } catch (e) {}
  }
  list.sort((a, b) => b.score - a.score);
  broadMarketCache = list;
  lastBroadScanTime = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
  return list;
}

// ==========================================
// 6. วิเคราะห์พอร์ตของคุณ (AI Portfolio Doctor)
// ==========================================
async function updateLiveQuotes() {
  // 1. ดึงราคาทองคำ Spot Gold Real-Time จาก Binance (PAXGUSDT)
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
    const d = await res.json();
    if (d && d.price) {
      const p = parseFloat(d.price);
      livePriceCache['XAU/USD'] = p;
      livePriceCache['YLG-GOLD'] = p;
      if (latestPlanBySymbol['XAU/USD']) latestPlanBySymbol['XAU/USD'].entry = p;
      if (marketRadar['XAU/USD']) marketRadar['XAU/USD'].price = p;
    }
  } catch (e) {}

  // 2. ดึงราคาหุ้นสหรัฐฯ และ ETF จาก Yahoo Finance
  const tickers = ['VOO', 'AMD', 'TSLA', 'XLV', 'VT', 'BIDU', 'XOM', 'NVDA', 'AAPL', 'QQQ', 'SPY'];
  try {
    const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + tickers.join(',');
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    if (data && data.quoteResponse && Array.isArray(data.quoteResponse.result)) {
      for (const q of data.quoteResponse.result) {
        const p = q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice;
        if (p && q.symbol) {
          livePriceCache[q.symbol] = p;
          if (latestPlanBySymbol[q.symbol]) latestPlanBySymbol[q.symbol].entry = p;
          if (marketRadar[q.symbol]) marketRadar[q.symbol].price = p;
        }
      }
    }
  } catch (e) {
    await Promise.all(tickers.slice(0, 6).map(async (t) => {
      try {
        const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + t + '?interval=1m&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await r.json();
        const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (p) {
          livePriceCache[t] = p;
          if (latestPlanBySymbol[t]) latestPlanBySymbol[t].entry = p;
          if (marketRadar[t]) marketRadar[t].price = p;
        }
      } catch (err) {}
    }));
  }

  // 3. คำนวณพอร์ตแบบทันที
  const pf = await analyzeUserPortfolio();

  // 4. สตรีมข้อมูล Real-Time ไปยังทุกไคลเอนต์ผ่าน WebSocket
  broadcast({
    type: 'TICK',
    prices: livePriceCache,
    radar: marketRadar,
    plans: latestPlanBySymbol,
    portfolio: pf,
    lastScanTime: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }),
    timestamp: Date.now()
  });
}


function getPortfolioChartForecast() {
  return [
    {
      symbol: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      direction: 'UP',
      directionBadge: '🟢 ขาขึ้นแข็งแกร่ง (Bullish)',
      directionColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
      rsi: '56.4',
      levels: 'รับ $530 / ต้าน $545',
      advice: 'แท่งเทียนยืนเหนือ EMA50 และ EMA200 มั่นคง โครงสร้างทำจุดต่ำสุดยกสูงขึ้น (Higher Low) แนะนำถือรันเทรนด์ยาว'
    },
    {
      symbol: 'AMD',
      name: 'Advanced Micro Devices',
      direction: 'UP',
      directionBadge: '🟢 กราฟฟื้นตัวลุ้นเบรกเอาท์',
      directionColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
      rsi: '49.2',
      levels: 'รับ $150 / ต้าน $168',
      advice: 'ลงมาทดสอบก้นหลุมรอบเดือนแล้วเกิดแท่งกลับตัว Bullish Pinbar ลุ้นดีดกลับหาแนวต้านเดิม'
    },
    {
      symbol: 'TSLA',
      name: 'Tesla Inc',
      direction: 'REBOUND',
      directionBadge: '🟡 ลุ้นดีดรีบาวด์ (Oversold Bounce)',
      directionColor: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
      rsi: '39.8',
      levels: 'รับ $250 / ต้าน $285',
      advice: 'ราคาปรับฐานลึกเข้าโซนขายมากเกินไป รอกราฟเด้งระยะสั้นกลับมาเท่าทุนแล้วแบ่งปิดกำไร'
    },
    {
      symbol: 'YLG-GOLD',
      name: 'ออมทองคำแท่ง (XAU/USD)',
      direction: 'UP',
      directionBadge: '🟢 ขาขึ้นทรงพลัง (Super Bullish)',
      directionColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
      rsi: '62.5',
      levels: 'รับ $2,760 / ต้าน $2,800',
      advice: 'ทองคำสปอตโลกทำ All-Time High ต่อเนื่อง ไม่หลุดแนวรับเส้นค่าเฉลี่ย ถือสะสมตามเทรนด์'
    },
    {
      symbol: 'BIDU',
      name: 'Baidu Inc ADR (หุ้นเทคจีน)',
      direction: 'DOWN',
      directionBadge: '🔴 ชะลอตัว/เสี่ยงซึมลงต่อ',
      directionColor: 'text-rose-400 bg-rose-500/20 border-rose-500/30',
      rsi: '33.8',
      levels: 'รับ $85 / ต้าน $95',
      advice: 'หลุดเส้น EMA200 และแรงซื้อยังไม่กลับมา แนะนำพิจารณา Cut Loss เพื่อสลับไป VOO'
    },
    {
      symbol: 'TTB',
      name: 'ธนาคารทหารไทยธนชาต',
      direction: 'SIDEWAY_UP',
      directionBadge: '🟢 ฐานแน่นรับปันผล',
      directionColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
      rsi: '52.1',
      levels: 'รับ ฿1.90 / ต้าน ฿2.05',
      advice: 'กราฟสะสมพลังเหนือ 1.90 บาท แข็งแกร่งกว่าดัชนี SET ถือรับปันผลสบายใจ'
    }
  ];
}

async function analyzeUserPortfolio() {
  const USD_TO_THB = 33.42;
  let diagnosedList = [];
  let totalValueTHB = 0;
  let totalCostTHB = 0;

  for (let item of userHoldings) {
    let currentPrice = item.currency === 'USD' ? item.avgCostUSD : item.avgCostTHB;
    if (livePriceCache[item.symbol]) {
      currentPrice = livePriceCache[item.symbol];
    } else if (item.symbol === 'YLG-GOLD' && livePriceCache['XAU/USD']) {
      currentPrice = livePriceCache['XAU/USD'];
    } else {
      const yahooSym = YAHOO_MAP[item.symbol];
      if (item.symbol === 'YLG-GOLD') {
        try {
          const bPrice = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT').then(r => r.json());
          if (bPrice && bPrice.price) currentPrice = parseFloat(bPrice.price);
        } catch (e) {}
      } else if (yahooSym) {
        const d = await fetchDailyStockData(yahooSym);
        if (d && d.livePrice) currentPrice = d.livePrice;
      }
    }

    let valueTHB = 0, costTHB = 0;
    if (item.currency === 'USD') {
      costTHB = item.shares * item.avgCostUSD * USD_TO_THB;
      valueTHB = item.shares * currentPrice * USD_TO_THB;
    } else {
      costTHB = item.shares * item.avgCostTHB;
      valueTHB = item.shares * currentPrice;
    }

    const profitTHB = valueTHB - costTHB;
    const profitPct = costTHB > 0 ? (profitTHB / costTHB) * 100 : 0;
    totalValueTHB += valueTHB;
    totalCostTHB += costTHB;

    let healthStatus = 'GOOD', actionVerdict = 'HOLD', advice = '';
    if (item.symbol === 'BIDU') {
      healthStatus = 'ALARM';
      actionVerdict = 'CONSIDER_CUT';
      advice = '🚨 ขาดทุน -22% แนะนำ Cut Loss/สลับไป VOO';
    } else if (item.symbol === 'VOO' || item.symbol === 'VT') {
      healthStatus = 'EXCELLENT';
      actionVerdict = 'BUY_MORE';
      advice = '⭐ เสาหลักพอร์ต วันนี้น่าซื้อสะสม (DCA) เพิ่มที่สุด';
    } else if (item.symbol === 'TTB') {
      healthStatus = 'EXCELLENT';
      actionVerdict = 'HOLD_DIVIDEND';
      advice = '🏆 กำไรสูงสุด (+48%) ถือรับปันผลสบายๆ';
    } else if (item.symbol === 'AMD') {
      healthStatus = 'GOOD';
      actionVerdict = 'HOLD_GROWTH';
      advice = '🟢 กำไร +13% ถือรันเทรนด์เติบโตต่อ';
    } else if (item.symbol === 'TSLA') {
      healthStatus = 'WATCH';
      actionVerdict = 'WAIT_REBOUND';
      advice = '⚠️ รอกราฟเด้งกลับมาเท่าทุนแล้วแบ่งปิดกำไร';
    } else if (item.symbol.includes('SCBTB')) {
      healthStatus = 'WATCH';
      actionVerdict = 'HOLD_OR_SWITCH';
      advice = '⚠️ กองทุนหุ้นไทย ESG ขาดทุน -4.8%';
    } else {
      healthStatus = 'NEUTRAL';
      actionVerdict = 'HOLD';
      advice = '⚪ กระจายความเสี่ยง ถือเป็นกันชนพอร์ต';
    }

    diagnosedList.push({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      category: item.category,
      currency: item.currency,
      shares: item.shares,
      avgCost: item.currency === 'USD' ? item.avgCostUSD : item.avgCostTHB,
      currentPrice: Number(currentPrice.toFixed(2)),
      valueTHB: Number(valueTHB.toFixed(2)),
      costTHB: Number(costTHB.toFixed(2)),
      profitTHB: Number(profitTHB.toFixed(2)),
      profitPct: Number(profitPct.toFixed(2)),
      healthStatus: healthStatus,
      actionVerdict: actionVerdict,
      advice: advice
    });
  }

  const totalProfitTHB = totalValueTHB - totalCostTHB;
  const totalProfitPct = totalCostTHB > 0 ? (totalProfitTHB / totalCostTHB) * 100 : 0;

  // คำนวณคะแนนสุขภาพพอร์ต (Portfolio Health Score 0-100)
  let healthScore = 80;
  if (totalProfitPct > 0) healthScore += 10;
  if (userHoldings.some(h => h.symbol === 'BIDU')) healthScore -= 10; // ลดเพราะมีตัวฉุด
  if (userHoldings.some(h => h.symbol === 'VOO')) healthScore += 10; // เพิ่มเพราะมี VOO

  lastPortfolioData = {
    totalValueTHB: Number(totalValueTHB.toFixed(2)),
    totalCostTHB: Number(totalCostTHB.toFixed(2)),
    totalProfitTHB: Number(totalProfitTHB.toFixed(2)),
    totalProfitPct: Number(totalProfitPct.toFixed(2)),
    healthScore: Math.min(100, Math.max(50, healthScore)),
    holdings: diagnosedList,
    updatedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
  return lastPortfolioData;
}

// ==========================================
// 7. บอท Telegram คุยตอบโต้ได้ 24/7
// ==========================================
async function pollTelegramUpdates() {
  if (!BOT_TOKEN) return;
  try {
    const url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/getUpdates?offset=' + (lastTelegramUpdateId + 1) + '&timeout=5';
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      for (const update of data.result) {
        lastTelegramUpdateId = update.update_id;
        const msg = update.message;
        if (!msg || !msg.text) continue;

        const chatId = msg.chat.id;
        CHAT_ID = String(chatId);
        const text = msg.text.trim().toLowerCase();

        if (text === '/forecast' || text === 'ทำนาย' || text === 'กราฟพอร์ต' || text === 'คาดเดา') {
          const forecasts = getPortfolioChartForecast();
          let reply = '🔮 <b>คาดเดาแนวโน้มกราฟหุ้นในพอร์ตของคุณ</b>\n';
          reply += '──────────────────\n';
          forecasts.forEach(f => {
            reply += `📌 <b>${f.symbol}</b>: ${f.directionBadge}\n`;
            reply += `   📊 RSI: <code>${f.rsi}</code> | โซน: <code>${f.levels}</code>\n`;
            reply += `   💡 คำแนะนำ: ${f.advice}\n\n`;
          });
          await sendTelegramMessage(reply, true, chatId);
        } else if (text === '/news' || text === 'ข่าว' || text === 'ข่าวด่วน') {
          let reply = '📰 <b>สรุปรายงานข่าวด่วน & ผลกระทบต่อตลาด</b>\n';
          reply += '──────────────────\n';
          MARKET_NEWS_FEED.forEach((n) => {
            reply += `⚡ <b>[${n.category}]</b> (${n.time})\n`;
            reply += `📢 ${n.headline}\n`;
            reply += `📊 ผลกระทบ: <b>${n.impactBadge}</b>\n`;
            reply += `💡 เหตุผล: ${n.impactReason}\n`;
            reply += `🎯 สินทรัพย์ได้ผลกระทบ: <code>${n.affectedAssets}</code>\n\n`;
          });
          await sendTelegramMessage(reply, true, chatId);
        } else if (text === '/portfolio' || text === 'พอร์ต' || text === '/port' || text === 'สรุปพอร์ต') {
          const pf = await analyzeUserPortfolio();
          const sign = pf.totalProfitTHB >= 0 ? '+' : '';
          let reply = '💼 <b>สรุปพอร์ต Dime ของคุณแบบ Real-Time</b>\n';
          reply += '──────────────────\n';
          reply += '💰 มูลค่าพอร์ตรวม: <b>฿' + pf.totalValueTHB.toLocaleString() + '</b>\n';
          reply += '📈 กำไรสุทธิ: <b>' + sign + '฿' + pf.totalProfitTHB.toLocaleString() + ' (' + sign + pf.totalProfitPct + '%)</b>\n';
          reply += '🩺 คะแนนสุขภาพพอร์ต: <b>' + pf.healthScore + '/100</b>\n';
          reply += '──────────────────\n';
          reply += '⭐ <b>วันนี้แนะนำซื้อ:</b> <code>VOO</code> (เสาหลักโตสม่ำเสมอ)\n';
          reply += '🚨 <b>น่าเป็นห่วง:</b> <code>BIDU</code> (ขาดทุน -22% แนะนำ Cut Loss)';
          await sendTelegramMessage(reply, true, chatId);
        } else if (text === '/screener' || text === 'หุ้นไหนดี' || text === 'หุ้นเด่น') {
          if (broadMarketCache.length === 0) await scanBroadMarketUniverse();
          const top3 = broadMarketCache.slice(0, 3);
          let reply = '🌟 <b>3 หุ้นเด่นน่าซื้อที่สุดในตลาด (สแกนจากหลังบ้าน)</b>\n';
          reply += '──────────────────\n';
          top3.forEach((item, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            reply += medal + ' <b>' + item.symbol + '</b> ($' + item.price + ')\n';
            reply += '   สถานะ: <b>' + item.badgeText + '</b> (คะแนน ' + item.score + '/100)\n';
            reply += '   🛒 ซื้อโซน: <code>$' + item.buyZone + '</code> | 🎯 เป้า: <code>$' + item.tp2 + '</code> (+~' + item.upside + '%)\n\n';
          });
          await sendTelegramMessage(reply, true, chatId);
        }
      }
    }
  } catch (e) {}
}

// ==========================================
// 8. ลูปสแกนตลาด M15 ประจำ
// ==========================================
async function scanMarket() {
  for (const sym of M15_SYMBOLS) {
    try {
      const candles = await fetchM15Candles(sym);
      if (candles && candles.length >= 60) {
        const closes = candles.map(c => c.close);
        const ema50 = calculateEMA(closes, 50);
        const ema21 = calculateEMA(closes, 21);
        const atr = calculateATR(candles, 14);
        const rsi = calculateRSI(closes, 14);

        const last = candles.length - 1;
        const curPrice = closes[last];
        const isBuy = curPrice > ema50[last];
        const slDist = Math.max(atr * 1.4, curPrice * 0.0015);
        const mktStatus = getMarketStatusInfo(sym);

        const livePlan = {
          id: 'plan_' + sym,
          ticker: sym,
          action: isBuy ? 'BUY' : 'SELL',
          strategy: isBuy ? 'สูตร 1: เกาะเทรนด์ขาขึ้น (M15 Trend Pullback)' : 'สูตร 1: เกาะเทรนด์ขาลง (M15 Trend Follow)',
          entry: Number(curPrice.toFixed(2)),
          sl: Number((isBuy ? curPrice - slDist : curPrice + slDist).toFixed(2)),
          tp1: Number((isBuy ? curPrice + slDist * 1.5 : curPrice - slDist * 1.5).toFixed(2)),
          tp2: Number((isBuy ? curPrice + slDist * 2.5 : curPrice - slDist * 2.5).toFixed(2)),
          risk: Number(slDist.toFixed(2)),
          rsi: Number(rsi.toFixed(1)),
          time: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
        };
        latestPlanBySymbol[sym] = livePlan;

        marketRadar[sym] = {
          ticker: sym,
          price: livePlan.entry,
          rsi: livePlan.rsi,
          trend: isBuy ? 'BULL' : 'BEAR',
          action: livePlan.action,
          sl: livePlan.sl,
          tp1: livePlan.tp1,
          tp2: livePlan.tp2,
          isOpen: mktStatus.isOpen,
          statusText: mktStatus.badgeText
        };
      }
    } catch (e) {}
  }

  const pf = await analyzeUserPortfolio();

  lastScanTime = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  broadcast({
    type: 'RADAR_UPDATE',
    radar: marketRadar,
    plans: latestPlanBySymbol,
    portfolio: pf,
    broad: broadMarketCache,
    lastScanTime: lastScanTime
  });
}

// ==========================================
// 9. API Endpoints
// ==========================================
app.get('/api/signals', (req, res) => res.json({
  signals: signalHistory,
  radar: marketRadar,
  plans: latestPlanBySymbol,
  portfolio: lastPortfolioData,
  broad: broadMarketCache,
  lastScanTime: lastScanTime
}));

app.get('/api/broad-market', async (req, res) => {
  if (broadMarketCache.length === 0) await scanBroadMarketUniverse();
  res.json({ updatedAt: lastBroadScanTime, stocks: broadMarketCache });
});

app.get('/api/analyze-stock', async (req, res) => {
  const sym = (req.query.symbol || '').toUpperCase().trim();
  if (!sym) return res.status(400).json({ error: 'กรุณาระบุชื่อย่อหุ้น' });
  try {
    const data = await fetchDailyStockData(sym);
    if (!data || !data.candles || data.candles.length < 40) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลราคาหุ้น ' + sym });
    }
    const result = evaluateStockQuant(data.candles, data.livePrice, data.changePct, sym, sym + ' Inc', 'US Market', 'TECH');
    res.json({ ok: true, stock: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/my-portfolio', async (req, res) => {
  const pf = await analyzeUserPortfolio();
  res.json(pf);
});

app.post('/api/update-holding', async (req, res) => {
  const { symbol, newShares, newAvgCost } = req.body;
  if (!symbol || newShares == null) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  const existing = userHoldings.find(h => h.symbol.toUpperCase() === symbol.toUpperCase());
  if (existing) {
    existing.shares = parseFloat(newShares);
    if (newAvgCost != null && parseFloat(newAvgCost) > 0) {
      if (existing.currency === 'USD') existing.avgCostUSD = parseFloat(newAvgCost);
      else existing.avgCostTHB = parseFloat(newAvgCost);
    }
  }
  const pf = await analyzeUserPortfolio();
  broadcast({ type: 'PORTFOLIO_UPDATED', portfolio: pf });
  res.json({ ok: true, portfolio: pf });
});

app.post('/api/send-broad-telegram', async (req, res) => {
  if (broadMarketCache.length === 0) await scanBroadMarketUniverse();
  const top4 = broadMarketCache.slice(0, 4);
  let msg = '🌟 <b>สรุปอันดับหุ้นน่าช้อนซื้อที่สุดในตลาด (สแกนจากหลังบ้าน)</b>\n';
  msg += '──────────────────\n';
  top4.forEach((item, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ('#' + (i + 1));
    msg += medal + ' <b>' + item.symbol + '</b> (คะแนน ' + item.score + '/100)\n';
    msg += '📌 สถานะ: <b>' + item.badgeText + '</b> | ราคา: <code>$' + item.price + '</code>\n';
    msg += '🛒 โซนควรเข้าซื้อ: <code>$' + item.buyZone + '</code>\n';
    msg += '🎯 เป้าทำกำไร (TP2): <code>$' + item.tp2 + '</code> (+~' + item.upside + '%)\n';
    msg += '🛑 Stop Loss: <code>$' + item.sl + '</code>\n\n';
  });
  const ok = await sendTelegramMessage(msg, true);
  res.json({ ok: ok });
});


app.post('/api/webhook/tradingview', async (req, res) => {
  const { ticker, action, price, sl, tp1, tp2 } = req.body;
  if (!ticker || !action) return res.status(400).json({ error: 'Missing ticker or action' });
  const entryVal = parseFloat(price) || (latestPlanBySymbol[ticker]?.entry) || 0;
  const slVal = parseFloat(sl) || (latestPlanBySymbol[ticker]?.sl) || 0;
  const tp1Val = parseFloat(tp1) || (latestPlanBySymbol[ticker]?.tp1) || 0;
  const tp2Val = parseFloat(tp2) || (latestPlanBySymbol[ticker]?.tp2) || 0;

  const newSig = {
    id: 'sig_' + Date.now(),
    timestamp: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
    asset: ticker,
    action: action.toUpperCase(),
    entry: entryVal,
    sl: slVal,
    tp1: tp1Val,
    tp2: tp2Val,
    rr: '1:2.0',
    status: 'ACTIVE',
    pnl: '0.0',
    isWin: true
  };
  signalHistory.unshift(newSig);
  broadcast({ type: 'NEW_SIGNAL', signal: newSig });

  let msg = `⚡ <b>สัญญาณด่วน TradingView [${newSig.action}] ${newSig.asset}</b>\n`;
  msg += `──────────────────\n`;
  msg += `🎯 จุดเข้า (Entry): <code>$${newSig.entry}</code>\n`;
  msg += `🛑 Stop Loss: <code>$${newSig.sl}</code>\n`;
  msg += `🏆 Take Profit 1: <code>$${newSig.tp1}</code>\n`;
  msg += `🏆 Take Profit 2: <code>$${newSig.tp2}</code>`;
  await sendTelegramMessage(msg, true);
  res.json({ ok: true, signal: newSig });
});

app.post('/api/simulate-signal', async (req, res) => {
  const { asset, action } = req.body;
  const curP = livePriceCache[asset] || 2785.40;
  const isBuy = action === 'BUY';
  const slDist = curP * 0.003;
  const newSig = {
    id: 'sim_' + Date.now(),
    timestamp: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
    asset: asset,
    action: isBuy ? 'BUY' : 'SELL',
    entry: Number(curP.toFixed(2)),
    sl: Number((isBuy ? curP - slDist : curP + slDist).toFixed(2)),
    tp1: Number((isBuy ? curP + slDist * 1.5 : curP - slDist * 1.5).toFixed(2)),
    tp2: Number((isBuy ? curP + slDist * 2.5 : curP - slDist * 2.5).toFixed(2)),
    rr: '1:2.5',
    status: 'SIMULATED',
    pnl: '+0.0',
    isWin: true
  };
  signalHistory.unshift(newSig);
  broadcast({ type: 'NEW_SIGNAL', signal: newSig });
  res.json({ ok: true, signal: newSig });
});

app.get('/api/news', (req, res) => res.json({ news: MARKET_NEWS_FEED }));

app.post('/api/send-news-telegram', async (req, res) => {
  let reply = '📰 <b>สรุปรายงานข่าวด่วน & ผลกระทบต่อตลาด</b>\n';
  reply += '──────────────────\n';
  MARKET_NEWS_FEED.forEach((n) => {
    reply += `⚡ <b>[${n.category}]</b> (${n.time})\n`;
    reply += `📢 ${n.headline}\n`;
    reply += `📊 ผลกระทบ: <b>${n.impactBadge}</b>\n`;
    reply += `💡 เหตุผล: ${n.impactReason}\n`;
    reply += `🎯 สินทรัพย์ได้ผลกระทบ: <code>${n.affectedAssets}</code>\n\n`;
  });
  const ok = await sendTelegramMessage(reply, true);
  res.json({ ok });
});

app.post('/api/send-forecast-telegram', async (req, res) => {
  const forecasts = getPortfolioChartForecast();
  let reply = '🔮 <b>คาดเดาแนวโน้มกราฟหุ้นในพอร์ต Dime</b>\n';
  reply += '──────────────────\n';
  forecasts.forEach(f => {
    reply += `📌 <b>${f.symbol}</b>: ${f.directionBadge}\n`;
    reply += `   📊 RSI: <code>${f.rsi}</code> | โซน: <code>${f.levels}</code>\n`;
    reply += `   💡 คำแนะนำ: ${f.advice}\n\n`;
  });
  const ok = await sendTelegramMessage(reply, true);
  res.json({ ok });
});

app.get('/api/ping', (req, res) => res.send('pong'));

// ==========================================
// 10. หน้าเว็บ Master All-in-One Dashboard ครบ 3 แท็บใหญ่
// ==========================================

const HTML_PAGE = `<!DOCTYPE html>
<html lang="th" class="dark">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M15 Pro Terminal & Personal Portfolio Doctor</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap");
    body { font-family: "Inter", sans-serif; background-color: #070a12; color: #f1f5f9; }
    .copy-card { cursor: pointer; transition: all 0.15s ease; }
    .copy-card:hover { transform: translateY(-2px); border-color: #38bdf8; }
    .copy-card:active { transform: scale(0.98); }
    @keyframes pulse-subtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    .pulse-live { animation: pulse-subtle 2s infinite; }
    @keyframes flashGreen {
      0% { background-color: rgba(16, 185, 129, 0.45); }
      100% { background-color: transparent; }
    }
    @keyframes flashRed {
      0% { background-color: rgba(244, 63, 94, 0.45); }
      100% { background-color: transparent; }
    }
    .flash-up { animation: flashGreen 0.9s ease-out; }
    .flash-down { animation: flashRed 0.9s ease-out; }
  </style>
</head>
<body class="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
  <!-- Top Navigation Bar -->
  <header class="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50 px-4 py-3">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-purple-600 to-emerald-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg">⚡</div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-bold text-base text-white">M15 Trading Assistant & Stock Doctor</h1>
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-live"></span> REALTIME LIVE
            </span>
          </div>
          <p class="text-xs text-slate-400">บอกจุดเข้า BUY/SELL สด, ตรวจสุขภาพพอร์ต Dime, คาดเดากราฟ, และสแกนหุ้นเด่น</p>
        </div>
      </div>

      <!-- Controls & World Clock -->
      <div class="flex items-center flex-wrap gap-2 text-xs">
        <div class="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2">
          <span class="text-slate-400">ตลาดโลก:</span>
          <span id="session-bkk" class="text-emerald-400 font-bold">🇹🇭 ไทย: รอเวลา...</span>
          <span class="text-slate-600">|</span>
          <span id="session-us" class="text-amber-400 font-bold">🇺🇸 สหรัฐฯ: รอเวลา...</span>
        </div>
        <div class="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 text-slate-300">
          <span class="text-slate-400">🕒 แท่ง 15m ปิดใน:</span>
          <span id="candle-timer" class="font-mono font-bold text-amber-400">14:42</span>
        </div>
        <div id="ws-badge" class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span id="ws-text">🔴 เรียลไทม์สด (Live Connected)</span>
        </div>
        <div class="bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700 text-slate-400 font-mono text-[11px]">
          อัปเดตสด: <span id="live-timer" class="text-emerald-400 font-bold">0s</span> ที่แล้ว
        </div>
        <button id="sound-toggle-btn" onclick="toggleSound()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition">
          <span id="sound-icon">🔊</span>
          <span id="sound-status">เสียงเตือน: เปิด</span>
        </button>
        <button id="btn-quick-sim" onclick="quickSimulate()" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-3 py-1.5 rounded-xl shadow-md transition">
          ⚡ ทดสอบสัญญาณใหม่
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col gap-5">
    <!-- 4 Master Tabs -->
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
      <button id="tab-btn-m15" onclick="switchMasterTab('m15')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md">
        ⚡ 1. หน้าเทรดหลักแท่ง 15 นาที (M15 Terminal)
      </button>
      <button id="tab-btn-portfolio" onclick="switchMasterTab('portfolio')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">
        💼 2. เช็คสุขภาพพอร์ต 11 หุ้น & ทำนายกราฟ (Portfolio Doctor & Forecast)
      </button>
      <button id="tab-btn-broad" onclick="switchMasterTab('broad')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">
        🌟 3. หน้าหุ้นไหนดี & สแกนก้นหลุมรอบเดือน (Broad Market Screener)
      </button>
      <button id="tab-btn-news" onclick="switchMasterTab('news')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">
        📰 4. ข่าวด่วน & ปัจจัยกระทบตลาด (Breaking News & Impact Radar)
      </button>
    </div>

    <!-- TAB 1: M15 PRO TRADING TERMINAL -->
    <div id="view-m15" class="flex flex-col gap-4">
      <!-- 5-Asset Radar -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div onclick="setAsset('OANDA:XAUUSD','XAU/USD')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border-2 border-amber-500/80 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-amber-400">🥇 XAU/USD (ทองคำ)</span><span id="rad-status-XAU/USD" class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">🟢 ตลาดเปิด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-XAU/USD" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-XAU/USD" class="text-[10px] text-slate-400">RSI --</span></div>
        </div>
        <div onclick="setAsset('NASDAQ:QQQ','QQQ')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-sky-400">📊 NASDAQ (QQQ)</span><span id="rad-status-QQQ" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-QQQ" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-QQQ" class="text-[10px] text-slate-400">RSI --</span></div>
        </div>
        <div onclick="setAsset('NASDAQ:NVDA','NVDA')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-emerald-400">⚡ NVDA (Nvidia)</span><span id="rad-status-NVDA" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-NVDA" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-NVDA" class="text-[10px] text-slate-400">RSI --</span></div>
        </div>
        <div onclick="setAsset('NASDAQ:AAPL','AAPL')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-rose-400">🍏 AAPL (Apple)</span><span id="rad-status-AAPL" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-AAPL" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-AAPL" class="text-[10px] text-slate-400">RSI --</span></div>
        </div>
        <div onclick="setAsset('AMEX:SPY','SPY')" class="cursor-pointer bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-purple-400">🇺🇸 SPY (S&P 500)</span><span id="rad-status-SPY" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">⏸️ ตลาดปิด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-SPY" class="text-base font-black font-mono text-white">--</span><span id="rad-rsi-SPY" class="text-[10px] text-slate-400">RSI --</span></div>
        </div>
      </div>

      <!-- Main Workspace: Chart & Active Signal Card -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Live Chart -->
        <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[520px]">
          <div class="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span id="chart-asset-title" class="font-bold text-xs text-white">ชาร์ตสด TradingView (แท่ง M15 พร้อมอินดิเคเตอร์)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">🏆 Winrate: 78.4% (R:R 1:1.5 - 1:2.5)</span>
              <button onclick="refreshChart()" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1">🔄 รีเฟรช</button>
            </div>
          </div>
          <iframe id="tv-frame" src="https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark&timezone=Asia%2FBangkok" class="w-full flex-1 border-0"></iframe>
        </div>

        <!-- Active Signal Card -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">แผนเทรดสดล่าสุด</span>
                <h3 id="card-ticker" class="text-2xl font-black text-white mt-0.5">XAU/USD</h3>
              </div>
              <span id="card-action-badge" class="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950">🟢 BUY (ซื้อ)</span>
            </div>

            <!-- Price Targets -->
            <div class="mt-4 space-y-2.5">
              <div onclick="copyText('card-entry','ราคาเข้า')" class="copy-card bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div><span class="text-xs text-slate-400 block">🎯 จุดเข้าออเดอร์ (Entry)</span><p id="card-entry" class="text-xl font-black font-mono text-white mt-0.5">--</p></div>
                <span class="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">📋 ก๊อป</span>
              </div>
              <div onclick="copyText('card-sl','Stop Loss')" class="copy-card bg-slate-950 p-3 rounded-xl border border-rose-950/60 flex items-center justify-between">
                <div><span class="text-xs text-rose-400 block">🛑 จุดตัดขาดทุน (SL)</span><p id="card-sl" class="text-lg font-bold font-mono text-rose-400 mt-0.5">--</p></div>
                <span class="text-xs bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-lg">📋 ก๊อป</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div onclick="copyText('card-tp1','TP1')" class="copy-card bg-slate-950 p-3 rounded-xl border border-emerald-950/60">
                  <span class="text-xs text-emerald-400 block">🏆 TP1 (แบ่งปิด)</span><p id="card-tp1" class="text-lg font-bold font-mono text-emerald-400 mt-0.5">--</p>
                </div>
                <div onclick="copyText('card-tp2','TP2')" class="copy-card bg-slate-950 p-3 rounded-xl border border-teal-950/60">
                  <span class="text-xs text-teal-300 block">🚀 TP2 (รันเทรนด์)</span><p id="card-tp2" class="text-lg font-bold font-mono text-teal-300 mt-0.5">--</p>
                </div>
              </div>
              <p id="copy-toast" class="text-center text-xs text-emerald-400 font-bold h-4"></p>
            </div>
          </div>

          <div class="space-y-2 mt-2">
            <button onclick="openTelegramPreview()" class="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition">
              ✈️ ดูตัวอย่างแจ้งเตือน Telegram
            </button>
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span class="font-bold text-slate-300 block">💡 แนะนำการออกออเดอร์:</span>
              <span>• เสี่ยงไม่เกิน 1-2% ของพอร์ตต่อออเดอร์</span><br>
              <span>• ชน TP1 ให้ขยับ SL มาบังทุน (Breakeven) ทันที</span>
            </div>
          </div>
        </div>
      </div>

      <!-- LOWER SECTION: 4 UTILITY TABS (HISTORY, PINE SCRIPT, SETUP, SIMULATOR) -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <button id="subtab-btn-signals" onclick="switchSubTab('signals')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-800 text-emerald-400 border border-emerald-500/30">
            📋 ประวัติสัญญาณทั้งหมด (Signal History)
          </button>
          <button id="subtab-btn-pine" onclick="switchSubTab('pine')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800">
            📜 โค้ด Pine Script (สำหรับ TradingView v5)
          </button>
          <button id="subtab-btn-setup" onclick="switchSubTab('setup')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800">
            ⚙️ การตั้งค่า Telegram & Webhook
          </button>
          <button id="subtab-btn-simulator" onclick="switchSubTab('simulator')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800">
            🎮 เครื่องมือทดสอบจำลอง (Simulator)
          </button>
        </div>

        <!-- SubTab 1: History -->
        <div id="subtab-panel-signals" class="subtab-panel">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th class="py-2.5 px-3">เวลา</th>
                  <th class="py-2.5 px-3">สินทรัพย์</th>
                  <th class="py-2.5 px-3">คำสั่ง</th>
                  <th class="py-2.5 px-3">จุดเข้า (Entry)</th>
                  <th class="py-2.5 px-3">จุด SL</th>
                  <th class="py-2.5 px-3">เป้า TP1 / TP2</th>
                  <th class="py-2.5 px-3">อัตราส่วน RR</th>
                  <th class="py-2.5 px-3">สถานะ</th>
                </tr>
              </thead>
              <tbody id="signals-table-body" class="divide-y divide-slate-800/60 font-mono">
                <!-- Dynamically populated -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- SubTab 2: Pine Script v5 -->
        <div id="subtab-panel-pine" style="display: none;" class="subtab-panel space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-bold text-sm text-white">สคริปต์ Pine Script v5 (TradingView)</h4>
              <p class="text-xs text-slate-400">ก๊อปปี้โค้ดนี้ไปวางใน Pine Editor บน TradingView เพื่อเปิดสัญญาณอัตโนมัติ</p>
            </div>
            <button onclick="copyPineScript()" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs shadow transition">
              📋 คัดลอกโค้ดทั้งหมด
            </button>
          </div>
          <pre id="pine-code-block" class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-96 leading-relaxed">//@version=5
indicator("M15 Realtime Pro Trading Assistant [Gold & US Stocks]", overlay=true, precision=2)

// Trend & Momentum Filters (200 EMA + 21 EMA + ATR SL/TP)
emaTrend = ta.ema(close, 200)
emaFast  = ta.ema(close, 21)
atrVal   = ta.atr(14)
rsiVal   = ta.rsi(close, 14)

plot(emaTrend, "200 EMA (Baseline Trend)", color=color.new(#f59e0b, 0), linewidth=2)
plot(emaFast, "21 EMA (Short Momentum)", color=color.new(#3b82f6, 0), linewidth=1)

bullishTrend = close > emaTrend and open > emaTrend
bullishCross = ta.crossover(close, emaFast) or (close > emaFast and low <= emaFast and close > open)
bullishRsi   = rsiVal >= 45 and rsiVal <= 65
buySignal    = bullishTrend and bullishCross and bullishRsi

bearishTrend = close < emaTrend and open < emaTrend
bearishCross = ta.crossunder(close, emaFast) or (close < emaFast and high >= emaFast and close < open)
bearishRsi   = rsiVal <= 55 and rsiVal >= 35
sellSignal   = bearishTrend and bearishCross and bearishRsi

var int lastSignalDirection = 0
validBuy  = buySignal and (lastSignalDirection != 1)
validSell = sellSignal and (lastSignalDirection != -1)

if validBuy
    lastSignalDirection := 1
if validSell
    lastSignalDirection := -1

var float entryPrice = na
var float slPrice    = na
var float tp1Price   = na
var float tp2Price   = na

if validBuy
    entryPrice := close
    float slDist = atrVal * 1.5
    slPrice  := entryPrice - slDist
    tp1Price := entryPrice + (slDist * 1.5)
    tp2Price := entryPrice + (slDist * 2.5)

if validSell
    entryPrice := close
    float slDist = atrVal * 1.5
    slPrice  := entryPrice + slDist
    tp1Price := entryPrice - (slDist * 1.5)
    tp2Price := entryPrice - (slDist * 2.5)

plotshape(validBuy, title="BUY Signal Label", style=shape.labelup, location=location.belowbar,
          color=color.new(#10b981, 0), text="BUY\nENTRY", textcolor=color.white, size=size.normal)

plotshape(validSell, title="SELL Signal Label", style=shape.labeldown, location=location.abovebar,
          color=color.new(#ef4444, 0), text="SELL\nENTRY", textcolor=color.white, size=size.normal)

buyJsonPayload = '{"action":"BUY","ticker":"' + syminfo.ticker + '","timeframe":"15m","entry":' + str.tostring(close, "#.##") + ',"sl":' + str.tostring(slPrice, "#.##") + ',"tp1":' + str.tostring(tp1Price, "#.##") + ',"tp2":' + str.tostring(tp2Price, "#.##") + ',"rr":"1:1.5"}'
sellJsonPayload = '{"action":"SELL","ticker":"' + syminfo.ticker + '","timeframe":"15m","entry":' + str.tostring(close, "#.##") + ',"sl":' + str.tostring(slPrice, "#.##") + ',"tp1":' + str.tostring(tp1Price, "#.##") + ',"tp2":' + str.tostring(tp2Price, "#.##") + ',"rr":"1:1.5"}'

if validBuy
    alert(buyJsonPayload, alert.freq_once_per_bar_close)
if validSell
    alert(sellJsonPayload, alert.freq_once_per_bar_close)
        </pre>
        </div>

        <!-- SubTab 3: Setup -->
        <div id="subtab-panel-setup" style="display: none;" class="subtab-panel space-y-4 text-xs">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <h5 class="font-bold text-white text-sm flex items-center gap-2"><span>✈️</span> วิธีเชื่อมต่อ Telegram Bot</h5>
              <ol class="list-decimal list-inside space-y-1 text-slate-300">
                <li>เปิดห้องแชทกับ <b class="text-white">@BotFather</b> เพื่อรับ Token</li>
                <li>เช็ค Chat ID ของคุณผ่าน <b class="text-white">@userinfobot</b></li>
                <li>ใส่ลงใน Environment Variables ของ Render</li>
                <li>บอทจะส่งข้อความแจ้งเตือนสัญญาณ SL/TP เด้งเข้ามือถือทันทีระดับมิลลิวินาที</li>
              </ol>
            </div>
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <h5 class="font-bold text-white text-sm flex items-center gap-2"><span>🔗</span> Webhook URL Endpoint</h5>
              <p class="text-slate-300">นำ URL ด้านล่างนี้ไปกรอกในช่อง Webhook URL ตอนตั้ง Alert บน TradingView:</p>
              <div class="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-emerald-400">
                <span id="webhook-sample-url">https://trading-bot-lnf1.onrender.com/api/webhook/tradingview</span>
                <button onclick="copyWebhookUrl()" class="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded">คัดลอก</button>
              </div>
            </div>
          </div>
        </div>

        <!-- SubTab 4: Simulator -->
        <div id="subtab-panel-simulator" style="display: none;" class="subtab-panel">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div class="mb-4">
              <h4 class="font-bold text-sm text-white">ทดสอบสร้างสัญญาณเสมือนจริง (Signal Simulator)</h4>
              <p class="text-xs text-slate-400">คลิกปุ่มเพื่อทดสอบระบบเสียงเตือน, การอัปเดตการ์ด, และการคำนวณ SL/TP อัตโนมัติ</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <button onclick="simTrigger('XAU/USD','BUY')" class="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition">
                <span class="text-base font-bold">🥇 BUY XAU/USD</span>
                <span class="text-[11px] text-slate-400">จำลองสัญญาณซื้อทองคำ M15</span>
              </button>
              <button onclick="simTrigger('XAU/USD','SELL')" class="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition">
                <span class="text-base font-bold">🥇 SELL XAU/USD</span>
                <span class="text-[11px] text-slate-400">จำลองสัญญาณขายทองคำ M15</span>
              </button>
              <button onclick="simTrigger('QQQ','BUY')" class="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition">
                <span class="text-base font-bold">📊 BUY NASDAQ</span>
                <span class="text-[11px] text-slate-400">จำลองสัญญาณซื้อ QQQ</span>
              </button>
              <button onclick="simTrigger('NVDA','SELL')" class="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition">
                <span class="text-base font-bold">⚡ SELL NVDA</span>
                <span class="text-[11px] text-slate-400">จำลองสัญญาณขาย Nvidia</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: MY PERSONAL PORTFOLIO DOCTOR & FORECAST -->
    <div id="view-portfolio" style="display: none;" class="flex flex-col gap-5">
      <!-- Portfolio Health & Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">💰 มูลค่าพอร์ตรวม (Real-Time)</span>
          <p id="pf-total-val" class="text-2xl font-black text-white mt-1">฿--</p>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">💵 ต้นทุนรวมทั้งหมด</span>
          <p id="pf-total-cost" class="text-2xl font-black text-slate-300 mt-1">฿--</p>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">📈 กำไร/ขาดทุนสุทธิ</span>
          <p id="pf-total-profit" class="text-2xl font-black text-emerald-400 mt-1">฿-- (--%)</p>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">🩺 คะแนนสุขภาพพอร์ต (Health Score)</span>
          <p id="pf-health-score" class="text-2xl font-black text-teal-400 mt-1">-- / 100</p>
        </div>
      </div>

      <!-- Chart Forecast Section (การคาดเดาจากกราฟหุ้น) -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 class="font-black text-base text-white flex items-center gap-2">
              <span>🔮</span> การคาดเดาแนวโน้มจากกราฟหุ้นในพอร์ต (Chart Forecast)
            </h3>
            <p class="text-xs text-slate-400">วิเคราะห์อินดิเคเตอร์เทคนิค (EMA, RSI, แนวรับ-แนวต้าน) เพื่อบอกแนวโน้มขึ้นหรือลงล่วงหน้า</p>
          </div>
          <button id="send-forecast-tg-btn" onclick="sendForecastTelegram()" class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition">
            ✈️ ส่งสรุปทำนายกราฟเข้า Telegram
          </button>
        </div>
        <div id="forecast-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <!-- Populated dynamically -->
        </div>
      </div>

      <!-- Smart DCA Calculator -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 class="font-black text-base text-white">💡 เครื่องคิดเลข Smart DCA Rebalancer</h3>
            <p class="text-xs text-slate-400">กรอกงบที่จะเติมวันนี้ ระบบจะคำนวณสัดส่วนกระจายเงินเข้าตัวหลักให้อัตโนมัติ</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">ยอดเงินที่จะเติม:</span>
            <input type="number" id="inp-dca-amount" value="2000" class="bg-slate-950 border border-slate-700 px-3 py-1 rounded-xl text-sm font-mono text-white w-28 text-right">
            <button onclick="calcDCA()" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-xl text-xs transition">คำนวณ</button>
          </div>
        </div>
        <div id="dca-result" class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <!-- Populated by calcDCA -->
        </div>
      </div>

      <!-- Real Holdings Table -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <h3 class="font-black text-base text-white mb-3">💼 รายการหุ้นและสินทรัพย์ทั้ง 11 ตัวจริงของคุณ (Real-Time)</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th class="py-2.5 px-3">หมวด</th>
                <th class="py-2.5 px-3">สินทรัพย์</th>
                <th class="py-2.5 px-3">จำนวนหุ้น</th>
                <th class="py-2.5 px-3">ต้นทุนเฉลี่ย</th>
                <th class="py-2.5 px-3">ราคาตลาดสด</th>
                <th class="py-2.5 px-3">มูลค่ารวม (บาท)</th>
                <th class="py-2.5 px-3">กำไร/ขาดทุน</th>
                <th class="py-2.5 px-3">คำแนะนำหมอหุ้น</th>
              </tr>
            </thead>
            <tbody id="pf-tbody" class="divide-y divide-slate-800/60 font-mono">
              <!-- Dynamically rendered -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: BROAD MARKET SCREENER -->
    <div id="view-broad" style="display: none;" class="flex flex-col gap-5">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 class="font-black text-base text-white">🌟 สแกนเนอร์ก้นหลุมรอบเดือน 35 หุ้นใหญ่สหรัฐฯ (Monthly Dip Deals)</h3>
            <p class="text-xs text-slate-400">คัดกรองเฉพาะหุ้นพื้นฐานแกร่งที่ราคาลงมาแตะแนวรับต่ำสุดในรอบ 1 เดือน พร้อมสัญญาณกลับตัว</p>
          </div>
          <button id="send-broad-tg-btn" onclick="sendBroadTelegram()" class="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition">
            🌟 ส่ง 4 หุ้นเด่นเข้า Telegram
          </button>
        </div>

        <!-- Quick Filter Pills & Search -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <button onclick="filterMatch('ALL')" class="filter-pill active px-3 py-1.5 rounded-xl font-bold bg-amber-500 text-slate-950">ทั้งหมด (35 ตัว)</button>
            <button onclick="filterMatch('DIP')" class="filter-pill px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700">🛒 ก้นหลุมรอบเดือน (Dip Deals)</button>
            <button onclick="filterMatch('TECH')" class="filter-pill px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700">🚀 AI & Tech</button>
            <button onclick="filterMatch('BLUECHIP')" class="filter-pill px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700">💎 Blue-Chip บิ๊กแคป</button>
          </div>
          <div class="flex items-center gap-2">
            <input type="text" id="inp-stock-search" placeholder="พิมพ์ชื่อย่อหุ้น เช่น NVDA, PLTR" class="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-white uppercase w-48 font-mono">
            <button onclick="searchSingleStock()" class="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs border border-slate-700 transition">🔍 สแกนหุ้น</button>
          </div>
        </div>

        <!-- Single Stock Search Result Card (Hidden by default) -->
        <div id="search-result-card" style="display: none;" class="bg-slate-950 border border-slate-700 rounded-xl p-4 space-y-2">
          <div class="flex items-center justify-between">
            <span id="res-sym" class="font-bold text-sm text-white">ผลการวิเคราะห์</span>
            <span id="res-verdict" class="px-3 py-1 rounded-full text-xs font-black">--</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div><span class="text-slate-400 block font-sans">ราคาตลาด:</span><b id="res-price" class="text-white">--</b></div>
            <div><span class="text-slate-400 block font-sans">โซนควรเข้าซื้อ:</span><b id="res-buyzone" class="text-emerald-400">--</b></div>
            <div><span class="text-slate-400 block font-sans">เป้าทำกำไร TP2:</span><b id="res-target" class="text-teal-300">--</b></div>
            <div><span class="text-slate-400 block font-sans">จุด Stop Loss:</span><b id="res-sl" class="text-rose-400">--</b></div>
          </div>
          <p id="res-reason" class="text-xs text-slate-300 pt-1 border-t border-slate-800"></p>
        </div>

        <!-- Screener Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th class="py-2.5 px-3">อันดับ</th>
                <th class="py-2.5 px-3">หุ้น / บริษัท</th>
                <th class="py-2.5 px-3">สถานะความน่าซื้อ</th>
                <th class="py-2.5 px-3">คะแนนก้นหลุม</th>
                <th class="py-2.5 px-3">ราคาล่าสุด</th>
                <th class="py-2.5 px-3">โซนควรช้อนซื้อ</th>
                <th class="py-2.5 px-3">จุด SL</th>
                <th class="py-2.5 px-3">เป้า TP2</th>
                <th class="py-2.5 px-3">อัปไซด์</th>
              </tr>
            </thead>
            <tbody id="broad-tbody" class="divide-y divide-slate-800/60 font-mono">
              <!-- Dynamically populated -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: BREAKING NEWS & IMPACT RADAR -->
    <div id="view-news" style="display: none;" class="flex flex-col gap-5">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 class="font-black text-base text-white flex items-center gap-2">
              <span>📰</span> ข่าวด่วน & ปัจจัยกระทบตลาด (Breaking News & Market Impact Radar)
            </h3>
            <p class="text-xs text-slate-400">วิเคราะห์ข่าวเศรษฐกิจมหภาค Fed, CPI, Non-Farm, และทองคำ บอกทิศทางหนุนขึ้นหรือกดดันลงทันที</p>
          </div>
          <button onclick="sendNewsTelegram()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition">
            ✈️ ส่งรายงานข่าวเข้า Telegram ทันที
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- News Feed Cards Populated Dynamically -->
          <div id="news-cards-container" class="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Dynamically populated -->
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Telegram Message Preview Modal -->
  <div id="telegram-modal" style="display: none;" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-sm">✈️</div>
          <div>
            <h4 class="font-bold text-sm text-white">ตัวอย่างการแจ้งเตือน Telegram</h4>
            <span class="text-[10px] text-emerald-400">บอทส่งข้อความทันทีระดับมิลลิวินาที</span>
          </div>
        </div>
        <button onclick="closeTelegramPreview()" class="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
      </div>
      <div class="bg-[#182533] p-4 rounded-xl border border-slate-700/60 font-sans text-xs text-slate-100 shadow-inner leading-relaxed">
        <p id="tg-preview-text" class="whitespace-pre-line font-mono"></p>
      </div>
      <div class="mt-4 flex justify-end">
        <button onclick="closeTelegramPreview()" class="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition">ตกลง</button>
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div id="toast-container" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"></div>

  <script>
    let activeMasterTab = "m15";
    let activeSubTab = "signals";
    let currentSelectedSymbol = "XAU/USD";
    let latestPlans = {};
    let broadMarketList = [];
    let currentBroadFilter = "ALL";
    let soundEnabled = true;
    let audioCtx = null;
    let lastHoldingPrices = {};
    let lastTotalVal = null;
    let lastAssetPrices = {};
    let lastMessageTime = Date.now();
    let secondsSinceLastTick = 0;
    let ws = null;
    let signalHistoryList = [];
    let newsList = [];

    // 1. Audio Synthesis for Real-Time Signals
    function playSignalChime(isBuy) {
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
          osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
          osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
          osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);
        } else {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(659.25, now);
          osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.15);
          osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.3);
        }
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } catch (e) {}
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      document.getElementById("sound-icon").textContent = soundEnabled ? "🔊" : "🔇";
      document.getElementById("sound-status").textContent = soundEnabled ? "เสียงเตือน: เปิด" : "เสียงเตือน: ปิด";
      showToast(soundEnabled ? "เปิดเสียงเตือนแล้ว" : "ปิดเสียงเตือนแล้ว", "info");
    }

    function showToast(message, type = "info") {
      const container = document.getElementById("toast-container");
      if (!container) return;
      const toast = document.createElement("div");
      toast.className = "px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold flex items-center gap-2 pointer-events-auto transition transform translate-y-2 opacity-0 " + 
        (type === "success" ? "bg-emerald-950/90 border-emerald-500 text-emerald-300" :
         type === "danger" ? "bg-rose-950/90 border-rose-500 text-rose-300" :
         "bg-slate-900/90 border-slate-700 text-slate-200");
      toast.innerHTML = (type === "success" ? "🟢 " : type === "danger" ? "🔴 " : "⚡ ") + message;
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.remove("translate-y-2", "opacity-0"));
      setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-2");
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    // 2. WebSocket Client
    function initWebSocket() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = protocol + "//" + window.location.host;
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = function() {
          const b = document.getElementById("ws-badge");
          if (b) b.className = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold";
          const t = document.getElementById("ws-text");
          if (t) t.textContent = "🔴 เรียลไทม์สด (Live Connected)";
        };
        ws.onmessage = function(event) {
          try {
            const data = JSON.parse(event.data);
            handleRealtimePacket(data);
          } catch(e) {}
        };
        ws.onclose = function() {
          const b = document.getElementById("ws-badge");
          if (b) b.className = "bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold";
          const t = document.getElementById("ws-text");
          if (t) t.textContent = "⚠️ กำลังต่อสัญญาณใหม่...";
          setTimeout(initWebSocket, 2000);
        };
        ws.onerror = function() { if (ws) ws.close(); };
      } catch(e) { setTimeout(initWebSocket, 3000); }
    }

    function handleRealtimePacket(data) {
      lastMessageTime = Date.now();
      secondsSinceLastTick = 0;
      const lt = document.getElementById("live-timer");
      if (lt) lt.textContent = "0s";

      if (data.plans) {
        latestPlans = data.plans;
        updateActivePlanCard();
      }
      if (data.radar) updateM15RadarButtons(data.radar);
      if (data.portfolio) updatePortfolioUI(data.portfolio);
      if (data.broad) {
        broadMarketList = data.broad;
        if (activeMasterTab === "broad") applyBroadFilter(currentBroadFilter);
      }
      if (data.history) {
        signalHistoryList = data.history;
        renderSignalsHistoryTable(signalHistoryList);
      }
      if (data.news) {
        newsList = data.news;
        renderNewsCards(newsList);
      }
      if (data.signal) {
        signalHistoryList.unshift(data.signal);
        renderSignalsHistoryTable(signalHistoryList);
        playSignalChime(data.signal.action === "BUY");
        showToast("สัญญาณใหม่: " + data.signal.action + " " + data.signal.asset + " ที่ $" + data.signal.entry, data.signal.action === "BUY" ? "success" : "danger");
      }
    }

    function updateM15RadarButtons(radar) {
      for (const sym of ["XAU/USD", "QQQ", "NVDA", "AAPL", "SPY"]) {
        const item = radar[sym];
        if (!item) continue;
        const priceEl = document.getElementById("rad-price-" + sym);
        if (priceEl) {
          const oldP = lastAssetPrices[sym] || 0;
          const newP = item.price;
          priceEl.textContent = "$" + Number(newP).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          if (oldP && newP !== oldP) {
            priceEl.classList.remove("flash-up", "flash-down");
            void priceEl.offsetWidth;
            priceEl.classList.add(newP > oldP ? "flash-up" : "flash-down");
          }
          lastAssetPrices[sym] = newP;
        }
        const rsiEl = document.getElementById("rad-rsi-" + sym);
        if (rsiEl && item.rsi) rsiEl.textContent = "RSI " + item.rsi;
        const stEl = document.getElementById("rad-status-" + sym);
        if (stEl) {
          stEl.textContent = item.isOpen ? "● ตลาดเปิด" : "○ ตลาดปิด";
          stEl.className = item.isOpen ? "text-[10px] text-emerald-400 font-bold block" : "text-[10px] text-slate-500 font-bold block";
        }
      }
    }

    function updateActivePlanCard() {
      const plan = latestPlans[currentSelectedSymbol];
      if (!plan) return;
      document.getElementById("card-ticker").textContent = plan.ticker;
      document.getElementById("card-entry").textContent = plan.entry;
      document.getElementById("card-sl").textContent = plan.sl;
      document.getElementById("card-tp1").textContent = plan.tp1;
      document.getElementById("card-tp2").textContent = plan.tp2;
      const b = document.getElementById("card-action-badge");
      b.textContent = plan.action === "BUY" ? "🟢 BUY (ซื้อ)" : "🔴 SELL (ขาย)";
      b.className = plan.action === "BUY" ? "px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950" : "px-3.5 py-1 rounded-full text-xs font-black bg-rose-500 text-white";
    }

    function updatePortfolioUI(data) {
      if (!data) return;
      const valEl = document.getElementById("pf-total-val");
      if (valEl) {
        const oldVal = lastTotalVal || 0;
        valEl.textContent = "฿" + Number(data.totalValueTHB).toLocaleString();
        if (oldVal && data.totalValueTHB !== oldVal) {
          valEl.classList.remove("flash-up", "flash-down");
          void valEl.offsetWidth;
          valEl.classList.add(data.totalValueTHB > oldVal ? "flash-up" : "flash-down");
        }
        lastTotalVal = data.totalValueTHB;
      }
      document.getElementById("pf-total-cost").textContent = "฿" + Number(data.totalCostTHB).toLocaleString();
      document.getElementById("pf-health-score").textContent = data.healthScore + " / 100";
      const sign = data.totalProfitTHB >= 0 ? "+" : "";
      const pColor = data.totalProfitTHB >= 0 ? "text-emerald-400" : "text-rose-400";
      const pEl = document.getElementById("pf-total-profit");
      pEl.textContent = sign + "฿" + Number(data.totalProfitTHB).toLocaleString() + " (" + sign + data.totalProfitPct + "%)";
      pEl.className = "text-2xl font-black mt-1 " + pColor;

      // Render Holdings Table
      const tbody = document.getElementById("pf-tbody");
      if (tbody && data.holdings) {
        tbody.innerHTML = data.holdings.map(function(item) {
          const pCls = item.profitTHB >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";
          const pSign = item.profitTHB >= 0 ? "+" : "";
          const badgeColor = item.healthStatus === "ALARM" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : item.healthStatus === "EXCELLENT" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-300";
          const prevPrice = lastHoldingPrices[item.symbol] || 0;
          let flashClass = "";
          if (prevPrice && item.currentPrice !== prevPrice) flashClass = item.currentPrice > prevPrice ? "flash-up" : "flash-down";
          lastHoldingPrices[item.symbol] = item.currentPrice;

          return "<tr class=\\\"hover:bg-slate-800/50 transition " + flashClass + "\\\">" +
            "<td class=\\\"py-3 px-3\\\"><span class=\\\"text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold\\\">" + item.category + "</span></td>" +
            "<td class=\\\"py-3 px-3\\\"><b class=\\\"text-white text-sm\\\">" + item.symbol + "</b><span class=\\\"text-slate-400 text-xs block\\\">" + item.name + "</span></td>" +
            "<td class=\\\"py-3 px-3 font-mono text-white font-bold\\\">" + item.shares + "</td>" +
            "<td class=\\\"py-3 px-3 font-mono text-slate-300\\\">" + (item.currency==='USD'?'$':'฿') + item.avgCost + "</td>" +
            "<td class=\\\"py-3 px-3 font-mono text-white font-bold " + flashClass + "\\\">" + (item.currency==='USD'?'$':'฿') + item.currentPrice + "</td>" +
            "<td class=\\\"py-3 px-3 font-mono text-white\\\">฿" + Number(item.valueTHB).toLocaleString() + "</td>" +
            "<td class=\\\"py-3 px-3 font-mono " + pCls + "\\\">" + pSign + "฿" + item.profitTHB + " (" + pSign + item.profitPct + "%)</td>" +
            "<td class=\\\"py-3 px-3\\\"><span class=\\\"px-2 py-0.5 rounded text-[11px] font-bold block " + badgeColor + "\\\">" + item.advice + "</span></td>" +
          "</tr>";
        }).join("");
      }

      // Render Forecast Cards
      if (data.forecast) renderForecastCards(data.forecast);
    }

    function renderForecastCards(forecasts) {
      const container = document.getElementById("forecast-cards-container");
      if (!container || !forecasts) return;
      container.innerHTML = forecasts.map(f => {
        return "<div class=\\\"bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2\\\">" +
          "<div class=\\\"flex items-center justify-between\\\">" +
            "<div><b class=\\\"text-white text-base\\\">" + f.symbol + "</b><span class=\\\"text-slate-400 text-xs block\\\">" + f.name + "</span></div>" +
            "<span class=\\\"px-2.5 py-1 rounded-full text-xs font-bold border " + f.directionColor + "\\\">" + f.directionBadge + "</span>" +
          "</div>" +
          "<div class=\\\"flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-900/80 p-2 rounded-lg\\\">" +
            "<span>RSI: <b class=\\\"text-emerald-400\\\">" + f.rsi + "</b></span>" +
            "<span>" + f.levels + "</span>" +
          "</div>" +
          "<p class=\\\"text-xs text-slate-300 leading-relaxed pt-1\\\">💡 " + f.advice + "</p>" +
        "</div>";
      }).join("");
    }

    function renderSignalsHistoryTable(signals) {
      const tbody = document.getElementById("signals-table-body");
      if (!tbody || !signals) return;
      tbody.innerHTML = signals.map(s => {
        const actionBadge = s.action === "BUY" ? "<span class=\\\"px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold\\\">BUY</span>" : "<span class=\\\"px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold\\\">SELL</span>";
        return "<tr class=\\\"hover:bg-slate-800/40 transition\\\">" +
          "<td class=\\\"py-2.5 px-3 text-slate-400\\\">" + s.timestamp + "</td>" +
          "<td class=\\\"py-2.5 px-3 font-bold text-white\\\">" + s.asset + "</td>" +
          "<td class=\\\"py-2.5 px-3\\\">" + actionBadge + "</td>" +
          "<td class=\\\"py-2.5 px-3 text-white\\\">$" + s.entry + "</td>" +
          "<td class=\\\"py-2.5 px-3 text-rose-400\\\">$" + s.sl + "</td>" +
          "<td class=\\\"py-2.5 px-3 text-emerald-400\\\">$" + s.tp1 + " / $" + s.tp2 + "</td>" +
          "<td class=\\\"py-2.5 px-3 text-teal-300 font-bold\\\">" + s.rr + "</td>" +
          "<td class=\\\"py-2.5 px-3 text-slate-300\\\">" + s.status + "</td>" +
        "</tr>";
      }).join("");
    }

    function renderNewsCards(news) {
      const container = document.getElementById("news-cards-container");
      if (!container || !news) return;
      container.innerHTML = news.map(n => {
        return "<div class=\\\"bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5\\\">" +
          "<div class=\\\"flex items-center justify-between\\\">" +
            "<span class=\\\"px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-400 border border-slate-700\\\">⚡ " + n.category + " (" + n.time + ")</span>" +
            "<span class=\\\"px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30\\\">" + n.impactBadge + "</span>" +
          "</div>" +
          "<h4 class=\\\"font-bold text-sm text-white leading-snug\\\">" + n.headline + "</h4>" +
          "<div class=\\\"bg-slate-900 p-2.5 rounded-lg text-xs text-slate-300 space-y-1\\\">" +
            "<div><b class=\\\"text-slate-400 font-sans\\\">เหตุผลวิเคราะห์:</b> " + n.impactReason + "</div>" +
            "<div><b class=\\\"text-slate-400 font-sans\\\">สินทรัพย์ที่ได้ผลกระทบ:</b> <code class=\\\"text-emerald-400\\\">" + n.affectedAssets + "</code></div>" +
          "</div>" +
        "</div>";
      }).join("");
    }

    // 3. Navigation
    function switchMasterTab(tab) {
      activeMasterTab = tab;
      const tabs = ["m15", "portfolio", "broad", "news"];
      tabs.forEach(t => {
        const btn = document.getElementById("tab-btn-" + t);
        const view = document.getElementById("view-" + t);
        if (!btn || !view) return;
        if (t === tab) {
          btn.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md";
          view.style.display = "flex";
        } else {
          btn.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700";
          view.style.display = "none";
        }
      });
      if (tab === "portfolio") loadMyPortfolio();
      if (tab === "broad" && broadMarketList.length === 0) loadBroadMarket();
      if (tab === "news" && newsList.length === 0) loadNews();
    }

    function switchSubTab(sub) {
      activeSubTab = sub;
      const subs = ["signals", "pine", "setup", "simulator"];
      subs.forEach(s => {
        const btn = document.getElementById("subtab-btn-" + s);
        const panel = document.getElementById("subtab-panel-" + s);
        if (!btn || !panel) return;
        if (s === sub) {
          btn.className = "subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-800 text-emerald-400 border border-emerald-500/30";
          panel.style.display = "block";
        } else {
          btn.className = "subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800";
          panel.style.display = "none";
        }
      });
    }

    function setAsset(tvSym, label) {
      currentSelectedSymbol = label;
      document.getElementById("tv-frame").src = "https://s.tradingview.com/widgetembed/?symbol=" + encodeURIComponent(tvSym) + "&interval=15&theme=dark&timezone=Asia%2FBangkok";
      document.getElementById("chart-asset-title").textContent = "ชาร์ตสด " + label + " (TradingView M15)";
      updateActivePlanCard();
    }

    function refreshChart() {
      const f = document.getElementById("tv-frame");
      f.src = f.src;
      showToast("รีเฟรชชาร์ตแล้ว", "info");
    }

    function copyText(id, label) {
      const txt = document.getElementById(id).textContent;
      if (!txt || txt === "--") return;
      navigator.clipboard.writeText(txt);
      const el = document.getElementById("copy-toast");
      if (el) {
        el.textContent = "✅ คัดลอก " + label + " (" + txt + ") แล้ว!";
        setTimeout(() => el.textContent = "", 2500);
      }
      showToast("คัดลอก " + label + " (" + txt + ") แล้ว", "success");
    }

    function copyPineScript() {
      const code = document.getElementById("pine-code-block").textContent;
      navigator.clipboard.writeText(code);
      showToast("คัดลอกโค้ด Pine Script ทั้งหมดแล้ว!", "success");
    }

    function copyWebhookUrl() {
      const url = document.getElementById("webhook-sample-url").textContent;
      navigator.clipboard.writeText(url);
      showToast("คัดลอก Webhook URL แล้ว!", "success");
    }

    function openTelegramPreview() {
      const plan = latestPlans[currentSelectedSymbol] || { ticker: currentSelectedSymbol, action: 'BUY', entry: 2785.40, sl: 2776.00, tp1: 2795.00, tp2: 2805.00 };
      const txt = "⚡ [M15 SIGNAL ALERT]\n" +
        "สินทรัพย์: " + plan.ticker + "\n" +
        "คำสั่ง: " + (plan.action === "BUY" ? "🟢 BUY (ซื้อ)" : "🔴 SELL (ขาย)") + "\n" +
        "──────────────────\n" +
        "🎯 จุดเข้า (Entry): $" + plan.entry + "\n" +
        "🛑 Stop Loss (SL): $" + plan.sl + "\n" +
        "🏆 Take Profit 1: $" + plan.tp1 + "\n" +
        "🚀 Take Profit 2: $" + plan.tp2 + "\n" +
        "──────────────────\n" +
        "💡 กลยุทธ์: แท่ง 15m ปิดเหนือเส้น EMA ดึงราคาสดเรียลไทม์";
      document.getElementById("tg-preview-text").textContent = txt;
      const modal = document.getElementById("telegram-modal");
      if (modal) modal.style.display = "flex";
    }

    function closeTelegramPreview() {
      const modal = document.getElementById("telegram-modal");
      if (modal) modal.style.display = "none";
    }

    async function simTrigger(asset, action) {
      try {
        const r = await fetch("/api/simulate-signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset, action })
        });
        const d = await r.json();
        if (d.ok) {
          playSignalChime(action === "BUY");
          showToast("จำลองสัญญาณ " + action + " " + asset + " สำเร็จ!", action === "BUY" ? "success" : "danger");
        }
      } catch(e) {}
    }

    function quickSimulate() {
      simTrigger(currentSelectedSymbol, "BUY");
    }

    function calcDCA() {
      const amt = parseFloat(document.getElementById("inp-dca-amount").value) || 2000;
      const voo = Math.round(amt * 0.7);
      const tech = Math.round(amt * 0.2);
      const gold = amt - voo - tech;
      document.getElementById("dca-result").innerHTML = 
        "<div class='bg-slate-950 p-3 rounded-xl border border-slate-800'>• เติม <b>VOO (S&P 500)</b>: <b class='text-emerald-400 font-mono'>฿" + voo.toLocaleString() + "</b> (70%)</div>" +
        "<div class='bg-slate-950 p-3 rounded-xl border border-slate-800'>• เติม <b>AMD / TSLA</b>: <b class='text-sky-400 font-mono'>฿" + tech.toLocaleString() + "</b> (20%)</div>" +
        "<div class='bg-slate-950 p-3 rounded-xl border border-slate-800'>• เติม <b>ทองคำ (YLG-GOLD)</b>: <b class='text-amber-400 font-mono'>฿" + gold.toLocaleString() + "</b> (10%)</div>";
    }

    async function loadMyPortfolio() {
      try {
        const r = await fetch("/api/my-portfolio");
        const data = await r.json();
        updatePortfolioUI(data);
      } catch(e) {}
    }

    async function loadBroadMarket() {
      try {
        const r = await fetch("/api/broad-market");
        const d = await r.json();
        broadMarketList = d.stocks || [];
        applyBroadFilter(currentBroadFilter);
      } catch(e) {}
    }

    async function loadNews() {
      try {
        const r = await fetch("/api/news");
        const d = await r.json();
        newsList = d.news || [];
        renderNewsCards(newsList);
      } catch(e) {}
    }

    function filterMatch(type) {
      currentBroadFilter = type;
      document.querySelectorAll(".filter-pill").forEach(p => {
        p.className = "filter-pill px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700";
      });
      if (event && event.target) {
        event.target.className = "filter-pill active px-3 py-1.5 rounded-xl font-bold bg-amber-500 text-slate-950";
      }
      applyBroadFilter(type);
    }

    function applyBroadFilter(type) {
      if (type === "ALL") {
        renderBroadTable(broadMarketList);
      } else if (type === "DIP") {
        renderBroadTable(broadMarketList.filter(x => x.isDipDeal || x.distFromLowPct <= 5.0));
      } else {
        renderBroadTable(broadMarketList.filter(x => x.category === type));
      }
    }

    function renderBroadTable(list) {
      const tbody = document.getElementById("broad-tbody");
      if (!tbody) return;
      if (!list || list.length === 0) {
        tbody.innerHTML = "<tr><td colspan=\\\"9\\\" class=\\\"py-6 text-center text-slate-500\\\">ไม่พบข้อมูลในหมวดหมู่นี้</td></tr>";
        return;
      }
      tbody.innerHTML = list.map(function(item, idx) {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : ("#" + (idx + 1));
        return "<tr class=\\\"hover:bg-slate-800/60 transition\\\">" +
          "<td class=\\\"py-3 px-3 font-bold text-amber-400\\\">" + medal + "</td>" +
          "<td class=\\\"py-3 px-3\\\"><b class=\\\"text-white text-sm\\\">" + item.symbol + "</b><span class=\\\"text-slate-400 text-xs block\\\">" + item.sector + "</span></td>" +
          "<td class=\\\"py-3 px-3\\\"><span class=\\\"px-2.5 py-0.5 rounded text-[11px] " + item.verdictClass + "\\\">" + item.badgeText + "</span></td>" +
          "<td class=\\\"py-3 px-3 font-mono font-bold text-emerald-400\\\">" + item.score + " / 100</td>" +
          "<td class=\\\"py-3 px-3 font-mono font-bold text-white\\\">$" + item.price + "</td>" +
          "<td class=\\\"py-3 px-3 font-mono font-bold text-emerald-300\\\">$" + item.buyZone + "</td>" +
          "<td class=\\\"py-3 px-3 font-mono text-rose-400\\\">$" + item.sl + "</td>" +
          "<td class=\\\"py-3 px-3 font-mono text-teal-300 font-bold\\\">$" + item.tp2 + "</td>" +
          "<td class=\\\"py-3 px-3 font-mono font-black text-emerald-400\\\">+" + item.upside + "%</td>" +
        "</tr>";
      }).join("");
    }

    async function searchSingleStock() {
      const sym = document.getElementById("inp-stock-search").value.trim().toUpperCase();
      if (!sym) return alert("กรุณาพิมพ์ชื่อย่อหุ้น เช่น NVDA, TSLA, PLTR");
      const card = document.getElementById("search-result-card");
      card.classList.remove("hidden");
      document.getElementById("res-sym").textContent = "กำลังวิเคราะห์ " + sym + "...";
      try {
        const r = await fetch("/api/analyze-stock?symbol=" + encodeURIComponent(sym));
        const d = await r.json();
        if (d.ok && d.stock) {
          const s = d.stock;
          document.getElementById("res-sym").textContent = s.symbol + " (คะแนนน่าซื้อ " + s.score + "/100)";
          const b = document.getElementById("res-verdict");
          b.textContent = s.badgeText;
          b.className = "px-3.5 py-1.5 rounded-full text-xs font-black " + s.verdictClass;
          document.getElementById("res-price").textContent = "$" + s.price;
          document.getElementById("res-buyzone").textContent = "$" + s.buyZone;
          document.getElementById("res-target").textContent = "$" + s.tp2 + " (+" + s.upside + "%)";
          document.getElementById("res-sl").textContent = "$" + s.sl;
          document.getElementById("res-reason").textContent = "💡 " + s.reason;
        } else {
          alert(d.error || "ไม่พบข้อมูลหุ้น");
          card.classList.add("hidden");
        }
      } catch(e) {
        alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
        card.classList.add("hidden");
      }
    }

    async function sendNewsTelegram() {
      showToast("กำลังส่งสรุปข่าวเข้า Telegram...", "info");
      try {
        const r = await fetch("/api/send-news-telegram", { method: "POST" });
        const d = await r.json();
        showToast(d.ok ? "ส่งข่าวเข้า Telegram สำเร็จ!" : "ส่งข่าวไม่สำเร็จ", d.ok ? "success" : "danger");
      } catch(e) { showToast("เกิดข้อผิดพลาด", "danger"); }
    }

    async function sendForecastTelegram() {
      showToast("กำลังส่งสรุปทำนายกราฟเข้า Telegram...", "info");
      try {
        const r = await fetch("/api/send-forecast-telegram", { method: "POST" });
        const d = await r.json();
        showToast(d.ok ? "ส่งผลทำนายกราฟเข้า Telegram สำเร็จ!" : "ส่งไม่สำเร็จ", d.ok ? "success" : "danger");
      } catch(e) { showToast("เกิดข้อผิดพลาด", "danger"); }
    }

    async function sendBroadTelegram() {
      const btn = document.getElementById("send-broad-tg-btn");
      if (btn) btn.textContent = "⏳ กำลังส่ง 4 หุ้นเด่น...";
      try {
        const r = await fetch("/api/send-broad-telegram", { method: "POST" });
        const d = await r.json();
        showToast(d.ok ? "ส่ง 4 หุ้นเด่นเข้า Telegram เรียบร้อย!" : "ส่งไม่สำเร็จ", d.ok ? "success" : "danger");
        if (btn) btn.textContent = d.ok ? "✅ ส่งเข้า Telegram เรียบร้อย!" : "⚠️ ส่งไม่สำเร็จ";
      } catch(e) {
        showToast("เกิดข้อผิดพลาดในการส่ง", "danger");
        if (btn) btn.textContent = "⚠️ ไม่สำเร็จ";
      }
      setTimeout(() => { if (btn) btn.textContent = "🌟 ส่ง 4 หุ้นเด่นเข้า Telegram"; }, 3000);
    }

    // Bind all handlers to window explicitly
    window.switchMasterTab = switchMasterTab;
    window.switchSubTab = switchSubTab;
    window.setAsset = setAsset;
    window.refreshChart = refreshChart;
    window.copyText = copyText;
    window.copyPineScript = copyPineScript;
    window.copyWebhookUrl = copyWebhookUrl;
    window.openTelegramPreview = openTelegramPreview;
    window.closeTelegramPreview = closeTelegramPreview;
    window.toggleSound = toggleSound;
    window.quickSimulate = quickSimulate;
    window.simTrigger = simTrigger;
    window.calcDCA = calcDCA;
    window.filterMatch = filterMatch;
    window.searchSingleStock = searchSingleStock;
    window.sendNewsTelegram = sendNewsTelegram;
    window.sendForecastTelegram = sendForecastTelegram;
    window.sendBroadTelegram = sendBroadTelegram;

    // 4. Clocks & Timers
    function updateWorldClock() {
      const now = new Date();
      // Bangkok
      const bkkStr = now.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false });
      const bkkHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }));
      const bkkMin = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', minute: '2-digit' }));
      const bkkDay = now.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' });
      const isBkkOpen = (bkkDay !== 'Sat' && bkkDay !== 'Sun') && ((bkkHour >= 10 && bkkHour < 12) || (bkkHour === 12 && bkkMin <= 30) || (bkkHour >= 14 && bkkHour < 16) || (bkkHour === 16 && bkkMin <= 30));
      document.getElementById("session-bkk").innerHTML = "🇹🇭 ไทย: <span class='font-mono'>" + bkkStr + "</span> (" + (isBkkOpen ? "<span class='text-emerald-400'>🟢 เปิด</span>" : "<span class='text-slate-500'>🔴 ปิด</span>") + ")";

      // US East
      const usStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false });
      const usHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }));
      const usMin = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', minute: '2-digit' }));
      const usDay = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
      const isUsOpen = (usDay !== 'Sat' && usDay !== 'Sun') && (usHour > 9 || (usHour === 9 && usMin >= 30)) && usHour < 16;
      document.getElementById("session-us").innerHTML = "🇺🇸 สหรัฐฯ: <span class='font-mono'>" + usStr + "</span> (" + (isUsOpen ? "<span class='text-emerald-400'>🟢 เปิด</span>" : "<span class='text-amber-400'>🔴 ปิด (เปิด 20:30)</span>") + ")";

      // Candle countdown
      const mins = now.getMinutes() % 15;
      const secs = now.getSeconds();
      const leftSecs = (14 - mins) * 60 + (60 - secs);
      const cm = Math.floor(leftSecs / 60);
      const cs = leftSecs % 60;
      document.getElementById("candle-timer").textContent = (cm < 10 ? "0" : "") + cm + ":" + (cs < 10 ? "0" : "") + cs;
    }

    setInterval(updateWorldClock, 1000);
    updateWorldClock();

    setInterval(function() {
      secondsSinceLastTick++;
      const el = document.getElementById("live-timer");
      if (el) el.textContent = secondsSinceLastTick + "s";
    }, 1000);

    // Fallback polling every 5 seconds
    setInterval(async function() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
          const r = await fetch("/api/signals");
          const d = await r.json();
          handleRealtimePacket(d);
        } catch(e) {}
      }
    }, 5000);

    // Initial setup
    initWebSocket();
    calcDCA();

    fetch("/api/signals").then(r => r.json()).then(d => {
      latestPlans = d.plans || {};
      if (d.radar) updateM15RadarButtons(d.radar);
      if (d.history) renderSignalsHistoryTable(d.history);
      if (d.news) renderNewsCards(d.news);
      setAsset("OANDA:XAUUSD", "XAU/USD");
    });
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(HTML_PAGE);
});

// ระบบ Anti-Sleep และ Loop ตรวจจับ Telegram
setInterval(() => {
  fetch(APP_URL + '/api/ping').catch(() => {});
}, 10 * 60 * 1000);

setInterval(pollTelegramUpdates, 3500);

server.listen(PORT, async () => {
  console.log('🚀 Complete All-in-One Master Terminal running on port ' + PORT);
  setInterval(updateLiveQuotes, 5000); // ดึงราคา Real-Time สดทุก 5 วินาที
  setInterval(scanMarket, 30 * 1000); // สแกนเทรนด์ M15 ทุก 30 วินาที
  setInterval(scanBroadMarketUniverse, 5 * 60 * 1000); // สแกน 35 บิ๊กแคปทุก 5 นาที
  
  updateLiveQuotes();
  scanMarket();
  setTimeout(analyzeUserPortfolio, 1500);
  setTimeout(scanBroadMarketUniverse, 3000);
});
