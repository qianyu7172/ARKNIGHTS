// 从真实页面源码中抽出概率模型，跑 100 万次抽卡验证
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/\/\/ #region gacha-math([\s\S]*?)\/\/ #endregion/);
if (!m) { console.error('找不到 gacha-math 标记段'); process.exit(1); }

const api = new Function(m[1] + '; return { sixRate, drawRarity, SIX_BASE, PITY_START, HARD_PITY };')();

const results = [];
const check = (name, ok, extra) => results.push({ name, ok: !!ok, extra: extra === undefined ? '' : String(extra) });

// 1. 关键点位
check('第 50 抽仍为 2%', Math.abs(api.sixRate(49) - 0.02) < 1e-9, api.sixRate(49));
check('第 51 抽升到 4%', Math.abs(api.sixRate(50) - 0.04) < 1e-9, api.sixRate(50));
check('第 99 抽为 100%', api.sixRate(98) === 1, api.sixRate(98));

// 2. 蒙特卡洛
const N = 1000000;
const counts = { 3: 0, 4: 0, 5: 0, 6: 0 };
let since = 0;
let streak = 0;
let maxStreak = 0;
let sixPulls = [];

for (let i = 0; i < N; i++) {
  const r = api.drawRarity(since, Math.random());
  counts[r]++;
  if (r === 6) {
    sixPulls.push(since + 1);
    since = 0;
    streak = 0;
  } else {
    since++;
    streak++;
    if (streak > maxStreak) maxStreak = streak;
  }
}

const rate = (n) => (counts[n] / N) * 100;
const avg = sixPulls.reduce((a, b) => a + b, 0) / sixPulls.length;

check('六星出率 2.6%~3.2%', rate(6) >= 2.6 && rate(6) <= 3.2, rate(6).toFixed(2) + '%');
check('五星出率 7.5%~8.5%', rate(5) >= 7.5 && rate(5) <= 8.5, rate(5).toFixed(2) + '%');
check('四星出率 49%~51%', rate(4) >= 49 && rate(4) <= 51, rate(4).toFixed(2) + '%');
check('三星出率 39%~41%', rate(3) >= 39 && rate(3) <= 41, rate(3).toFixed(2) + '%');
check('四星+五星+六星+三星 = 100%', Math.abs(rate(3) + rate(4) + rate(5) + rate(6) - 100) < 0.01, '');
check('最长连败不超过 99', maxStreak <= 99, maxStreak);
check('平均出货 30~40 抽', avg >= 30 && avg <= 40, avg.toFixed(2) + ' 抽');
// 连败达到 90+ 的概率极低（约百万分之一），有 70+ 的干旱期即可说明软保底在起作用
check('存在 70+ 连败（软保底区间被走到）', maxStreak >= 70, maxStreak);

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.extra ? '  [' + r.extra + ']' : ''));
}
console.log('\n样本：' + N.toLocaleString() + ' 抽，六星 ' + counts[6] + ' 个');
console.log((results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);
