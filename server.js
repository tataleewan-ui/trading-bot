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
const API_KEY = process.env.TWELVE_DATA_API_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SYMBOLS = ['XAU/USD', 'QQQ', 'NVDA', 'AAPL'];

app.use(cors());
app.use(express.json());

let signalHistory = [];

// 1. คำนวณ EMA & ATR
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let emaArray = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    emaArray.push(prices[i] * k + emaArray[i - 1] * (1 - k));
  }
  return emaArray;
}

function calculateATR(candles, period = 14) {
  let tr = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const recentTR = tr.slice(-period);
  return recentTR.reduce((sum, val) => sum + val, 0) / period;
}

// 2. วิเคราะห์สัญญาณแท่งเทียน 15 นาที
function analyzeMarket(candles, ticker) {
  if (candles.length < 205) return null;
  const closes = candles.map(c => c.close);
  const ema200 = calculateEMA(closes, 200);
  const ema21 = calculateEMA(closes, 21);
  const atr = calculateATR(candles, 14);

  const lastIdx = candles.length - 1;
  const currentClose = closes[lastIdx];
  const currentOpen = candles[lastIdx].open;
  const currentEMA200 = ema200[lastIdx];
  const currentEMA21 = ema21[lastIdx];
  const prevClose = closes[lastIdx - 1];
  const prevEMA21 = ema21[lastIdx - 1];

  const isUptrend = currentClose > currentEMA200 && currentOpen > currentEMA200;
  const isBuyTrigger = prevClose <= prevEMA21 && currentClose > currentEMA21;

  const isDowntrend = currentClose < currentEMA200 && currentOpen < currentEMA200;
  const isSellTrigger = prevClose >= prevEMA21 && currentClose < currentEMA21;

  const slDist = atr * 1.5;

  if (isUptrend && isBuyTrigger) {
    return {
      id: "sig_" + Date.now(),
      ticker,
      action: 'BUY',
      timeframe: '15m',
      entry: Number(currentClose.toFixed(2)),
      sl: Number((currentClose - slDist).toFixed(2)),
      tp1: Number((currentClose + slDist * 1.5).toFixed(2)),
      tp2: Number((currentClose + slDist * 2.5).toFixed(2)),
      risk: Number(slDist.toFixed(2)),
      time: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })
    };
  }

  if (isDowntrend && isSellTrigger) {
    return {
      id: "sig_" + Date.now(),
      ticker,
      action: 'SELL',
      timeframe: '15m',
      entry: Number(currentClose.toFixed(2)),
      sl: Number((currentClose + slDist).toFixed(2)),
      tp1: Number((currentClose - slDist * 1.5).toFixed(2)),
      tp2: Number((currentClose - slDist * 2.5).toFixed(2)),
      risk: Number(slDist.toFixed(2)),
      time: new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })
    };
  }
  return null;
}

// 3. ส่งเข้า Telegram Bot
async function sendTelegramAlert(signal) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  const isBuy = signal.action === 'BUY';
  const text = `
${isBuy ? '🟢' : '🔴'} <b>สัญญาณเทรด M15: ${signal.ticker}</b>
──────────────────
📊 <b>คำสั่ง:</b> ${isBuy ? 'BUY (ซื้อ)' : 'SELL (ขาย)'}
💵 <b>ราคาเข้า:</b> <code>${signal.entry}</code>
🛑 <b>Stop Loss (SL):</b> <code>${signal.sl}</code> (เสี่ยง ~$${signal.risk})
🎯 <b>เป้า 1 (TP1):</b> <code>${signal.tp1}</code> (RR 1:1.5)
🎯 <b>เป้า 2 (TP2):</b> <code>${signal.tp2}</code> (RR 1:2.5)
⏰ <b>เวลา:</b> ${signal.time}
──────────────────
💡 <i>ตั้ง SL ทันทีหลังเข้า เมื่อถึง TP1 ให้เลื่อน SL มากันทุน</i>
  `.trim();

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });
  } catch (err) {
    console.error('Telegram Error:', err.message);
  }
}

// 4. สแกนตลาด 15 นาทีจริง
async function scanMarket() {
  if (!API_KEY) return;
  for (const sym of SYMBOLS) {
    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=15min&outputsize=220&apikey=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.values) {
        const candles = data.values.reverse().map(v => ({
          datetime: v.datetime,
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close)
        }));
        const sig = analyzeMarket(candles, sym);
        if (sig) {
          signalHistory.unshift(sig);
          if (signalHistory.length > 30) signalHistory.pop();
          wss.clients.forEach(c => {
            if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'NEW_SIGNAL', data: sig }));
          });
          await sendTelegramAlert(sig);
        }
      }
    } catch (e) {
      console.error(e.message);
    }
  }
}

// 5. หน้าเว็บ Dashboard ในตัว (เปิดดูผ่านมือถือหรือคอมได้เลย)
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M15 Realtime Pro Trading Assistant</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-4 flex flex-col items-center">
  <div class="max-w-4xl w-full">
    <div class="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
      <h1 class="text-xl font-bold text-amber-400">⚡ M15 Realtime Trading Assistant</h1>
      <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">🟢 ONLINE 24/7</span>
    </div>
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6">
      <h2 class="text-sm font-semibold text-slate-400 mb-2">สัญญาณล่าสุด</h2>
      <div id="signal-box" class="text-slate-300 font-mono text-sm leading-relaxed">
        ⏳ ระบบกำลังสแกนราคาจริงของ XAU/USD และหุ้นสหรัฐฯ ทุก 1 นาที...
      </div>
    </div>
    <div class="h-96 rounded-2xl overflow-hidden border border-slate-800">
      <iframe src="https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=15&theme=dark" class="w-full h-full border-0"></iframe>
    </div>
  </div>
</body>
</html>
  `);
});

app.get('/api/signals', (req, res) => res.json(signalHistory));

server.listen(PORT, () => {
  console.log('🚀 Server started on port ' + PORT);
  setInterval(scanMarket, 60 * 1000);
  scanMarket();
});
