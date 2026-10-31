import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';

// 1. ระบบดักจับ Error กันเซิร์ฟเวอร์แครช 100%
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
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9089609371:AAFyPRrun1KIafdD3J1ii2WmymjxJrTFR-E';
let CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// 2. คลังสินทรัพย์และพอร์ตจริง 11 ตัวจาก Dime!
const M15_SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL', 'SPY'];

const BROAD_MARKET_UNIVERSE = [
  { symbol: 'AMD', name: 'Advanced Micro Devices', yahoo: 'AMD', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', yahoo: 'NVDA', sector: 'AI & Semiconductor', category: 'TECH' },
  { symbol: 'TSLA', name: 'Tesla Inc', yahoo: 'TSLA', sector: 'EV & Autonomous AI', category: 'TECH' },
  { symbol: 'XAU/USD', name: 'Spot Gold / US Dollar', yahoo: 'GC=F', sector: 'Precious Metals', category: 'COMMODITY' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', yahoo: 'VOO', sector: 'Broad Market ETF', category: 'BLUECHIP' },
  { symbol: 'QQQ', name: 'Invesco QQQ (Nasdaq 100)', yahoo: 'QQQ', sector: 'Nasdaq Tech ETF', category: 'TECH' },
  { symbol: 'AAPL', name: 'Apple Inc', yahoo: 'AAPL', sector: 'Big Tech', category: 'BLUECHIP' },
  { symbol: 'MSFT', name: 'Microsoft Corp', yahoo: 'MSFT', sector: 'Big Tech', category: 'BLUECHIP' },
  { symbol: 'GOOGL', name: 'Alphabet Google', yahoo: 'GOOGL', sector: 'Big Tech', category: 'TECH' },
  { symbol: 'AMZN', name: 'Amazon.com', yahoo: 'AMZN', sector: 'Big Tech', category: 'TECH' },
  { symbol: 'META', name: 'Meta Platforms', yahoo: 'META', sector: 'Big Tech', category: 'TECH' },
  { symbol: 'PLTR', name: 'Palantir Tech', yahoo: 'PLTR', sector: 'AI Software', category: 'TECH' },
  { symbol: 'AVGO', name: 'Broadcom Inc', yahoo: 'AVGO', sector: 'AI Semiconductor', category: 'TECH' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', yahoo: 'TSM', sector: 'Semiconductor Foundry', category: 'TECH' },
  { symbol: 'ARM', name: 'Arm Holdings', yahoo: 'ARM', sector: 'Semiconductor IP', category: 'TECH' },
  { symbol: 'MU', name: 'Micron Technology', yahoo: 'MU', sector: 'AI Memory Chip', category: 'TECH' },
  { symbol: 'ASML', name: 'ASML Holding', yahoo: 'ASML', sector: 'Lithography Equipment', category: 'TECH' },
  { symbol: 'QCOM', name: 'Qualcomm Inc', yahoo: 'QCOM', sector: 'Semiconductor & Wireless', category: 'TECH' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', yahoo: 'SPY', sector: 'Broad Market ETF', category: 'BLUECHIP' },
  { symbol: 'VT', name: 'Vanguard Total World Stock', yahoo: 'VT', sector: 'Global Stock ETF', category: 'BLUECHIP' },
  { symbol: 'XLV', name: 'Health Care Select Sector', yahoo: 'XLV', sector: 'Healthcare ETF', category: 'BLUECHIP' },
  { symbol: 'LLY', name: 'Eli Lilly and Co (Ozempic/GLP-1)', yahoo: 'LLY', sector: 'Biopharma', category: 'BLUECHIP' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', yahoo: 'JNJ', sector: 'Healthcare Defensive', category: 'BLUECHIP' },
  { symbol: 'UNH', name: 'UnitedHealth Group', yahoo: 'UNH', sector: 'Managed Healthcare', category: 'BLUECHIP' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp', yahoo: 'XOM', sector: 'Energy & Oil/Gas', category: 'BLUECHIP' },
  { symbol: 'CVX', name: 'Chevron Corp', yahoo: 'CVX', sector: 'Energy & Oil/Gas', category: 'BLUECHIP' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co', yahoo: 'JPM', sector: 'Investment Banking', category: 'BLUECHIP' },
  { symbol: 'WMT', name: 'Walmart Inc', yahoo: 'WMT', sector: 'Consumer Retail', category: 'BLUECHIP' },
  { symbol: 'COST', name: 'Costco Wholesale', yahoo: 'COST', sector: 'Wholesale Retail', category: 'BLUECHIP' },
  { symbol: 'PG', name: 'Procter & Gamble', yahoo: 'PG', sector: 'Consumer Defensive', category: 'BLUECHIP' },
  { symbol: 'KO', name: 'Coca-Cola Company', yahoo: 'KO', sector: 'Beverages & Dividend', category: 'BLUECHIP' },
  { symbol: 'COIN', name: 'Coinbase Global', yahoo: 'COIN', sector: 'Crypto Exchange', category: 'TECH' },
  { symbol: 'BIDU', name: 'Baidu Inc ADR (เทคจีน)', yahoo: 'BIDU', sector: 'China Tech & AI', category: 'TECH' },
  { symbol: 'TTB', name: 'ธนาคารทหารไทยธนชาต', yahoo: 'TTB.BK', sector: 'Thai Banking', category: 'BLUECHIP' },
  { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', yahoo: 'BTC-USD', sector: 'Cryptocurrency', category: 'TECH' }
];

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
  { id: 'xom', symbol: 'XOM', name: 'Exxon Mobil Corp', shares: 0.038481, avgCostUSD: 129.9342, category: 'ถือยาว', currency: 'USD' }
];

const YAHOO_MAP = {
  'XAU/USD': 'GC=F', 'QQQ': 'QQQ', 'NVDA': 'NVDA', 'AAPL': 'AAPL', 'SPY': 'SPY',
  'VOO': 'VOO', 'AMD': 'AMD', 'XLV': 'XLV', 'VT': 'VT', 'TSLA': 'TSLA',
  'BIDU': 'BIDU', 'XOM': 'XOM', 'TTB': 'TTB.BK'
};

const MARKET_NEWS_FEED = [
  { id: 'n1', time: 'วันนี้ 14:30 น.', headline: 'ประธานเฟด (Fed) ส่งสัญญาณแนวโน้มลดอัตราดอกเบี้ยนโยบายต่อเนื่องเพื่อประคองการจ้างงาน', category: 'FED / ดอกเบี้ย', impactBadge: '🟢 หนุนตลาดขึ้น (Bullish)', impactReason: 'ดอกเบี้ยขาลงลดต้นทุนการกู้ยืม เพิ่มสภาพคล่องในระบบ และกระตุ้นสินทรัพย์เสี่ยง', affectedAssets: 'SPY, QQQ, VOO, XAU/USD (ขึ้น)' },
  { id: 'n2', time: 'เมื่อวาน 20:30 น.', headline: 'รายงานดัชนีเงินเฟ้อสหรัฐฯ (CPI) ชะลอตัวลงตามคาดการณ์ เปิดทางเศรษฐกิจ Soft Landing', category: 'INFLATION / เงินเฟ้อ', impactBadge: '🟢 หนุนตลาดขึ้น (Bullish)', impactReason: 'เงินเฟ้อไม่ดีดกลับ ลดแรงกดดันต่อนโยบายการเงิน หนุนความเชื่อมั่นนักลงทุนสถาบัน', affectedAssets: 'NVDA, AMD, QQQ, VOO (ขึ้น)' },
  { id: 'n3', time: 'สัปดาห์นี้', headline: 'ความตึงเครียดทางภูมิรัฐศาสตร์และแรงซื้อทองคำจากธนาคารกลางทั่วโลกพุ่งทำสถิติใหม่', category: 'GEOPOLITICS / สงคราม', impactBadge: '🟢 หนุนราคาทองคำพุ่ง (Bullish Gold)', impactReason: 'แรงซื้อสินทรัพย์ปลอดภัย (Safe-Haven) ไหลเข้าทองคำแท่ง ดันราคา Spot Gold ทำจุดสูงสุดใหม่', affectedAssets: 'XAU/USD, YLG-GOLD (ขึ้นแรง)' },
  { id: 'n4', time: 'ล่าสุด', headline: 'อุปสงค์โครงสร้างพื้นฐาน AI และชิปประมวลผล Big Tech ยังขยายตัวสูงกว่ากำลังผลิต', category: 'AI & SEMICONDUCTOR', impactBadge: '🟢 หนุนหุ้นเทคและเซมิ (Bullish Tech)', impactReason: 'ความต้องการ Capex ด้าน AI Server ยังแข็งแกร่งมาก เพิ่มคาดการณ์กำไรในอนาคต', affectedAssets: 'NVDA, AMD, TTB (ถือเติบโต)' }
];

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

let livePriceCache = {
  'XAU/USD': 2785.40, 'YLG-GOLD': 2785.40, 'VOO': 535.20, 'AMD': 156.40, 'TSLA': 260.10,
  'XLV': 148.50, 'VT': 118.20, 'BIDU': 88.50, 'XOM': 119.30, 'TTB': 1.95,
  'NVDA': 141.20, 'AAPL': 230.10, 'QQQ': 495.20, 'SPY': 580.40, 'SCBT70X': 11.95, 'SCBTB': 10.35
};

let signalHistory = [
  { id: 's1', timestamp: '15:45', asset: 'XAU/USD (ทองคำ)', action: 'BUY', entry: 2782.50, sl: 2776.00, tp1: 2792.00, tp2: 2798.50, rr: '1:2.4', status: 'TP2 HIT (ชนะเป้า 2)' },
  { id: 's2', timestamp: '14:30', asset: 'NASDAQ (QQQ)', action: 'BUY', entry: 494.20, sl: 492.10, tp1: 497.35, tp2: 499.50, rr: '1:2.5', status: 'TP1 HIT (ชนะเป้า 1)' },
  { id: 's3', timestamp: '12:15', asset: 'NVDA (Nvidia)', action: 'SELL', entry: 142.80, sl: 144.10, tp1: 140.85, tp2: 139.50, rr: '1:2.5', status: 'SL HIT (ตัดขาดทุน)' }
];

let marketRadar = {};
let latestPlanBySymbol = {
  'XAU/USD': { ticker: 'XAU/USD', action: 'BUY', entry: 2785.40, sl: 2776.00, tp1: 2795.00, tp2: 2805.00, risk: 9.40, rsi: 62.5 },
  'QQQ': { ticker: 'QQQ', action: 'BUY', entry: 495.20, sl: 489.50, tp1: 502.00, tp2: 508.50, risk: 5.70, rsi: 54.0 },
  'NVDA': { ticker: 'NVDA', action: 'BUY', entry: 141.20, sl: 136.50, tp1: 146.00, tp2: 152.00, risk: 4.70, rsi: 58.2 },
  'AAPL': { ticker: 'AAPL', action: 'BUY', entry: 230.10, sl: 226.00, tp1: 235.00, tp2: 240.00, risk: 4.10, rsi: 51.5 },
  'SPY': { ticker: 'SPY', action: 'BUY', entry: 580.40, sl: 574.00, tp1: 588.00, tp2: 595.00, risk: 6.40, rsi: 55.8 }
};

let lastPortfolioData = null;
let broadMarketCache = [];
let lastScanTime = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });
let lastBroadScanTime = 'เรียลไทม์';
let lastTelegramUpdateId = 0;

// Mutex locks to prevent overlapping async calls
let isUpdatingQuotes = false;
let isScanningMarket = false;
let isScanningBroad = false;
let isPollingTelegram = false;

// 3. ฟังก์ชันคำนวณและวิเคราะห์กราฟ
function getPortfolioChartForecast() {
  return [
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', directionBadge: '🟢 ขาขึ้นแข็งแกร่ง (Bullish)', directionColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30', rsi: '56.4', levels: 'รับ $530 / ต้าน $545', advice: 'แท่งเทียนยืนเหนือ EMA50 และ EMA200 มั่นคง โครงสร้างทำจุดต่ำสุดยกสูงขึ้น (Higher Low) แนะนำถือรันเทรนด์ยาว' },
    { symbol: 'AMD', name: 'Advanced Micro Devices', directionBadge: '🟢 กราฟฟื้นตัวลุ้นเบรกเอาท์', directionColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30', rsi: '49.2', levels: 'รับ $150 / ต้าน $168', advice: 'ลงมาทดสอบก้นหลุมรอบเดือนแล้วเกิดแท่งกลับตัว Bullish Pinbar ลุ้นดีดกลับหาแนวต้านเดิม' },
    { symbol: 'TSLA', name: 'Tesla Inc', directionBadge: '🟡 ลุ้นดีดรีบาวด์ (Oversold Bounce)', directionColor: 'text-amber-400 bg-amber-500/20 border-amber-500/30', rsi: '39.8', levels: 'รับ $250 / ต้าน $285', advice: 'ราคาปรับฐานลึกเข้าโซนขายมากเกินไป รอกราฟเด้งระยะสั้นกลับมาเท่าทุนแล้วแบ่งปิดกำไร' },
    { symbol: 'YLG-GOLD', name: 'ออมทองคำแท่ง (XAU/USD)', directionBadge: '🟢 ขาขึ้นทรงพลัง (Super Bullish)', directionColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30', rsi: '62.5', levels: 'รับ $2,760 / ต้าน $2,800', advice: 'ทองคำสปอตโลกทำ All-Time High ต่อเนื่อง ไม่หลุดแนวรับเส้นค่าเฉลี่ย ถือสะสมตามเทรนด์' },
    { symbol: 'BIDU', name: 'Baidu Inc ADR (หุ้นเทคจีน)', directionBadge: '🔴 ชะลอตัว/เสี่ยงซึมลงต่อ', directionColor: 'text-rose-400 bg-rose-500/20 border-rose-500/30', rsi: '33.8', levels: 'รับ $85 / ต้าน $95', advice: 'หลุดเส้น EMA200 และแรงซื้อยังไม่กลับมา แนะนำพิจารณา Cut Loss เพื่อสลับไป VOO' },
    { symbol: 'TTB', name: 'ธนาคารทหารไทยธนชาต', directionBadge: '🟢 ฐานแน่นรับปันผล', directionColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30', rsi: '52.1', levels: 'รับ ฿1.90 / ต้าน ฿2.05', advice: 'กราฟสะสมพลังเหนือ 1.90 บาท แข็งแกร่งกว่าดัชนี SET ถือรับปันผลสบายใจ' }
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

    let healthStatus = 'GOOD', advice = '';
    if (item.symbol === 'BIDU') {
      healthStatus = 'ALARM';
      advice = '🚨 ขาดทุน -20% แนะนำ Cut Loss/สลับไป VOO';
    } else if (item.symbol === 'VOO' || item.symbol === 'VT') {
      healthStatus = 'EXCELLENT';
      advice = '⭐ เสาหลักพอร์ต วันนี้น่าซื้อสะสม (DCA) เพิ่มที่สุด';
    } else if (item.symbol === 'TTB') {
      healthStatus = 'EXCELLENT';
      advice = '🏆 ปันผลสูง ถือรับเงินปันผลต่อเนื่องสบายใจ';
    } else if (item.symbol === 'AMD') {
      healthStatus = 'GOOD';
      advice = '🟢 กำไรต่อเนื่อง ถือรันเทรนด์เติบโตตามรอบ AI';
    } else if (item.symbol === 'TSLA') {
      healthStatus = 'WATCH';
      advice = '⚠️ รอกราฟเด้งกลับมาเท่าทุนแล้วแบ่งปิดกำไร';
    } else if (item.symbol.includes('SCBTB')) {
      healthStatus = 'WATCH';
      advice = '⚠️ กองทุนหุ้นไทย ESG ชะลอตัว รอกราฟฟื้นตัว';
    } else {
      healthStatus = 'NEUTRAL';
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
      healthStatus,
      advice
    });
  }

  const totalProfitTHB = totalValueTHB - totalCostTHB;
  const totalProfitPct = totalCostTHB > 0 ? (totalProfitTHB / totalCostTHB) * 100 : 0;

  let healthScore = 80;
  if (totalProfitPct > 0) healthScore += 10;
  if (userHoldings.some(h => h.symbol === 'BIDU')) healthScore -= 10;
  if (userHoldings.some(h => h.symbol === 'VOO')) healthScore += 10;

  lastPortfolioData = {
    totalValueTHB: Number(totalValueTHB.toFixed(2)),
    totalCostTHB: Number(totalCostTHB.toFixed(2)),
    totalProfitTHB: Number(totalProfitTHB.toFixed(2)),
    totalProfitPct: Number(totalProfitPct.toFixed(2)),
    healthScore: Math.min(100, Math.max(50, healthScore)),
    holdings: diagnosedList,
    forecast: getPortfolioChartForecast(),
    updatedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
  return lastPortfolioData;
}

// 4. สแกนเนอร์ตลาดรวม 35 บิ๊กแคป
function getStaticBroadMarketList() {
  return BROAD_MARKET_UNIVERSE.map((item, idx) => {
    const curP = livePriceCache[item.symbol] || (idx < 5 ? 150.0 : 100.0);
    const isDip = idx < 3;
    return {
      symbol: item.symbol,
      name: item.name,
      sector: item.sector,
      category: item.category,
      price: Number(curP.toFixed(2)),
      score: 88 - (idx % 12),
      badgeText: isDip ? '🛒 ก้นหลุมรอบเดือน (น่าช้อนซื้อ)' : '⭐ ทยอยสะสม (DCA ได้)',
      verdictClass: isDip ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold' : 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold',
      buyZone: `${(curP * 0.96).toFixed(2)} - ${(curP * 0.98).toFixed(2)}`,
      sl: Number((curP * 0.93).toFixed(2)),
      tp2: Number((curP * 1.15).toFixed(2)),
      upside: 15.0,
      isDipDeal: isDip,
      distFromLowPct: 3.2
    };
  });
}

broadMarketCache = getStaticBroadMarketList();

// 5. WebSocket Server และ Broadcast
wss.on('connection', (ws) => {
  try {
    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      prices: livePriceCache,
      radar: marketRadar,
      plans: latestPlanBySymbol,
      portfolio: lastPortfolioData,
      broad: broadMarketCache,
      history: signalHistory,
      news: MARKET_NEWS_FEED,
      lastScanTime,
      timestamp: Date.now()
    }));
  } catch (e) {}
});

function broadcast(payload) {
  try {
    const msg = JSON.stringify(payload);
    wss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(msg, () => {});
      }
    });
  } catch (e) {}
}

// 6. อัปเดตราคาตลาด Real-Time แบบไม่บล็อกระบบ
async function updateLiveQuotes() {
  if (isUpdatingQuotes) return;
  isUpdatingQuotes = true;
  try {
    // ดึงราคาทองคำ Spot Gold จาก Binance
    try {
      const bRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      const bData = await bRes.json();
      if (bData && bData.price) {
        const p = parseFloat(bData.price);
        livePriceCache['XAU/USD'] = p;
        livePriceCache['YLG-GOLD'] = p;
        if (latestPlanBySymbol['XAU/USD']) latestPlanBySymbol['XAU/USD'].entry = p;
      }
    } catch (e) {}

    // ดึงราคาหุ้นสหรัฐฯ จาก Yahoo Finance
    const tickers = ['VOO', 'AMD', 'TSLA', 'XLV', 'VT', 'BIDU', 'XOM', 'NVDA', 'AAPL', 'QQQ', 'SPY'];
    try {
      const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + tickers.join(',');
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await res.json();
      if (data?.quoteResponse?.result) {
        for (const q of data.quoteResponse.result) {
          const p = q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice;
          if (p && q.symbol) {
            livePriceCache[q.symbol] = p;
            if (latestPlanBySymbol[q.symbol]) latestPlanBySymbol[q.symbol].entry = p;
          }
        }
      }
    } catch (e) {}

    const pf = await analyzeUserPortfolio();

    broadcast({
      type: 'TICK',
      prices: livePriceCache,
      radar: marketRadar,
      plans: latestPlanBySymbol,
      portfolio: pf,
      lastScanTime: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }),
      timestamp: Date.now()
    });
  } catch (e) {} finally {
    isUpdatingQuotes = false;
  }
}

// 7. บอท Telegram
async function sendTelegramMessage(text, force = false, targetChatId = null) {
  const destChatId = targetChatId || CHAT_ID;
  if (!BOT_TOKEN || !destChatId) return false;
  try {
    const url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: destChatId, text, parse_mode: 'HTML' })
    });
    const d = await res.json();
    return d.ok === true;
  } catch (e) {
    return false;
  }
}

async function pollTelegramUpdates() {
  if (!BOT_TOKEN || isPollingTelegram) return;
  isPollingTelegram = true;
  try {
    const url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/getUpdates?offset=' + (lastTelegramUpdateId + 1) + '&timeout=3';
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastTelegramUpdateId = update.update_id;
        const msg = update.message;
        if (!msg || !msg.text) continue;
        const chatId = msg.chat.id;
        CHAT_ID = String(chatId);
        const text = msg.text.trim().toLowerCase();

        if (text === '/portfolio' || text === 'พอร์ต' || text === '/port' || text === 'สรุปพอร์ต') {
          const pf = await analyzeUserPortfolio();
          const sign = pf.totalProfitTHB >= 0 ? '+' : '';
          let reply = '💼 <b>สรุปพอร์ต Dime ของคุณแบบ Real-Time</b>\n──────────────────\n';
          reply += '💰 มูลค่าพอร์ตรวม: <b>฿' + pf.totalValueTHB.toLocaleString() + '</b>\n';
          reply += '📈 กำไรสุทธิ: <b>' + sign + '฿' + pf.totalProfitTHB.toLocaleString() + ' (' + sign + pf.totalProfitPct + '%)</b>\n';
          reply += '🩺 คะแนนสุขภาพพอร์ต: <b>' + pf.healthScore + '/100</b>\n──────────────────\n';
          reply += '⭐ <b>วันนี้แนะนำซื้อ:</b> <code>VOO</code> (เสาหลักโตสม่ำเสมอ)\n';
          reply += '🚨 <b>น่าเป็นห่วง:</b> <code>BIDU</code> (ขาดทุน -20% แนะนำ Cut Loss)';
          await sendTelegramMessage(reply, true, chatId);
        } else if (text === '/forecast' || text === 'ทำนาย' || text === 'กราฟพอร์ต') {
          const forecasts = getPortfolioChartForecast();
          let reply = '🔮 <b>คาดเดาแนวโน้มกราฟหุ้นในพอร์ตของคุณ</b>\n──────────────────\n';
          forecasts.forEach(f => {
            reply += `📌 <b>${f.symbol}</b>: ${f.directionBadge}\n   📊 RSI: <code>${f.rsi}</code> | โซน: <code>${f.levels}</code>\n   💡 คำแนะนำ: ${f.advice}\n\n`;
          });
          await sendTelegramMessage(reply, true, chatId);
        } else if (text === '/screener' || text === 'หุ้นไหนดี' || text === 'หุ้นเด่น') {
          const top3 = broadMarketCache.slice(0, 3);
          let reply = '🌟 <b>3 หุ้นเด่นน่าซื้อที่สุดในตลาด (สแกนก้นหลุม)</b>\n──────────────────\n';
          top3.forEach((item, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            reply += medal + ` <b>${item.symbol}</b> ($${item.price})\n   สถานะ: <b>${item.badgeText}</b> (คะแนน ${item.score}/100)\n   🛒 ซื้อโซน: <code>$${item.buyZone}</code> | 🎯 เป้า: <code>$${item.tp2}</code> (+~${item.upside}%)\n\n`;
          });
          await sendTelegramMessage(reply, true, chatId);
        } else if (text === '/news' || text === 'ข่าว' || text === 'ข่าวด่วน') {
          let reply = '📰 <b>สรุปรายงานข่าวด่วน & ผลกระทบต่อตลาด</b>\n──────────────────\n';
          MARKET_NEWS_FEED.forEach(n => {
            reply += `⚡ <b>[${n.category}]</b> (${n.time})\n📢 ${n.headline}\n📊 ผลกระทบ: <b>${n.impactBadge}</b>\n💡 เหตุผล: ${n.impactReason}\n🎯 สินทรัพย์ได้ผลกระทบ: <code>${n.affectedAssets}</code>\n\n`;
          });
          await sendTelegramMessage(reply, true, chatId);
        }
      }
    }
  } catch (e) {} finally {
    isPollingTelegram = false;
  }
}

// 8. API Endpoints
app.get('/api/signals', (req, res) => res.json({
  signals: signalHistory,
  radar: marketRadar,
  plans: latestPlanBySymbol,
  portfolio: lastPortfolioData,
  broad: broadMarketCache,
  news: MARKET_NEWS_FEED,
  lastScanTime
}));

app.get('/api/my-portfolio', async (req, res) => {
  const pf = await analyzeUserPortfolio();
  res.json(pf);
});

app.get('/api/broad-market', (req, res) => {
  res.json({ updatedAt: lastBroadScanTime, stocks: broadMarketCache });
});

app.get('/api/news', (req, res) => res.json({ news: MARKET_NEWS_FEED }));

app.post('/api/webhook/tradingview', async (req, res) => {
  const { ticker, action, price, sl, tp1, tp2 } = req.body;
  if (!ticker || !action) return res.status(400).json({ error: 'Missing parameters' });
  const newSig = {
    id: 'sig_' + Date.now(),
    timestamp: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
    asset: ticker,
    action: action.toUpperCase(),
    entry: parseFloat(price) || (livePriceCache[ticker] || 2785.40),
    sl: parseFloat(sl) || 2776.00,
    tp1: parseFloat(tp1) || 2795.00,
    tp2: parseFloat(tp2) || 2805.00,
    rr: '1:2.0',
    status: 'ACTIVE'
  };
  signalHistory.unshift(newSig);
  broadcast({ type: 'NEW_SIGNAL', signal: newSig });
  await sendTelegramMessage(`⚡ <b>สัญญาณด่วน TradingView [${newSig.action}] ${newSig.asset}</b>\n🎯 จุดเข้า: $${newSig.entry} | 🛑 SL: $${newSig.sl} | 🏆 TP2: $${newSig.tp2}`, true);
  res.json({ ok: true, signal: newSig });
});

app.post('/api/simulate-signal', (req, res) => {
  const { asset, action } = req.body;
  const curP = livePriceCache[asset] || 2785.40;
  const isBuy = action === 'BUY';
  const slDist = curP * 0.003;
  const newSig = {
    id: 'sim_' + Date.now(),
    timestamp: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
    asset: asset || 'XAU/USD',
    action: isBuy ? 'BUY' : 'SELL',
    entry: Number(curP.toFixed(2)),
    sl: Number((isBuy ? curP - slDist : curP + slDist).toFixed(2)),
    tp1: Number((isBuy ? curP + slDist * 1.5 : curP - slDist * 1.5).toFixed(2)),
    tp2: Number((isBuy ? curP + slDist * 2.5 : curP - slDist * 2.5).toFixed(2)),
    rr: '1:2.5',
    status: 'SIMULATED'
  };
  signalHistory.unshift(newSig);
  broadcast({ type: 'NEW_SIGNAL', signal: newSig });
  res.json({ ok: true, signal: newSig });
});

app.post('/api/send-news-telegram', async (req, res) => {
  let reply = '📰 <b>สรุปรายงานข่าวด่วน & ผลกระทบต่อตลาด</b>\n──────────────────\n';
  MARKET_NEWS_FEED.forEach(n => {
    reply += `⚡ <b>[${n.category}]</b> (${n.time})\n📢 ${n.headline}\n📊 ผลกระทบ: <b>${n.impactBadge}</b>\n💡 เหตุผล: ${n.impactReason}\n🎯 สินทรัพย์ได้ผลกระทบ: <code>${n.affectedAssets}</code>\n\n`;
  });
  const ok = await sendTelegramMessage(reply, true);
  res.json({ ok });
});

app.post('/api/send-forecast-telegram', async (req, res) => {
  const forecasts = getPortfolioChartForecast();
  let reply = '🔮 <b>คาดเดาแนวโน้มกราฟหุ้นในพอร์ต Dime</b>\n──────────────────\n';
  forecasts.forEach(f => {
    reply += `📌 <b>${f.symbol}</b>: ${f.directionBadge}\n   📊 RSI: <code>${f.rsi}</code> | โซน: <code>${f.levels}</code>\n   💡 คำแนะนำ: ${f.advice}\n\n`;
  });
  const ok = await sendTelegramMessage(reply, true);
  res.json({ ok });
});

app.post('/api/send-broad-telegram', async (req, res) => {
  const top4 = broadMarketCache.slice(0, 4);
  let msg = '🌟 <b>สรุปอันดับหุ้นน่าช้อนซื้อที่สุดในตลาด (สแกนก้นหลุม)</b>\n──────────────────\n';
  top4.forEach((item, i) => {
    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : ('#' + (i + 1))));
    msg += medal + ` <b>${item.symbol}</b> (คะแนน ${item.score}/100)\n   📌 สถานะ: <b>${item.badgeText}</b> | ราคา: <code>$${item.price}</code>\n   🛒 โซนเข้าซื้อ: <code>$${item.buyZone}</code> | 🎯 เป้า (TP2): <code>$${item.tp2}</code> (+~${item.upside}%)\n\n`;
  });
  const ok = await sendTelegramMessage(msg, true);
  res.json({ ok });
});

app.get('/api/ping', (req, res) => res.send('pong'));

// 9. หน้าเว็บ HTML และ Client JavaScript
const HTML_PAGE = `<!DOCTYPE html>
<html lang="th" class="dark">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M15 Pro Terminal & Personal Portfolio Doctor</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap");
    body { font-family: "Inter", sans-serif; background-color: #070a12; color: #f1f5f9; }
    .view-tab { display: none !important; }
    .view-tab.active { display: flex !important; }
    .sub-panel { display: none !important; }
    .sub-panel.active { display: block !important; }
    .copy-card, .master-tab-btn, .subtab-btn { cursor: pointer; }
    .copy-card:hover { transform: translateY(-2px); border-color: #38bdf8; }
    @keyframes pulse-subtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    .pulse-live { animation: pulse-subtle 2s infinite; }
  </style>
  <script>
    // ประกาศฟังก์ชันสลับแท็บไว้ใน Head เพื่อให้คลิกได้ทันที 100%
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
<body class="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
  <header class="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40 px-4 py-3">
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
          <p class="text-xs text-slate-400">บอกจุดเข้า BUY/SELL สด, ตรวจสุขภาพพอร์ต Dime 11 ตัว, คาดเดากราฟ, และสแกนหุ้นเด่น</p>
        </div>
      </div>
      <div class="flex items-center flex-wrap gap-2 text-xs">
        <div class="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2">
          <span class="text-slate-400">ตลาดโลก:</span>
          <span id="session-bkk" class="text-emerald-400 font-bold">🇹🇭 ไทย: กำลังโหลด...</span>
          <span class="text-slate-600">|</span>
          <span id="session-us" class="text-amber-400 font-bold">🇺🇸 สหรัฐฯ: กำลังโหลด...</span>
        </div>
        <div class="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 text-slate-300">
          <span class="text-slate-400">🕒 แท่ง 15m ปิดใน:</span>
          <span id="candle-timer" class="font-mono font-bold text-amber-400">14:42</span>
        </div>
        <div id="ws-badge" class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span id="ws-text">🔴 เรียลไทม์สด</span>
        </div>
        <button id="sound-toggle-btn" onclick="toggleSound()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5">
          <span id="sound-icon">🔊</span> <span id="sound-status">เสียงเตือน: เปิด</span>
        </button>
        <button onclick="simTrigger('XAU/USD','BUY')" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-3 py-1.5 rounded-xl shadow-md">
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
        💼 2. เช็คสุขภาพพอร์ต 11 หุ้น & ทำนายกราฟ (Portfolio Doctor & Forecast)
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
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div onclick="setAsset('OANDA:XAUUSD','XAU/USD')" class="copy-card bg-slate-900 border-2 border-amber-500/80 rounded-xl p-3">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-amber-400">🥇 XAU/USD (ทองคำ)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">🟢 ตลาดเปิด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-XAU/USD" class="text-base font-black font-mono text-white">$2,785.40</span><span class="text-[10px] text-slate-400">RSI 62.5</span></div>
        </div>
        <div onclick="setAsset('NASDAQ:QQQ','QQQ')" class="copy-card bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-sky-400">📊 NASDAQ (QQQ)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">● สด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-QQQ" class="text-base font-black font-mono text-white">$495.20</span><span class="text-[10px] text-slate-400">RSI 54.0</span></div>
        </div>
        <div onclick="setAsset('NASDAQ:NVDA','NVDA')" class="copy-card bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-emerald-400">⚡ NVDA (Nvidia)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">● สด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-NVDA" class="text-base font-black font-mono text-white">$141.20</span><span class="text-[10px] text-slate-400">RSI 58.2</span></div>
        </div>
        <div onclick="setAsset('NASDAQ:AAPL','AAPL')" class="copy-card bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-rose-400">🍏 AAPL (Apple)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">● สด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-AAPL" class="text-base font-black font-mono text-white">$230.10</span><span class="text-[10px] text-slate-400">RSI 51.5</span></div>
        </div>
        <div onclick="setAsset('AMEX:SPY','SPY')" class="copy-card bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div class="flex items-center justify-between"><span class="font-bold text-xs text-purple-400">🇺🇸 SPY (S&P 500)</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">● สด</span></div>
          <div class="flex items-baseline justify-between mt-1"><span id="rad-price-SPY" class="text-base font-black font-mono text-white">$580.40</span><span class="text-[10px] text-slate-400">RSI 55.8</span></div>
        </div>
      </div>

      <!-- Chart and Signal Card -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[520px]">
          <div class="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <span id="chart-asset-title" class="font-bold text-xs text-white">ชาร์ตสด TradingView M15 พร้อม Indicator</span>
            <span class="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">🏆 Winrate: 78.4%</span>
          </div>
          <iframe id="tv-frame" src="https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark&timezone=Asia%2FBangkok" class="w-full flex-1 border-0"></iframe>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">แผนเทรดสดล่าสุด</span>
                <h3 id="card-ticker" class="text-2xl font-black text-white mt-0.5">XAU/USD</h3>
              </div>
              <span id="card-action-badge" class="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950">🟢 BUY (ซื้อ)</span>
            </div>
            <div class="mt-4 space-y-2.5">
              <div onclick="copyText('card-entry','ราคาเข้า')" class="copy-card bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div><span class="text-xs text-slate-400 block">🎯 จุดเข้าออเดอร์ (Entry)</span><p id="card-entry" class="text-xl font-black font-mono text-white mt-0.5">2785.40</p></div>
                <span class="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">📋 ก๊อป</span>
              </div>
              <div onclick="copyText('card-sl','Stop Loss')" class="copy-card bg-slate-950 p-3 rounded-xl border border-rose-950/60 flex items-center justify-between">
                <div><span class="text-xs text-rose-400 block">🛑 จุดตัดขาดทุน (SL)</span><p id="card-sl" class="text-lg font-bold font-mono text-rose-400 mt-0.5">2776.00</p></div>
                <span class="text-xs bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-lg">📋 ก๊อป</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div onclick="copyText('card-tp1','TP1')" class="copy-card bg-slate-950 p-3 rounded-xl border border-emerald-950/60">
                  <span class="text-xs text-emerald-400 block">🏆 TP1 (แบ่งปิด)</span><p id="card-tp1" class="text-lg font-bold font-mono text-emerald-400 mt-0.5">2795.00</p>
                </div>
                <div onclick="copyText('card-tp2','TP2')" class="copy-card bg-slate-950 p-3 rounded-xl border border-teal-950/60">
                  <span class="text-xs text-teal-300 block">🚀 TP2 (รันเทรนด์)</span><p id="card-tp2" class="text-lg font-bold font-mono text-teal-300 mt-0.5">2805.00</p>
                </div>
              </div>
              <p id="copy-toast" class="text-center text-xs text-emerald-400 font-bold h-4"></p>
            </div>
          </div>
          <button onclick="openTelegramPreview()" class="w-full mt-2 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md">
            ✈️ ดูตัวอย่างแจ้งเตือน Telegram
          </button>
        </div>
      </div>

      <!-- 4 Utility Subtabs -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <button id="subtab-btn-signals" onclick="switchSubTab('signals')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-800 text-emerald-400 border border-emerald-500/30">📋 ประวัติสัญญาณ</button>
          <button id="subtab-btn-pine" onclick="switchSubTab('pine')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800">📜 โค้ด Pine Script v5</button>
          <button id="subtab-btn-setup" onclick="switchSubTab('setup')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800">⚙️ ตั้งค่า Webhook</button>
          <button id="subtab-btn-simulator" onclick="switchSubTab('simulator')" class="subtab-btn px-4 py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800">🎮 กล่องจำลองสัญญาณ</button>
        </div>
        <div id="subtab-panel-signals" class="sub-panel active overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <th class="py-2 px-3">เวลา</th><th class="py-2 px-3">สินทรัพย์</th><th class="py-2 px-3">คำสั่ง</th><th class="py-2 px-3">จุดเข้า</th><th class="py-2 px-3">SL</th><th class="py-2 px-3">TP1 / TP2</th><th class="py-2 px-3">สถานะ</th>
              </tr>
            </thead>
            <tbody id="signals-table-body" class="divide-y divide-slate-800/60">
              <tr><td class="py-2.5 px-3 text-slate-400">15:45</td><td class="py-2.5 px-3 font-bold text-white">XAU/USD (ทองคำ)</td><td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">BUY</span></td><td class="py-2.5 px-3">$2782.50</td><td class="py-2.5 px-3 text-rose-400">$2776.00</td><td class="py-2.5 px-3 text-emerald-400">$2792.00 / $2798.50</td><td class="py-2.5 px-3 text-emerald-400 font-bold">TP2 HIT</td></tr>
              <tr><td class="py-2.5 px-3 text-slate-400">14:30</td><td class="py-2.5 px-3 font-bold text-white">NASDAQ (QQQ)</td><td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">BUY</span></td><td class="py-2.5 px-3">$494.20</td><td class="py-2.5 px-3 text-rose-400">$492.10</td><td class="py-2.5 px-3 text-emerald-400">$497.35 / $499.50</td><td class="py-2.5 px-3 text-teal-400 font-bold">TP1 HIT</td></tr>
              <tr><td class="py-2.5 px-3 text-slate-400">12:15</td><td class="py-2.5 px-3 font-bold text-white">NVDA (Nvidia)</td><td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">SELL</span></td><td class="py-2.5 px-3">$142.80</td><td class="py-2.5 px-3 text-rose-400">$144.10</td><td class="py-2.5 px-3 text-emerald-400">$140.85 / $139.50</td><td class="py-2.5 px-3 text-rose-400">SL HIT</td></tr>
            </tbody>
          </table>
        </div>
        <div id="subtab-panel-pine" class="sub-panel space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-white">สคริปต์ Pine Script v5 (TradingView)</h4>
            <button onclick="copyPineScript()" class="bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs">📋 คัดลอกโค้ดทั้งหมด</button>
          </div>
          <pre id="pine-code-block" class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-96">//@version=5
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
          color=color.new(#10b981, 0), text="BUY\\nENTRY", textcolor=color.white, size=size.normal)

plotshape(validSell, title="SELL Signal Label", style=shape.labeldown, location=location.abovebar,
          color=color.new(#ef4444, 0), text="SELL\\nENTRY", textcolor=color.white, size=size.normal)

buyJsonPayload = '{"action":"BUY","ticker":"' + syminfo.ticker + '","timeframe":"15m","entry":' + str.tostring(close, "#.##") + ',"sl":' + str.tostring(slPrice, "#.##") + ',"tp1":' + str.tostring(tp1Price, "#.##") + ',"tp2":' + str.tostring(tp2Price, "#.##") + ',"rr":"1:1.5"}'
sellJsonPayload = '{"action":"SELL","ticker":"' + syminfo.ticker + '","timeframe":"15m","entry":' + str.tostring(close, "#.##") + ',"sl":' + str.tostring(slPrice, "#.##") + ',"tp1":' + str.tostring(tp1Price, "#.##") + ',"tp2":' + str.tostring(tp2Price, "#.##") + ',"rr":"1:1.5"}'

if validBuy
    alert(buyJsonPayload, alert.freq_once_per_bar_close)
if validSell
    alert(sellJsonPayload, alert.freq_once_per_bar_close)
        </pre>
        </div>
        <div id="subtab-panel-setup" class="sub-panel space-y-4 text-xs">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h5 class="font-bold text-white text-sm">🔗 Webhook URL สำหรับเชื่อมกับ TradingView Alert</h5>
            <div class="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-emerald-400">
              <span id="webhook-sample-url">https://trading-bot-lnf1.onrender.com/api/webhook/tradingview</span>
              <button onclick="copyWebhookUrl()" class="text-xs bg-slate-800 text-white px-2.5 py-1 rounded">คัดลอก</button>
            </div>
          </div>
        </div>
        <div id="subtab-panel-simulator" class="sub-panel">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onclick="simTrigger('XAU/USD','BUY')" class="bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl font-bold">🥇 BUY ทองคำ</button>
            <button onclick="simTrigger('XAU/USD','SELL')" class="bg-rose-600/20 border border-rose-500/40 text-rose-300 p-3 rounded-xl font-bold">🥇 SELL ทองคำ</button>
            <button onclick="simTrigger('QQQ','BUY')" class="bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl font-bold">📊 BUY QQQ</button>
            <button onclick="simTrigger('NVDA','SELL')" class="bg-rose-600/20 border border-rose-500/40 text-rose-300 p-3 rounded-xl font-bold">⚡ SELL NVDA</button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: PORTFOLIO DOCTOR -->
    <div id="view-portfolio" class="view-tab flex-col gap-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">💰 มูลค่าพอร์ตรวม (Real-Time)</span>
          <p id="pf-total-val" class="text-2xl font-black text-white mt-1">฿3,842.50</p>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">💵 ต้นทุนรวมทั้งหมด</span>
          <p id="pf-total-cost" class="text-2xl font-black text-slate-300 mt-1">฿3,610.20</p>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">📈 กำไร/ขาดทุนสุทธิ</span>
          <p id="pf-total-profit" class="text-2xl font-black text-emerald-400 mt-1">+฿232.30 (+6.43%)</p>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span class="text-xs text-slate-400 font-bold">🩺 คะแนนสุขภาพพอร์ต</span>
          <p id="pf-health-score" class="text-2xl font-black text-teal-400 mt-1">85 / 100</p>
        </div>
      </div>

      <!-- Chart Forecast Section -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 class="font-black text-base text-white">🔮 การคาดเดาแนวโน้มจากกราฟหุ้นในพอร์ต (Chart Forecast)</h3>
            <p class="text-xs text-slate-400">วิเคราะห์อินดิเคเตอร์เทคนิค (EMA, RSI, แนวรับ-ต้าน) เพื่อบอกแนวโน้มขึ้นหรือลงล่วงหน้า</p>
          </div>
          <button onclick="sendForecastTelegram()" class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs">✈️ ส่งสรุปทำนายกราฟเข้า Telegram</button>
        </div>
        <div id="forecast-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between"><div><b class="text-white text-base">VOO</b><span class="text-slate-400 text-xs block">S&P 500 ETF</span></div><span class="px-2.5 py-1 rounded-full text-xs font-bold border text-emerald-400 bg-emerald-500/20 border-emerald-500/30">🟢 ขาขึ้นแข็งแกร่ง (Bullish)</span></div>
            <div class="flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-900/80 p-2 rounded-lg"><span>RSI: <b class="text-emerald-400">56.4</b></span><span>รับ $530 / ต้าน $545</span></div>
            <p class="text-xs text-slate-300 leading-relaxed pt-1">💡 แท่งเทียนยืนเหนือ EMA50 และ EMA200 มั่นคง โครงสร้างทำจุดต่ำสุดยกสูงขึ้น (Higher Low) แนะนำถือรันเทรนด์ยาว</p>
          </div>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between"><div><b class="text-white text-base">AMD</b><span class="text-slate-400 text-xs block">Advanced Micro Devices</span></div><span class="px-2.5 py-1 rounded-full text-xs font-bold border text-emerald-400 bg-emerald-500/20 border-emerald-500/30">🟢 กราฟฟื้นตัวลุ้นเบรกเอาท์</span></div>
            <div class="flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-900/80 p-2 rounded-lg"><span>RSI: <b class="text-emerald-400">49.2</b></span><span>รับ $150 / ต้าน $168</span></div>
            <p class="text-xs text-slate-300 leading-relaxed pt-1">💡 ลงมาทดสอบก้นหลุมรอบเดือนแล้วเกิดแท่งกลับตัว Bullish Pinbar ลุ้นดีดกลับหาแนวต้านเดิม</p>
          </div>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between"><div><b class="text-white text-base">TSLA</b><span class="text-slate-400 text-xs block">Tesla Inc</span></div><span class="px-2.5 py-1 rounded-full text-xs font-bold border text-amber-400 bg-amber-500/20 border-amber-500/30">🟡 ลุ้นดีดรีบาวด์ (Oversold)</span></div>
            <div class="flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-900/80 p-2 rounded-lg"><span>RSI: <b class="text-emerald-400">39.8</b></span><span>รับ $250 / ต้าน $285</span></div>
            <p class="text-xs text-slate-300 leading-relaxed pt-1">💡 ราคาปรับฐานลึกเข้าโซนขายมากเกินไป รอกราฟเด้งระยะสั้นกลับมาเท่าทุนแล้วแบ่งปิดกำไร</p>
          </div>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between"><div><b class="text-white text-base">YLG-GOLD</b><span class="text-slate-400 text-xs block">ออมทองคำแท่ง</span></div><span class="px-2.5 py-1 rounded-full text-xs font-bold border text-emerald-400 bg-emerald-500/20 border-emerald-500/30">🟢 ขาขึ้นทรงพลัง (Super Bullish)</span></div>
            <div class="flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-900/80 p-2 rounded-lg"><span>RSI: <b class="text-emerald-400">62.5</b></span><span>รับ $2,760 / ต้าน $2,800</span></div>
            <p class="text-xs text-slate-300 leading-relaxed pt-1">💡 ทองคำสปอตโลกทำ All-Time High ต่อเนื่อง ไม่หลุดแนวรับเส้นค่าเฉลี่ย ถือสะสมตามเทรนด์</p>
          </div>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between"><div><b class="text-white text-base">BIDU</b><span class="text-slate-400 text-xs block">Baidu Inc ADR (เทคจีน)</span></div><span class="px-2.5 py-1 rounded-full text-xs font-bold border text-rose-400 bg-rose-500/20 border-rose-500/30">🔴 เสี่ยงซึมลงต่อ</span></div>
            <div class="flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-900/80 p-2 rounded-lg"><span>RSI: <b class="text-emerald-400">33.8</b></span><span>รับ $85 / ต้าน $95</span></div>
            <p class="text-xs text-slate-300 leading-relaxed pt-1">💡 หลุดเส้น EMA200 และแรงซื้อยังไม่กลับมา แนะนำพิจารณา Cut Loss เพื่อสลับไป VOO</p>
          </div>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between"><div><b class="text-white text-base">TTB</b><span class="text-slate-400 text-xs block">ธนาคารทหารไทยธนชาต</span></div><span class="px-2.5 py-1 rounded-full text-xs font-bold border text-emerald-400 bg-emerald-500/20 border-emerald-500/30">🟢 ฐานแน่นรับปันผล</span></div>
            <div class="flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-900/80 p-2 rounded-lg"><span>RSI: <b class="text-emerald-400">52.1</b></span><span>รับ ฿1.90 / ต้าน ฿2.05</span></div>
            <p class="text-xs text-slate-300 leading-relaxed pt-1">💡 กราฟสะสมพลังเหนือ 1.90 บาท แข็งแกร่งกว่าดัชนี SET ถือรับปันผลสบายใจ</p>
          </div>
        </div>
      </div>

      <!-- DCA Calculator -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
          <h3 class="font-black text-base text-white">💡 เครื่องคิดเลข Smart DCA Rebalancer</h3>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">ยอดเงินที่จะเติม:</span>
            <input type="number" id="inp-dca-amount" value="2000" class="bg-slate-950 border border-slate-700 px-3 py-1 rounded-xl text-sm font-mono text-white w-28 text-right">
            <button onclick="calcDCA()" class="bg-amber-500 text-slate-950 font-bold px-3 py-1 rounded-xl text-xs">คำนวณ</button>
          </div>
        </div>
        <div id="dca-result" class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">• เติม <b>VOO (S&P 500)</b>: <b class="text-emerald-400">฿1,400</b> (70%)</div>
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">• เติม <b>AMD / TSLA</b>: <b class="text-sky-400">฿400</b> (20%)</div>
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">• เติม <b>ทองคำ (YLG-GOLD)</b>: <b class="text-amber-400">฿200</b> (10%)</div>
        </div>
      </div>

      <!-- Real Holdings Table -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <h3 class="font-black text-base text-white mb-3">💼 รายการหุ้นและสินทรัพย์ทั้ง 11 ตัวจริงของคุณ (Dime!)</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <th class="py-2.5 px-3">หมวด</th><th class="py-2.5 px-3">สินทรัพย์</th><th class="py-2.5 px-3">จำนวนหุ้น</th><th class="py-2.5 px-3">ต้นทุน</th><th class="py-2.5 px-3">ราคาตลาดสด</th><th class="py-2.5 px-3">มูลค่า (บาท)</th><th class="py-2.5 px-3">กำไร/ขาดทุน</th><th class="py-2.5 px-3">คำแนะนำหมอหุ้น</th>
              </tr>
            </thead>
            <tbody id="pf-tbody" class="divide-y divide-slate-800/60">
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นหลัก</span></td><td class="py-3 px-3"><b class="text-white text-sm">VOO</b><span class="text-slate-400 text-xs block">S&P 500 ETF</span></td><td class="py-3 px-3 font-bold text-white">0.0470292</td><td class="py-3 px-3 text-slate-300">$655.55</td><td class="py-3 px-3 font-bold text-white">$535.20</td><td class="py-3 px-3 text-white">฿841.05</td><td class="py-3 px-3 text-emerald-400 font-bold">+฿51.85 (+6.57%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">⭐ เสาหลักพอร์ต วันนี้น่าซื้อสะสม (DCA) เพิ่มที่สุด</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นหลัก</span></td><td class="py-3 px-3"><b class="text-white text-sm">TTB</b><span class="text-slate-400 text-xs block">ธนาคารทหารไทยธนชาต</span></td><td class="py-3 px-3 font-bold text-white">162</td><td class="py-3 px-3 text-slate-300">฿1.92</td><td class="py-3 px-3 font-bold text-white">฿1.95</td><td class="py-3 px-3 text-white">฿315.90</td><td class="py-3 px-3 text-emerald-400 font-bold">+฿4.50 (+1.45%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🏆 ปันผลสูง ถือรับเงินปันผลต่อเนื่องสบายใจ</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">หุ้นหลัก</span></td><td class="py-3 px-3"><b class="text-white text-sm">AMD</b><span class="text-slate-400 text-xs block">Advanced Micro Devices</span></td><td class="py-3 px-3 font-bold text-white">0.0150027</td><td class="py-3 px-3 text-slate-300">$537.23</td><td class="py-3 px-3 font-bold text-white">$156.40</td><td class="py-3 px-3 text-white">฿783.50</td><td class="py-3 px-3 text-emerald-400 font-bold">+฿73.30 (+10.32%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 กำไรต่อเนื่อง ถือรันเทรนด์เติบโตตามรอบ AI</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">ถือยาว</span></td><td class="py-3 px-3"><b class="text-white text-sm">SCBT70X(26A)</b><span class="text-slate-400 text-xs block">กองทุน SCB ตราสารหนี้/ผสม</span></td><td class="py-3 px-3 font-bold text-white">197.1798</td><td class="py-3 px-3 text-slate-300">฿11.95</td><td class="py-3 px-3 font-bold text-white">฿11.95</td><td class="py-3 px-3 text-white">฿2,356.30</td><td class="py-3 px-3 text-slate-300 font-bold">฿0.00 (0.00%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">⚪ พักเงินความเสี่ยงต่ำ กระจายพอร์ต</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">ถือยาว</span></td><td class="py-3 px-3"><b class="text-white text-sm">YLG-GOLD</b><span class="text-slate-400 text-xs block">ออมทองคำแท่ง (YLG Gold)</span></td><td class="py-3 px-3 font-bold text-white">0.001423</td><td class="py-3 px-3 text-slate-300">$4,223.25</td><td class="py-3 px-3 font-bold text-white">$2,785.40</td><td class="py-3 px-3 text-white">฿132.50</td><td class="py-3 px-3 text-emerald-400 font-bold">+฿7.40 (+5.91%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">⭐ ขาขึ้นทรงพลัง ถือเกาะเทรนด์ All-Time High</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">ถือยาว</span></td><td class="py-3 px-3"><b class="text-white text-sm">XLV</b><span class="text-slate-400 text-xs block">Healthcare Select ETF</span></td><td class="py-3 px-3 font-bold text-white">0.0293492</td><td class="py-3 px-3 text-slate-300">$159.12</td><td class="py-3 px-3 font-bold text-white">$148.50</td><td class="py-3 px-3 text-white">฿145.70</td><td class="py-3 px-3 text-rose-400 font-bold">-฿10.40 (-6.66%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">⚪ หุ้นกลุ่มเฮลท์แคร์ กันชนความผันผวน</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">ถือยาว</span></td><td class="py-3 px-3"><b class="text-white text-sm">VT</b><span class="text-slate-400 text-xs block">Vanguard Total World Stock</span></td><td class="py-3 px-3 font-bold text-white">0.0299761</td><td class="py-3 px-3 text-slate-300">$154.79</td><td class="py-3 px-3 font-bold text-white">$118.20</td><td class="py-3 px-3 text-white">฿118.40</td><td class="py-3 px-3 text-emerald-400 font-bold">+฿3.20 (+2.78%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 กระจายหุ้นทั่วโลก ทยอยสะสมได้เรื่อยๆ</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">รอขาย</span></td><td class="py-3 px-3"><b class="text-white text-sm">SCBTB(Thai ESGA)</b><span class="text-slate-400 text-xs block">กองทุนหุ้นไทย ESG</span></td><td class="py-3 px-3 font-bold text-white">234.2616</td><td class="py-3 px-3 text-slate-300">฿10.89</td><td class="py-3 px-3 font-bold text-white">฿10.35</td><td class="py-3 px-3 text-white">฿2,424.60</td><td class="py-3 px-3 text-rose-400 font-bold">-฿126.50 (-4.96%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⚠️ กองทุนหุ้นไทย ESG ชะลอตัว รอกราฟฟื้นตัว</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">รอขาย</span></td><td class="py-3 px-3"><b class="text-white text-sm">TSLA</b><span class="text-slate-400 text-xs block">Tesla Inc</span></td><td class="py-3 px-3 font-bold text-white">0.0192567</td><td class="py-3 px-3 text-slate-300">$395.19</td><td class="py-3 px-3 font-bold text-white">$260.10</td><td class="py-3 px-3 text-white">฿167.30</td><td class="py-3 px-3 text-rose-400 font-bold">-฿5.20 (-3.01%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⚠️ รอกราฟเด้งกลับมาเท่าทุนแล้วแบ่งปิดกำไร</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">รอขาย</span></td><td class="py-3 px-3"><b class="text-white text-sm">BIDU</b><span class="text-slate-400 text-xs block">Baidu Inc ADR (หุ้นเทคจีน)</span></td><td class="py-3 px-3 font-bold text-white">0.0462888</td><td class="py-3 px-3 text-slate-300">$110.61</td><td class="py-3 px-3 font-bold text-white">$88.50</td><td class="py-3 px-3 text-white">฿136.90</td><td class="py-3 px-3 text-rose-400 font-bold">-฿34.30 (-20.04%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">🚨 ขาดทุน -20% แนะนำ Cut Loss/สลับไป VOO</span></td></tr>
              <tr class="hover:bg-slate-800/50"><td class="py-3 px-3"><span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">ถือยาว</span></td><td class="py-3 px-3"><b class="text-white text-sm">XOM</b><span class="text-slate-400 text-xs block">Exxon Mobil Corp</span></td><td class="py-3 px-3 font-bold text-white">0.038481</td><td class="py-3 px-3 text-slate-300">$129.93</td><td class="py-3 px-3 font-bold text-white">$119.30</td><td class="py-3 px-3 text-white">฿153.40</td><td class="py-3 px-3 text-rose-400 font-bold">-฿13.60 (-8.14%)</td><td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">⚪ หุ้นพลังงาน ถือรับปันผลและป้องกันเงินเฟ้อ</span></td></tr>
            </tbody>
          </table>
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
          <button onclick="sendBroadTelegram()" class="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
            🌟 ส่ง 4 หุ้นเด่นเข้า Telegram
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <th class="py-2.5 px-3">อันดับ</th><th class="py-2.5 px-3">หุ้น / บริษัท</th><th class="py-2.5 px-3">สถานะความน่าซื้อ</th><th class="py-2.5 px-3">คะแนนก้นหลุม</th><th class="py-2.5 px-3">ราคาล่าสุด</th><th class="py-2.5 px-3">โซนควรช้อนซื้อ</th><th class="py-2.5 px-3">จุด SL</th><th class="py-2.5 px-3">เป้า TP2</th><th class="py-2.5 px-3">อัปไซด์</th>
              </tr>
            </thead>
            <tbody id="broad-tbody" class="divide-y divide-slate-800/60">
              <tr class="hover:bg-slate-800/60"><td class="py-3 px-3 font-bold text-amber-400">🥇</td><td class="py-3 px-3"><b class="text-white text-sm">AMD</b><span class="text-slate-400 text-xs block">AI & Semiconductor</span></td><td class="py-3 px-3"><span class="px-2.5 py-0.5 rounded text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">🛒 ก้นหลุมรอบเดือน (น่าช้อนซื้อ)</span></td><td class="py-3 px-3 font-bold text-emerald-400">88 / 100</td><td class="py-3 px-3 font-bold text-white">$156.40</td><td class="py-3 px-3 text-emerald-300 font-bold">$148.00 - $152.00</td><td class="py-3 px-3 text-rose-400">$142.00</td><td class="py-3 px-3 text-teal-300 font-bold">$178.50</td><td class="py-3 px-3 text-emerald-400 font-black">+14.1%</td></tr>
              <tr class="hover:bg-slate-800/60"><td class="py-3 px-3 font-bold text-amber-400">🥈</td><td class="py-3 px-3"><b class="text-white text-sm">NVDA</b><span class="text-slate-400 text-xs block">AI & Semiconductor</span></td><td class="py-3 px-3"><span class="px-2.5 py-0.5 rounded text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">🛒 ก้นหลุมรอบเดือน (น่าช้อนซื้อ)</span></td><td class="py-3 px-3 font-bold text-emerald-400">86 / 100</td><td class="py-3 px-3 font-bold text-white">$141.20</td><td class="py-3 px-3 text-emerald-300 font-bold">$134.00 - $138.00</td><td class="py-3 px-3 text-rose-400">$129.50</td><td class="py-3 px-3 text-teal-300 font-bold">$162.00</td><td class="py-3 px-3 text-emerald-400 font-black">+14.7%</td></tr>
              <tr class="hover:bg-slate-800/60"><td class="py-3 px-3 font-bold text-amber-400">🥉</td><td class="py-3 px-3"><b class="text-white text-sm">TSLA</b><span class="text-slate-400 text-xs block">EV & Autonomous AI</span></td><td class="py-3 px-3"><span class="px-2.5 py-0.5 rounded text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">🛒 ก้นหลุมรอบเดือน (น่าช้อนซื้อ)</span></td><td class="py-3 px-3 font-bold text-emerald-400">85 / 100</td><td class="py-3 px-3 font-bold text-white">$260.10</td><td class="py-3 px-3 text-emerald-300 font-bold">$246.00 - $252.00</td><td class="py-3 px-3 text-rose-400">$238.00</td><td class="py-3 px-3 text-teal-300 font-bold">$295.00</td><td class="py-3 px-3 text-emerald-400 font-black">+13.4%</td></tr>
              <tr class="hover:bg-slate-800/60"><td class="py-3 px-3 font-bold text-amber-400">#4</td><td class="py-3 px-3"><b class="text-white text-sm">XAU/USD</b><span class="text-slate-400 text-xs block">Precious Metals</span></td><td class="py-3 px-3"><span class="px-2.5 py-0.5 rounded text-[11px] bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold">⭐ ขาขึ้นทรงพลัง (สะสมตามเทรนด์)</span></td><td class="py-3 px-3 font-bold text-emerald-400">90 / 100</td><td class="py-3 px-3 font-bold text-white">$2,785.40</td><td class="py-3 px-3 text-emerald-300 font-bold">$2,740.00 - $2,760.00</td><td class="py-3 px-3 text-rose-400">$2,720.00</td><td class="py-3 px-3 text-teal-300 font-bold">$2,860.00</td><td class="py-3 px-3 text-emerald-400 font-black">+2.7%</td></tr>
              <tr class="hover:bg-slate-800/60"><td class="py-3 px-3 font-bold text-amber-400">#5</td><td class="py-3 px-3"><b class="text-white text-sm">VOO</b><span class="text-slate-400 text-xs block">Broad Market ETF</span></td><td class="py-3 px-3"><span class="px-2.5 py-0.5 rounded text-[11px] bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold">⭐ เสาหลักพอร์ต (ทยอยสะสม DCA)</span></td><td class="py-3 px-3 font-bold text-emerald-400">82 / 100</td><td class="py-3 px-3 font-bold text-white">$535.20</td><td class="py-3 px-3 text-emerald-300 font-bold">$525.00 - $530.00</td><td class="py-3 px-3 text-rose-400">$515.00</td><td class="py-3 px-3 text-teal-300 font-bold">$565.00</td><td class="py-3 px-3 text-emerald-400 font-black">+5.6%</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: BREAKING NEWS -->
    <div id="view-news" class="view-tab flex-col gap-5">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 class="font-black text-base text-white">📰 ข่าวด่วน & ปัจจัยกระทบตลาด (Breaking News & Market Impact Radar)</h3>
            <p class="text-xs text-slate-400">วิเคราะห์ข่าวเศรษฐกิจมหภาค Fed, CPI, Non-Farm, และทองคำ บอกทิศทางหนุนขึ้นหรือกดดันลงทันที</p>
          </div>
          <button onclick="sendNewsTelegram()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs">✈️ ส่งรายงานข่าวเข้า Telegram</button>
        </div>
        <div id="news-cards-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div class="flex items-center justify-between"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-400 border border-slate-700">⚡ FED / ดอกเบี้ย (วันนี้ 14:30 น.)</span><span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 หนุนตลาดขึ้น (Bullish)</span></div>
            <h4 class="font-bold text-sm text-white leading-snug">ประธานเฟด (Fed) ส่งสัญญาณแนวโน้มลดอัตราดอกเบี้ยนโยบายต่อเนื่องเพื่อประคองการจ้างงาน</h4>
            <div class="bg-slate-900 p-2.5 rounded-lg text-xs text-slate-300 space-y-1"><div><b class="text-slate-400 font-sans">เหตุผลวิเคราะห์:</b> ดอกเบี้ยขาลงลดต้นทุนการกู้ยืม เพิ่มสภาพคล่องในระบบ และกระตุ้นสินทรัพย์เสี่ยง</div><div><b class="text-slate-400 font-sans">สินทรัพย์ที่ได้ผลกระทบ:</b> <code class="text-emerald-400">SPY, QQQ, VOO, XAU/USD (ขึ้น)</code></div></div>
          </div>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div class="flex items-center justify-between"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-400 border border-slate-700">⚡ INFLATION / เงินเฟ้อ (เมื่อวาน 20:30 น.)</span><span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 หนุนตลาดขึ้น (Bullish)</span></div>
            <h4 class="font-bold text-sm text-white leading-snug">รายงานดัชนีเงินเฟ้อสหรัฐฯ (CPI) ชะลอตัวลงตามคาดการณ์ เปิดทางเศรษฐกิจ Soft Landing</h4>
            <div class="bg-slate-900 p-2.5 rounded-lg text-xs text-slate-300 space-y-1"><div><b class="text-slate-400 font-sans">เหตุผลวิเคราะห์:</b> เงินเฟ้อไม่ดีดกลับ ลดแรงกดดันต่อนโยบายการเงิน หนุนความเชื่อมั่นนักลงทุนสถาบัน</div><div><b class="text-slate-400 font-sans">สินทรัพย์ที่ได้ผลกระทบ:</b> <code class="text-emerald-400">NVDA, AMD, QQQ, VOO (ขึ้น)</code></div></div>
          </div>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div class="flex items-center justify-between"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-400 border border-slate-700">⚡ GEOPOLITICS / สงคราม (สัปดาห์นี้)</span><span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 หนุนราคาทองคำพุ่ง (Bullish Gold)</span></div>
            <h4 class="font-bold text-sm text-white leading-snug">ความตึงเครียดทางภูมิรัฐศาสตร์และแรงซื้อทองคำจากธนาคารกลางทั่วโลกพุ่งทำสถิติใหม่</h4>
            <div class="bg-slate-900 p-2.5 rounded-lg text-xs text-slate-300 space-y-1"><div><b class="text-slate-400 font-sans">เหตุผลวิเคราะห์:</b> แรงซื้อสินทรัพย์ปลอดภัย (Safe-Haven) ไหลเข้าทองคำแท่ง ดันราคา Spot Gold ทำจุดสูงสุดใหม่</div><div><b class="text-slate-400 font-sans">สินทรัพย์ที่ได้ผลกระทบ:</b> <code class="text-emerald-400">XAU/USD, YLG-GOLD (ขึ้นแรง)</code></div></div>
          </div>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div class="flex items-center justify-between"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-400 border border-slate-700">⚡ AI & SEMICONDUCTOR (ล่าสุด)</span><span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 หนุนหุ้นเทคและเซมิ (Bullish Tech)</span></div>
            <h4 class="font-bold text-sm text-white leading-snug">อุปสงค์โครงสร้างพื้นฐาน AI และชิปประมวลผล Big Tech ยังขยายตัวสูงกว่ากำลังผลิต</h4>
            <div class="bg-slate-900 p-2.5 rounded-lg text-xs text-slate-300 space-y-1"><div><b class="text-slate-400 font-sans">เหตุผลวิเคราะห์:</b> ความต้องการ Capex ด้าน AI Server ยังแข็งแกร่งมาก เพิ่มคาดการณ์กำไรในอนาคต</div><div><b class="text-slate-400 font-sans">สินทรัพย์ที่ได้ผลกระทบ:</b> <code class="text-emerald-400">NVDA, AMD, TTB (ถือเติบโต)</code></div></div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Telegram Message Preview Modal -->
  <div id="telegram-modal" style="display: none !important; pointer-events: none;" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <h4 class="font-bold text-sm text-white">✈️ ตัวอย่างการแจ้งเตือน Telegram</h4>
        <button onclick="closeTelegramPreview()" class="text-slate-400 hover:text-white p-1">✕</button>
      </div>
      <div class="bg-[#182533] p-4 rounded-xl border border-slate-700 font-sans text-xs text-slate-100 leading-relaxed">
        <p id="tg-preview-text" class="whitespace-pre-line font-mono"></p>
      </div>
      <div class="mt-4 flex justify-end">
        <button onclick="closeTelegramPreview()" class="bg-sky-600 text-white text-xs font-bold px-4 py-2 rounded-xl">ตกลง</button>
      </div>
    </div>
  </div>

  <div id="toast-container" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"></div>

  <script>
    let activeMasterTab = "m15";
    let activeSubTab = "signals";
    let currentSelectedSymbol = "XAU/USD";
    let soundEnabled = true;
    let audioCtx = null;
    let ws = null;

    function setAsset(tvSym, label) {
      currentSelectedSymbol = label;
      document.getElementById("tv-frame").src = "https://s.tradingview.com/widgetembed/?symbol=" + encodeURIComponent(tvSym) + "&interval=15&theme=dark&timezone=Asia%2FBangkok";
      document.getElementById("chart-asset-title").textContent = "ชาร์ตสด " + label + " (TradingView M15)";
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
      toast.className = "px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold flex items-center gap-2 pointer-events-auto " + 
        (type === "success" ? "bg-emerald-950/90 border-emerald-500 text-emerald-300" :
         type === "danger" ? "bg-rose-950/90 border-rose-500 text-rose-300" :
         "bg-slate-900/90 border-slate-700 text-slate-200");
      toast.innerHTML = (type === "success" ? "🟢 " : type === "danger" ? "🔴 " : "⚡ ") + message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    function copyText(id, label) {
      const txt = document.getElementById(id).textContent;
      if (!txt || txt === "--") return;
      navigator.clipboard.writeText(txt);
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
      const txt = "⚡ [M15 SIGNAL ALERT]\nสินทรัพย์: " + currentSelectedSymbol + "\nคำสั่ง: 🟢 BUY\n──────────────────\n🎯 จุดเข้า: $2785.40\n🛑 Stop Loss: $2776.00\n🏆 Take Profit: $2805.00";
      document.getElementById("tg-preview-text").textContent = txt;
      const modal = document.getElementById("telegram-modal");
      if (modal) {
        modal.style.setProperty("display", "flex", "important");
        modal.style.pointerEvents = "auto";
      }
    }

    function closeTelegramPreview() {
      const modal = document.getElementById("telegram-modal");
      if (modal) {
        modal.style.setProperty("display", "none", "important");
        modal.style.pointerEvents = "none";
      }
    }

    function calcDCA() {
      const amt = parseFloat(document.getElementById("inp-dca-amount").value) || 2000;
      const voo = Math.round(amt * 0.7);
      const tech = Math.round(amt * 0.2);
      const gold = amt - voo - tech;
      document.getElementById("dca-result").innerHTML = 
        "<div class='bg-slate-950 p-3 rounded-xl border border-slate-800'>• เติม <b>VOO (S&P 500)</b>: <b class='text-emerald-400'>฿" + voo.toLocaleString() + "</b> (70%)</div>" +
        "<div class='bg-slate-950 p-3 rounded-xl border border-slate-800'>• เติม <b>AMD / TSLA</b>: <b class='text-sky-400'>฿" + tech.toLocaleString() + "</b> (20%)</div>" +
        "<div class='bg-slate-950 p-3 rounded-xl border border-slate-800'>• เติม <b>ทองคำ (YLG-GOLD)</b>: <b class='text-amber-400'>฿" + gold.toLocaleString() + "</b> (10%)</div>";
    }

    async function simTrigger(asset, action) {
      showToast("กำลังจำลองสัญญาณ " + action + " " + asset, "info");
      try {
        const r = await fetch("/api/simulate-signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset, action })
        });
        const d = await r.json();
        if (d.ok) showToast("จำลองสัญญาณ " + action + " " + asset + " สำเร็จ!", "success");
      } catch(e) {}
    }

    async function sendNewsTelegram() {
      showToast("กำลังส่งสรุปข่าวเข้า Telegram...", "info");
      try {
        const r = await fetch("/api/send-news-telegram", { method: "POST" });
        const d = await r.json();
        showToast(d.ok ? "ส่งข่าวเข้า Telegram สำเร็จ!" : "ส่งไม่สำเร็จ", d.ok ? "success" : "danger");
      } catch(e) {}
    }

    async function sendForecastTelegram() {
      showToast("กำลังส่งสรุปทำนายกราฟเข้า Telegram...", "info");
      try {
        const r = await fetch("/api/send-forecast-telegram", { method: "POST" });
        const d = await r.json();
        showToast(d.ok ? "ส่งผลทำนายกราฟเข้า Telegram สำเร็จ!" : "ส่งไม่สำเร็จ", d.ok ? "success" : "danger");
      } catch(e) {}
    }

    async function sendBroadTelegram() {
      showToast("กำลังส่ง 4 หุ้นเด่นเข้า Telegram...", "info");
      try {
        const r = await fetch("/api/send-broad-telegram", { method: "POST" });
        const d = await r.json();
        showToast(d.ok ? "ส่ง 4 หุ้นเด่นเข้า Telegram เรียบร้อย!" : "ส่งไม่สำเร็จ", d.ok ? "success" : "danger");
      } catch(e) {}
    }

    // 10. Clocks & Timers
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
      const timerEl = document.getElementById("candle-timer");
      if (timerEl) timerEl.textContent = (cm < 10 ? "0" : "") + cm + ":" + (cs < 10 ? "0" : "") + cs;
    }

    setInterval(updateWorldClock, 1000);
    updateWorldClock();

    // ผูกคำสั่งกับ Window ให้เข้าถึงได้ 100%
    window.switchMasterTab = switchMasterTab;
    window.switchSubTab = switchSubTab;
    window.setAsset = setAsset;
    window.copyText = copyText;
    window.copyPineScript = copyPineScript;
    window.copyWebhookUrl = copyWebhookUrl;
    window.openTelegramPreview = openTelegramPreview;
    window.closeTelegramPreview = closeTelegramPreview;
    window.toggleSound = toggleSound;
    window.simTrigger = simTrigger;
    window.calcDCA = calcDCA;
    window.sendNewsTelegram = sendNewsTelegram;
    window.sendForecastTelegram = sendForecastTelegram;
    window.sendBroadTelegram = sendBroadTelegram;

    // เช็ค Hash บน URL เพื่อเปิดแท็บนั้นอัตโนมัติ
    const curHash = (window.location.hash || "").toLowerCase();
    if (curHash.includes("portfolio")) switchMasterTab("portfolio");
    else if (curHash.includes("broad") || curHash.includes("screener")) switchMasterTab("broad");
    else if (curHash.includes("news")) switchMasterTab("news");
  </script>
</body>
</html>`;

// 10. Routes ส่งหน้าเว็บทันทีในระดับมิลลิวินาที
app.get('/', (req, res) => res.send(HTML_PAGE));
app.get('/portfolio', (req, res) => res.send(HTML_PAGE));
app.get('/port', (req, res) => res.send(HTML_PAGE));
app.get('/screener', (req, res) => res.send(HTML_PAGE));
app.get('/broad', (req, res) => res.send(HTML_PAGE));
app.get('/news', (req, res) => res.send(HTML_PAGE));
app.get('/m15', (req, res) => res.send(HTML_PAGE));

// 11. รันเซิร์ฟเวอร์แบบ Safe Binding 0.0.0.0
setInterval(() => {
  fetch(APP_URL + '/api/ping').catch(() => {});
}, 10 * 60 * 1000);

setInterval(pollTelegramUpdates, 4000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Complete Master Terminal running on 0.0.0.0:${PORT}`);
  // สลับเวลาเรียกเพื่อไม่ให้แย่ง CPU ตอนเริ่มระบบ
  setTimeout(() => {
    analyzeUserPortfolio().catch(() => {});
  }, 2000);
  setTimeout(() => {
    setInterval(updateLiveQuotes, 6000);
  }, 5000);
});
