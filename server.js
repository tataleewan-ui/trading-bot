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

// 1) สินทรัพย์สำหรับ M15 Day Trade
const M15_SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL', 'SPY'];

// 2) ข้อมูลพอร์ตจริงของผู้ใช้ (Default Portfolio จากแอป Dime!)
let userHoldings = [
  // พอร์ตหุ้นหลัก
  { id: 'voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'US_ETF', shares: 0.0470292, avgCostUSD: 655.55, category: 'หุ้นหลัก', currency: 'USD' },
  { id: 'ttb', symbol: 'TTB', name: 'ธนาคารทหารไทยธนชาต', type: 'TH_STOCK', shares: 162, avgCostTHB: 1.9222, category: 'หุ้นหลัก', currency: 'THB' },
  { id: 'amd', symbol: 'AMD', name: 'Advanced Micro Devices', type: 'US_STOCK', shares: 0.0150027, avgCostUSD: 537.2349, category: 'หุ้นหลัก', currency: 'USD' },

  // พอร์ตถือยาว
  { id: 'scbt70x', symbol: 'SCBT70X(26A)', name: 'กองทุน SCB ตราสารหนี้/ผสม', type: 'FUND', shares: 197.1798, avgCostTHB: 11.9506, category: 'ถือยาว', currency: 'THB' },
  { id: 'gold', symbol: 'YLG-GOLD', name: 'ออมทองคำแท่ง (YLG Gold)', type: 'COMMODITY', shares: 0.001423, avgCostUSD: 4223.25, category: 'ถือยาว', currency: 'USD' },
  { id: 'xlv', symbol: 'XLV', name: 'Health Care Select Sector SPDR', type: 'US_ETF', shares: 0.0293492, avgCostUSD: 159.1185, category: 'ถือยาว', currency: 'USD' },
  { id: 'vt', symbol: 'VT', name: 'Vanguard Total World Stock ETF', type: 'US_ETF', shares: 0.0299761, avgCostUSD: 154.79, category: 'ถือยาว', currency: 'USD' },

  // พอร์ตรอขาย
  { id: 'scbtb', symbol: 'SCBTB(Thai ESGA)', name: 'กองทุนหุ้นไทย ESG', type: 'FUND', shares: 234.2616, avgCostTHB: 10.8870, category: 'รอขาย', currency: 'THB' },
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla Inc', type: 'US_STOCK', shares: 0.0192567, avgCostUSD: 395.1880, category: 'รอขาย', currency: 'USD' },
  { id: 'bidu', symbol: 'BIDU', name: 'Baidu Inc ADR (หุ้นเทคจีน)', type: 'US_STOCK', shares: 0.0462888, avgCostUSD: 110.61, category: 'รอขาย', currency: 'USD' },
  { id: 'xom', symbol: 'XOM', name: 'Exxon Mobil Corp', type: 'US_STOCK', shares: 0.0299, avgCostUSD: 100.26, category: 'รอขาย', currency: 'USD' }
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

app.use(cors());
app.use(express.json());

let signalHistory = [];
let sentCandlesCache = {};
let lastAlertTimestampPerTicker = {};
let marketRadar = {};
let latestPlanBySymbol = {};
let lastScanTime = null;
let telegramEnabled = true;

// ==========================================
// 1. ตรวจสอบเวลาตลาดเปิด-ปิดจริง
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

  // หุ้นไทย (TTB) เปิด จันทร์-ศุกร์ 10:00 - 16:30 น.
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
  return { isOpen: false, badgeText: '⏸️ ตลาดปิด' };
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
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let ag = gains / period;
  let al = losses / period;
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

async function sendTelegramMessage(text, force = false) {
  if (!telegramEnabled && !force) return false;
  const targetChatId = await resolveTelegramChatId();
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
// 4. ดึงราคา Real-Time และข้อมูลรายวัน
// ==========================================
async function fetchLivePrice(yahooTicker) {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooTicker) + '?interval=1d&range=5d';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
    if (meta) {
      return Number((meta.regularMarketPrice || meta.chartPreviousClose).toFixed(2));
    }
  } catch (e) {
    console.warn('Live price error for ' + yahooTicker, e.message);
  }
  return null;
}

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
    } catch (e) {
      console.warn('Binance gold klines error:', e.message);
    }
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
  } catch (e) {
    console.warn('Yahoo fetch M15 error:', e.message);
  }
  return [];
}

// ==========================================
// 5. ระบบวิเคราะห์และตรวจสุขภาพพอร์ตจริง (AI Portfolio Doctor)
// ==========================================
async function analyzeUserPortfolio() {
  const USD_TO_THB = 33.42;
  let diagnosedList = [];
  let totalValueTHB = 0;
  let totalCostTHB = 0;

  for (let item of userHoldings) {
    let currentPrice = item.currency === 'USD' ? item.avgCostUSD : item.avgCostTHB;
    const yahooSym = YAHOO_MAP[item.symbol];

    if (item.symbol === 'YLG-GOLD') {
      try {
        const bPrice = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT').then(r => r.json());
        if (bPrice && bPrice.price) currentPrice = parseFloat(bPrice.price);
      } catch (e) {}
    } else if (yahooSym) {
      const p = await fetchLivePrice(yahooSym);
      if (p) currentPrice = p;
    }

    let valueTHB = 0;
    let costTHB = 0;
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

    // ระบบวินิจฉัยสุขภาพหุ้นรายตัว (Health Diagnosis & Action Verdict)
    let healthStatus = 'GOOD';
    let actionVerdict = 'HOLD';
    let diagnosis = '';
    let advice = '';

    if (item.symbol === 'BIDU') {
      healthStatus = 'ALARM';
      actionVerdict = 'CONSIDER_CUT';
      diagnosis = '🚨 หุ้นน่าเป็นห่วงที่สุดในพอร์ต! ขาดทุน -22% และเทรนด์เทคโนโลยีจีนอ่อนแรง';
      advice = 'แนะนำทยอย Cut Loss หรือเปลี่ยนเงินไปสมทบ VOO เพื่อไม่ให้เงินจม';
    } else if (item.symbol === 'VOO' || item.symbol === 'VT') {
      healthStatus = 'EXCELLENT';
      actionVerdict = 'BUY_MORE';
      diagnosis = '⭐ เสาหลักที่ดีที่สุดของพอร์ต เติบโตตามดัชนีหุ้นโลกและสหรัฐฯ';
      advice = 'วันนี้ตัวนี้น่าซื้อสะสม (DCA) เพิ่มที่สุด ควรถือให้เป็น 50%+ ของพอร์ต';
    } else if (item.symbol === 'TTB') {
      healthStatus = 'EXCELLENT';
      actionVerdict = 'HOLD_DIVIDEND';
      diagnosis = '🏆 กำไรสูงสุดในพอร์ต (+48%) รับเงินปันผลสม่ำเสมอ';
      advice = 'ถือรับปันผลต่อไปได้สบายๆ แต่ไม่ต้องเพิ่มน้ำหนักมากเกินไป';
    } else if (item.symbol === 'AMD') {
      healthStatus = 'GOOD';
      actionVerdict = 'HOLD_GROWTH';
      diagnosis = '🟢 กำไรเติบโตดี (+13%) ได้รับอานิสงส์จากกระแส AI & ชิป';
      advice = 'ถือรันเทรนด์ต่อได้ หากย่อตัวลงมาใกล้ทุนสามารถซื้อเพิ่มได้';
    } else if (item.symbol === 'TSLA') {
      healthStatus = 'WATCH';
      actionVerdict = 'WAIT_REBOUND';
      diagnosis = '⚠️ ย่อตัวติดลบเล็กน้อย (-3%) ความผันผวนสูง';
      advice = 'อยู่ในพอร์ตรอขาย ถ้าราคาดีดตัวกลับมาบวกแนะนำแบ่งปิดกำไรตามแผน';
    } else if (item.symbol.includes('SCBTB')) {
      healthStatus = 'WATCH';
      actionVerdict = 'HOLD_OR_SWITCH';
      diagnosis = '⚠️ กองทุนหุ้นไทย ESG ขาดทุน -4.8% ผลตอบแทนโตช้ากว่าหุ้นสหรัฐฯ';
      advice = 'หากเด้งขึ้นมาเท่าทุน พิจารณาย้ายเงินไปใส่ VOO หรือ VT จะโตไวกว่า';
    } else {
      healthStatus = 'NEUTRAL';
      actionVerdict = 'HOLD';
      diagnosis = '⚪ พอร์ตกระจายความเสี่ยง (กองทุนตราสารหนี้ & ทองคำ)';
      advice = 'ถือเป็นเกราะป้องกันความเสี่ยงของพอร์ตโดยรวม';
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
      diagnosis: diagnosis,
      advice: advice
    });
  }

  const totalProfitTHB = totalValueTHB - totalCostTHB;
  const totalProfitPct = totalCostTHB > 0 ? (totalProfitTHB / totalCostTHB) * 100 : 0;

  return {
    totalValueTHB: Number(totalValueTHB.toFixed(2)),
    totalCostTHB: Number(totalCostTHB.toFixed(2)),
    totalProfitTHB: Number(totalProfitTHB.toFixed(2)),
    totalProfitPct: Number(totalProfitPct.toFixed(2)),
    holdings: diagnosedList,
    updatedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  };
}

// ==========================================
// 6. ลูปสแกน M15 ประจำ
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
    } catch (e) {
      console.error('Scan error:', sym, e.message);
    }
  }

  lastScanTime = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
  broadcast({
    type: 'RADAR_UPDATE',
    radar: marketRadar,
    plans: latestPlanBySymbol,
    lastScanTime: lastScanTime
  });
}

// ==========================================
// 7. API Endpoints
// ==========================================
app.get('/api/signals', (req, res) => res.json({
  signals: signalHistory,
  radar: marketRadar,
  plans: latestPlanBySymbol,
  telegramEnabled: telegramEnabled,
  lastScanTime: lastScanTime
}));

// API พอร์ตของคุณ (ดึงข้อมูลวิเคราะห์สุขภาพพอร์ต)
app.get('/api/my-portfolio', async (req, res) => {
  const analysis = await analyzeUserPortfolio();
  res.json(analysis);
});

// API อัปเดต/เพิ่มจำนวนหุ้นเมื่อซื้อเพิ่ม
app.post('/api/update-holding', async (req, res) => {
  const { symbol, newShares, newAvgCost, category } = req.body;
  if (!symbol || newShares == null) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
  }

  const existing = userHoldings.find(h => h.symbol.toUpperCase() === symbol.toUpperCase());
  if (existing) {
    existing.shares = parseFloat(newShares);
    if (newAvgCost != null && parseFloat(newAvgCost) > 0) {
      if (existing.currency === 'USD') existing.avgCostUSD = parseFloat(newAvgCost);
      else existing.avgCostTHB = parseFloat(newAvgCost);
    }
    if (category) existing.category = category;
  } else {
    // เพิ่มหุ้นตัวใหม่
    userHoldings.push({
      id: 'h_' + Date.now(),
      symbol: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      type: 'CUSTOM',
      shares: parseFloat(newShares),
      avgCostUSD: parseFloat(newAvgCost) || 100,
      category: category || 'หุ้นหลัก',
      currency: 'USD'
    });
  }

  const updatedAnalysis = await analyzeUserPortfolio();
  broadcast({ type: 'PORTFOLIO_UPDATED', portfolio: updatedAnalysis });
  res.json({ ok: true, portfolio: updatedAnalysis });
});

// ส่งรายงานสรุปสุขภาพพอร์ตเข้า Telegram
app.post('/api/send-portfolio-telegram', async (req, res) => {
  const data = await analyzeUserPortfolio();
  let msg = '📊 <b>รายงานตรวจสุขภาพพอร์ตของคุณ (Dime Portfolio Doctor)</b>\n';
  msg += 'มูลค่าพอร์ตรวม: <b>฿' + data.totalValueTHB.toLocaleString() + '</b> (' + (data.totalProfitPct >= 0 ? '+' : '') + data.totalProfitPct + '%)\n';
  msg += '──────────────────\n';
  msg += '⭐ <b>ตัวที่ควรซื้อสะสม (BUY):</b> <code>VOO</code> (เสาหลักโตสม่ำเสมอ)\n';
  msg += '🚨 <b>ตัวที่น่าเป็นห่วงที่สุด:</b> <code>BIDU</code> (ขาดทุน -22% แนะนำ Cut Loss/สลับตัว)\n';
  msg += '🏆 <b>ตัวที่ทำกำไรสูงสุด:</b> <code>TTB</code> (+48.8% ถือรับปันผล)\n';
  msg += '💡 <b>คำแนะนำวันนี้:</b> เน้นเติมเงินเข้า VOO และลดการกระจายตัวเล็กๆ ลง\n';
  msg += '──────────────────\n';

  const ok = await sendTelegramMessage(msg, true);
  res.json({ ok: ok });
});

app.post('/api/test-telegram', async (req, res) => {
  const sym = (req.body && req.body.symbol) || 'XAU/USD';
  const target = latestPlanBySymbol[sym] || signalHistory[0];
  let ok = false;
  if (target) {
    const isBuy = target.action === 'BUY';
    const text =
      (isBuy ? '🟢' : '🔴') + ' <b>แผนจุดเข้า M15: ' + target.ticker + '</b>\n' +
      '💵 ราคาเข้า: <code>' + target.entry + '</code> | 🛑 SL: <code>' + target.sl + '</code> | 🎯 TP: <code>' + target.tp1 + '</code>';
    ok = await sendTelegramMessage(text, true);
  }
  res.json({ ok: ok });
});

app.get('/api/ping', (req, res) => res.send('pong'));

// ==========================================
// 8. หน้าเว็บ Pro Terminal พร้อมระบบจัดการพอร์ตของคุณ
// ==========================================
const HTML_PAGE = [
  '<!DOCTYPE html>',
  '<html lang="th" class="dark">',
  '<head>',
  '  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '  <title>M15 Pro Terminal & Personal Portfolio Doctor</title>',
  '  <script src="https://cdn.tailwindcss.com"></script>',
  '  <style>',
  '    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap");',
  '    body { font-family: "Inter", sans-serif; background-color: #070a12; color: #f1f5f9; }',
  '    .copy-card { cursor: pointer; transition: all 0.15s ease; }',
  '    .copy-card:hover { transform: translateY(-2px); border-color: #38bdf8; }',
  '  </style>',
  '</head>',
  '<body class="min-h-screen flex flex-col">',
  '  <header class="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50 px-4 py-3">',
  '    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">',
  '      <div class="flex items-center gap-3">',
  '        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-emerald-500 flex items-center justify-center font-black text-white text-xl shadow-lg">💼</div>',
  '        <div>',
  '          <div class="flex items-center gap-2">',
  '            <h1 class="font-bold text-base text-white">ระบบเทรด & ตรวจสุขภาพพอร์ตของคุณ</h1>',
  '            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">DIME PORTFOLIO DOCTOR</span>',
  '          </div>',
  '          <p class="text-xs text-slate-400">วิเคราะห์หุ้นที่คุณถือจริง แนะนำจุดซื้อ/ขาย และฟอร์มบันทึกจำนวนหุ้น</p>',
  '        </div>',
  '      </div>',
  '      <div class="flex items-center flex-wrap gap-2 text-xs">',
  '        <button id="send-pf-tg-btn" class="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-lg shadow transition">',
  '          📲 ส่งสรุปสุขภาพพอร์ตเข้า Telegram',
  '        </button>',
  '      </div>',
  '    </div>',
  '  </header>',
  '',
  '  <main class="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col gap-5">',
  '    <!-- Tab Switcher -->',
  '    <div class="flex items-center gap-2 border-b border-slate-800 pb-3">',
  '      <button id="tab-btn-portfolio" onclick="switchTab(\'portfolio\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-purple-600 text-white shadow-md">',
  '        💼 พอร์ตหุ้นของคุณ & คำแนะนำ (My Portfolio Doctor)',
  '      </button>',
  '      <button id="tab-btn-m15" onclick="switchTab(\'m15\')" class="px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700">',
  '        ⚡ หน้าเทรดทองคำ & หุ้นแท่ง 15 นาที (M15 Terminal)',
  '      </button>',
  '    </div>',
  '',
  '    <!-- TAB 1: PERSONAL PORTFOLIO DOCTOR (พอร์ตหุ้นจริงของคุณ) -->',
  '    <div id="view-portfolio" class="flex flex-col gap-5">',
  '      <!-- Portfolio Overview Cards -->',
  '      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">',
  '        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">',
  '          <span class="text-xs text-slate-400 block">มูลค่าพอร์ตรวม (THB)</span>',
  '          <p id="pf-total-val" class="text-2xl font-black text-white mt-1">฿--</p>',
  '          <span class="text-[11px] text-slate-400">ต้นทุน: <span id="pf-total-cost">฿--</span></span>',
  '        </div>',
  '        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">',
  '          <span class="text-xs text-slate-400 block">กำไร/ขาดทุนรวม</span>',
  '          <p id="pf-total-profit" class="text-2xl font-black text-emerald-400 mt-1">--</p>',
  '          <span class="text-[11px] text-slate-400">ผลตอบแทนรวมทั้งพอร์ต</span>',
  '        </div>',
  '        <div class="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-4">',
  '          <span class="text-xs text-rose-300 font-bold block">🚨 หุ้นที่น่าเป็นห่วงที่สุด</span>',
  '          <p class="text-xl font-black text-rose-400 mt-1">BIDU (-22.8%)</p>',
  '          <span class="text-[11px] text-rose-300/80">เทคจีนติดลบหนัก แนะนำลดความเสี่ยง</span>',
  '        </div>',
  '        <div class="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-4">',
  '          <span class="text-xs text-emerald-300 font-bold block">⭐ วันนี้ควรซื้อเพิ่มตัวไหน?</span>',
  '          <p class="text-xl font-black text-emerald-400 mt-1">VOO (S&P 500)</p>',
  '          <span class="text-[11px] text-emerald-300/80">เสาหลักพอร์ต เติบโตแข็งแกร่งที่สุด</span>',
  '        </div>',
  '      </div>',
  '',
  '      <!-- Form: Add or Update Holdings (ระบบใส่จำนวนหุ้นเพิ่มเมื่อซื้อ) -->',
  '      <div class="bg-slate-900 border-2 border-purple-500/40 rounded-2xl p-4 shadow-xl">',
  '        <div class="flex items-center justify-between mb-2">',
  '          <h3 class="font-bold text-sm text-purple-300 flex items-center gap-2">',
  '            <span>➕</span> บันทึกจำนวนหุ้นเพิ่มเมื่อซื้อใหม่ (Update Holdings)',
  '          </h3>',
  '          <span class="text-[11px] text-slate-400">บันทึกแล้วระบบจะคำนวณกำไร/ขาดทุนใหม่ทันที</span>',
  '        </div>',
  '        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">',
  '          <div>',
  '            <label class="text-slate-400 block mb-1">เลือกหุ้นที่คุณซื้อ:</label>',
  '            <select id="inp-add-symbol" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 font-bold text-white focus:outline-none focus:border-purple-400">',
  '              <option value="VOO">VOO (Vanguard S&P 500)</option>',
  '              <option value="TTB">TTB (ธนาคารทหารไทยธนชาต)</option>',
  '              <option value="AMD">AMD (Advanced Micro Devices)</option>',
  '              <option value="VT">VT (Vanguard World)</option>',
  '              <option value="XLV">XLV (Healthcare ETF)</option>',
  '              <option value="TSLA">TSLA (Tesla)</option>',
  '              <option value="XOM">XOM (Exxon Mobil)</option>',
  '              <option value="BIDU">BIDU (Baidu)</option>',
  '              <option value="YLG-GOLD">YLG-GOLD (ทองคำ)</option>',
  '              <option value="SCBT70X(26A)">SCBT70X(26A) (กองทุน SCB)</option>',
  '              <option value="SCBTB(Thai ESGA)">SCBTB(Thai ESGA)</option>',
  '            </select>',
  '          </div>',
  '          <div>',
  '            <label class="text-slate-400 block mb-1">จำนวนหุ้นคงเหลือทั้งหมด:</label>',
  '            <input type="number" step="any" id="inp-add-shares" placeholder="เช่น 0.05 หรือ 200" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 font-mono text-white focus:outline-none focus:border-purple-400">',
  '          </div>',
  '          <div>',
  '            <label class="text-slate-400 block mb-1">ต้นทุนเฉลี่ยใหม่ (USD หรือ บาท):</label>',
  '            <input type="number" step="any" id="inp-add-cost" placeholder="ต้นทุนเฉลี่ยต่อหุ้น" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 font-mono text-white focus:outline-none focus:border-purple-400">',
  '          </div>',
  '          <div class="flex items-end">',
  '            <button onclick="saveHoldingUpdate()" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl transition shadow-md">',
  '              💾 บันทึกจำนวนหุ้นลงพอร์ต',
  '            </button> Stick',
  '          </div>',
  '        </div>',
  '        <p id="add-toast" class="text-xs text-emerald-400 font-bold mt-2 text-center h-4"></p>',
  '      </div>',
  '',
  '      <!-- Holdings Table & Diagnosis -->',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">',
  '        <div class="flex items-center justify-between mb-3">',
  '          <div>',
  '            <h3 class="font-bold text-sm text-white">📋 รายการหุ้นทั้งหมดในพอร์ตของคุณ (ตรวจสุขภาพ & คำแนะนำ)</h3>',
  '            <span class="text-xs text-slate-400">แยกตามพอร์ตหุ้นหลัก, ถือยาว, และรอขาย</span>',
  '          </div>',
  '          <button onclick="loadMyPortfolio()" class="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-3 py-1.5 rounded-lg border border-slate-700">🔄 รีเฟรชราคาพอร์ต</button>',
  '        </div>',
  '        <div class="overflow-x-auto">',
  '          <table class="w-full text-left text-xs font-mono">',
  '            <thead>',
  '              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">',
  '                <th class="py-3 px-3">หมวด</th>',
  '                <th class="py-3 px-3">ชื่อสินทรัพย์</th>',
  '                <th class="py-3 px-3">จำนวนหุ้น</th>',
  '                <th class="py-3 px-3">ต้นทุนเฉลี่ย</th>',
  '                <th class="py-3 px-3">ราคาตลาดสด</th>',
  '                <th class="py-3 px-3">มูลค่าปัจจุบัน</th>',
  '                <th class="py-3 px-3">กำไร/ขาดทุน</th>',
  '                <th class="py-3 px-3 font-sans">สถานะ & คำแนะนำ</th>',
  '              </tr>',
  '            </thead>',
  '            <tbody id="pf-tbody" class="divide-y divide-slate-800/60 font-sans">',
  '              <tr><td colspan="8" class="py-6 text-center text-slate-500">กำลังดึงข้อมูลพอร์ตของคุณ...</td></tr>',
  '            </tbody>',
  '          </table>',
  '        </div>',
  '      </div>',
  '',
  '      <!-- Strategic Doctor Advice Box -->',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs space-y-2 leading-relaxed">',
  '        <h4 class="font-bold text-sm text-amber-400 flex items-center gap-1.5">',
  '          <span>🧠</span> คำแนะนำจากหมอพอร์ต (Portfolio Optimization):',
  '        </h4>',
  '        <p class="text-slate-300">1. <b>พอร์ตกระจายตัวมากเกินไปเทียบกับเงินทุน:</b> เงินทุนรวม ~7,700 บาท แต่ถือถึง 11 ตัว ทำให้กำไรต่อตัวไม่เต็มเม็ดเต็มหน่วย</p>',
  '        <p class="text-slate-300">2. <b>สูตรพอร์ตเศรษฐีที่แนะนำ:</b> แบ่งเงิน <b>60-70% อัดเข้า VOO (S&P 500)</b> เป็นแกนหลัก แล้วเลือกถือหุ้นเทคโตไวเพียง 1-2 ตัว (เช่น AMD หรือ TSLA) + ออมทองคำ 10%</p>',
  '        <p class="text-slate-300">3. <b>จัดการตัวแดง:</b> <code>BIDU</code> ขาดทุนหนัก -22% แนะนำหยุดเติมเงิน และหากเด้งขึ้นมาควรเปลี่ยนเป็น VOO ส่วน <code>TTB</code> ถือรับปันผลต่อไปได้ดี</p>',
  '      </div>',
  '    </div>',
  '',
  '    <!-- TAB 2: M15 DAY TRADE SECTION -->',
  '    <div id="view-m15" class="hidden flex flex-col gap-4">',
  '      <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[540px] shadow-lg flex flex-col">',
  '        <iframe id="tv-frame" src="https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark&timezone=Asia%2FBangkok" class="w-full flex-1 border-0"></iframe>',
  '      </div>',
  '    </div>',
  '  </main>',
  '',
  '  <script>',
  '    let currentTab = "portfolio";',
  '',
  '    function switchTab(t) {',
  '      currentTab = t;',
  '      const b1 = document.getElementById("tab-btn-portfolio");',
  '      const b2 = document.getElementById("tab-btn-m15");',
  '      const v1 = document.getElementById("view-portfolio");',
  '      const v2 = document.getElementById("view-m15");',
  '',
  '      if (t === "portfolio") {',
  '        b1.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-purple-600 text-white shadow-md";',
  '        b2.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700";',
  '        v1.classList.remove("hidden");',
  '        v2.classList.add("hidden");',
  '      } else {',
  '        b2.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 shadow-md";',
  '        b1.className = "px-4 py-2 rounded-xl text-xs font-black transition bg-slate-800 text-slate-300 hover:bg-slate-700";',
  '        v2.classList.remove("hidden");',
  '        v1.classList.add("hidden");',
  '      }',
  '    }',
  '',
  '    async function loadMyPortfolio() {',
  '      const r = await fetch("/api/my-portfolio");',
  '      const d = await r.json();',
  '      renderPortfolioUI(d);',
  '    }',
  '',
  '    function renderPortfolioUI(data) {',
  '      if (!data) return;',
  '      document.getElementById("pf-total-val").textContent = "฿" + data.totalValueTHB.toLocaleString();',
  '      document.getElementById("pf-total-cost").textContent = "฿" + data.totalCostTHB.toLocaleString();',
  '      const sign = data.totalProfitTHB >= 0 ? "+" : "";',
  '      const pColor = data.totalProfitTHB >= 0 ? "text-emerald-400" : "text-rose-400";',
  '      document.getElementById("pf-total-profit").textContent = sign + "฿" + data.totalProfitTHB.toLocaleString() + " (" + sign + data.totalProfitPct + "%)";',
  '      document.getElementById("pf-total-profit").className = "text-2xl font-black mt-1 " + pColor;',
  '',
  '      const tbody = document.getElementById("pf-tbody");',
  '      tbody.innerHTML = data.holdings.map(function(item) {',
  '        const pCls = item.profitTHB >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";',
  '        const pSign = item.profitTHB >= 0 ? "+" : "";',
  '        const badgeColor = item.healthStatus === "ALARM" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : item.healthStatus === "EXCELLENT" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-300";',
  '        return "<tr class=\\"hover:bg-slate-800/50 transition\\">" +',
  '          "<td class=\\"py-3 px-3\\"><span class=\\"text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold\\">" + item.category + "</span></td>" +',
  '          "<td class=\\"py-3 px-3\\"><b class=\\"text-white text-sm\\">" + item.symbol + "</b><span class=\\"text-slate-400 text-xs block\\">" + item.name + "</span></td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-white font-bold\\">" + item.shares + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-slate-300\\">" + (item.currency===\'USD\'?\'$\':\'฿\') + item.avgCost + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-white font-bold\\">" + (item.currency===\'USD\'?\'$\':\'฿\') + item.currentPrice + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono text-white\\">฿" + item.valueTHB.toLocaleString() + "</td>" +',
  '          "<td class=\\"py-3 px-3 font-mono " + pCls + "\\">" + pSign + "฿" + item.profitTHB + " (" + pSign + item.profitPct + "%)</td>" +',
  '          "<td class=\\"py-3 px-3\\">" +',
  '            "<span class=\\"px-2 py-0.5 rounded text-[11px] font-bold block mb-1 " + badgeColor + "\\">" + item.advice + "</span>" +',
  '            "<span class=\\"text-[11px] text-slate-400 block\\">" + item.diagnosis + "</span>" +',
  '          "</td>" +',
  '        "</tr>";',
  '      }).join("");',
  '    }',
  '',
  '    async function saveHoldingUpdate() {',
  '      const sym = document.getElementById("inp-add-symbol").value;',
  '      const shares = document.getElementById("inp-add-shares").value;',
  '      const cost = document.getElementById("inp-add-cost").value;',
  '      if (!shares) return alert("กรุณาใส่จำนวนหุ้นคงเหลือใหม่");',
  '',
  '      const r = await fetch("/api/update-holding", {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        body: JSON.stringify({ symbol: sym, newShares: shares, newAvgCost: cost })',
  '      });',
  '      const d = await r.json();',
  '      if (d.ok) {',
  '        renderPortfolioUI(d.portfolio);',
  '        const t = document.getElementById("add-toast");',
  '        t.textContent = "✅ บันทึกจำนวนหุ้น " + sym + " เรียบร้อยแล้ว!";',
  '        setTimeout(function() { t.textContent = ""; }, 3000);',
  '      }',
  '    }',
  '',
  '    document.getElementById("send-pf-tg-btn").onclick = async function() {',
  '      const btn = document.getElementById("send-pf-tg-btn");',
  '      btn.textContent = "⏳ กำลังส่งรายงาน...";',
  '      const r = await fetch("/api/send-portfolio-telegram", { method: "POST" });',
  '      const d = await r.json();',
  '      btn.textContent = d.ok ? "✅ ส่งรายงานเข้า Telegram แล้ว!" : "⚠️ ส่งไม่สำเร็จ";',
  '      setTimeout(function() { btn.textContent = "📲 ส่งสรุปสุขภาพพอร์ตเข้า Telegram"; }, 3500);',
  '    };',
  '',
  '    loadMyPortfolio();',
  '  </script>',
  '</body>',
  '</html>'
].join('\n');

app.get('/', (req, res) => {
  res.send(HTML_PAGE);
});

// 9. ระบบ Anti-Sleep
setInterval(() => {
  fetch(APP_URL + '/api/ping').catch(() => {});
}, 10 * 60 * 1000);

server.listen(PORT, async () => {
  console.log('🚀 Terminal & Portfolio Doctor running on port ' + PORT);
  setInterval(scanMarket, 60 * 1000);
  scanMarket();
});
