#!/usr/bin/env node
// -*- coding: utf-8 -*-
/*
分析新榜“公众号低粉爆文榜”当天的爆文数据（JavaScript/Node.js 版本）
流程：
- 使用 cookies.json 通过 Playwright 登录态，打开热榜页 https://a.newrank.cn/trade/media/hotList
+- 点击导出数据，下载当天的爆文数据（Excel/CSV）
- 使用 xlsx 读取导出的数据，完成 TOP10、内容类型占比、规律与标题公式分析
- 输出 JSON，方便后续复用
*/

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { chromium } = require('playwright');

// 简易命令行参数解析
function arg(name, def) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv.length > idx + 1) return process.argv[idx + 1];
  return def;
}

const COOKIES_PATH = arg('--cookies', null);
const OUTPUT_PATH = arg('--output', path.resolve(process.cwd(), 'results.json'));

if (!COOKIES_PATH) {
  console.error('请通过 --cookies 指定 cookies.json 路径');
  process.exit(1);
}

function loadCookies(cookiesPath) {
  const raw = fs.readFileSync(cookiesPath, 'utf-8');
  let data = JSON.parse(raw);
  let cookies = [];
  if (Array.isArray(data)) {
    cookies = data;
  } else if (data && data.cookies && Array.isArray(data.cookies)) {
    cookies = data.cookies;
  } else if (data && data.name && data.value && data.domain) {
    cookies = [data];
  }
  // 只保留必要字段
  return cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    httpOnly: Boolean(c.httpOnly),
    secure: Boolean(c.secure),
  }));
}

function toPlaywrightCookies(c) {
  // Playwright 需要的字段与传入格式一致
  const out = {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
  };
  if (c.expires) out.expires = Number(c.expires);
  if (c.sameSite) out.sameSite = c.sameSite;
  return out;
}

async function exportDataWithCookies(cookiesPath) {
  const cookies = loadCookies(cookiesPath);
  if (!cookies || cookies.length === 0) {
    throw new Error('无有效的 cookies，请检查 cookies.json 格式。');
  }
  const pwCookies = cookies.map(toPlaywrightCookies);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const downloadsDir = path.resolve(process.cwd(), 'downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
  const finalPath = path.resolve(downloadsDir, `hotlist_${dateStr}.xlsx`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await page.goto('https://a.newrank.cn/trade/media/hotList', { waitUntil: 'networkidle' });
    // 注入 cookies：需要在目标域下注入
    for (const ck of pwCookies) {
      try {
        await context.addCookies([ck]);
      } catch (e) {
        // 忽略个别 cookie 注入失败
      }
    }
    await page.reload({ waitUntil: 'networkidle' });

    const selectors = [
      'text=导出数据',
      "button:has-text('导出数据')",
      "a:has-text('导出数据')",
      'text=Export Data',
    ];
    let downloaded = null;
    for (const sel of selectors) {
      try {
        const [dl] = await Promise.all([
          page.waitForEvent('download'),
          page.click(sel, { timeout: 10000 }).catch(() => null)
        ]);
        if (dl) {
          downloaded = dl;
          break;
        }
      } catch (e) {
        // try next selector
      }
    }
    if (!downloaded) {
      // 尝试再点击一次常用选择器
      const [dl] = await Promise.all([
        page.waitForEvent('download'),
        page.click('text=导出数据', { timeout: 15000 })
      ]);
      downloaded = dl;
    }
    if (!downloaded) throw new Error('导出数据下载未触发，请检查页面文本与选择器。');
    await downloaded.saveAs(finalPath);
    await browser.close();
    return finalPath;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

function detectColumnMappings(columns) {
  const titleCol = columns.find(c => String(c).toLowerCase().includes('标题') || String(c).toLowerCase().includes('title'));
  const scoreCol = columns.find(c => String(c).toLowerCase().includes('爆文指数') || String(c).toLowerCase().includes('指数') || String(c).toLowerCase().includes('score'));
  const typeCol = columns.find(c => String(c).toLowerCase().includes('内容类型') || String(c).toLowerCase().includes('type') || String(c).toLowerCase().includes('分类'));
  return { titleCol, scoreCol, typeCol };
}

function tokenizeTitles(titles) {
  const stopwords = new Set(['的','了','在','和','是','就','都','及','把','也','不','有','我们','你','我','他','她']);
  const freq = new Map();
  titles.forEach(t => {
    if (typeof t !== 'string') return;
    const parts = t.match(/[\u4e00-\u9fa5]+|[A-Za-z0-9]+/g) || [];
    parts.forEach(p => {
      if (stopwords.has(p)) return;
      freq.set(p, (freq.get(p) || 0) + 1);
    });
  });
  const arr = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]);
  return arr;
}

function buildTitleFormulas(titles, topWords) {
  const formulas = [];
  const hasDigits = titles.some(t => /\d+/.test(t));
  if (topWords && topWords.length > 0) {
    const baseTerms = topWords.slice(0, 5).map(x => x[0]);
    if (baseTerms.length > 0) {
      formulas.push('数字/数量 + 关键词的组合模板，如：{数字}{关键词}，如：5个技巧');
      formulas.push('关键词短句表达：{关键词}秘籍 / {关键词}攻略');
    }
  }
  if (hasDigits) {
    formulas.push('数字 + 关键字/动作模板，如：5步完成、3招速成');
  }
  formulas.push('包含高频关键词的短句式（如：如何掌握{关键词}、{关键词}完全指南）');
  // 去重
  return Array.from(new Set(formulas));
}

function analyzeTopics(titles) {
  const ideas = [
    '情感表达日记：如何在日常生活中记录真实情绪并获得理解',
    '倾诉练习：给出一个安全的发泄/倾诉模板，帮助对方表达困扰',
    '陪伴的力量：如何成为一个愿意听你说话的朋友',
    '日常小事的共情：如何把日常琐事变成可讨论的话题',
    '搭子话题清单：无压力的聊天开场白与话题接龙',
  ];
  // 可以简单做一个过滤，若标题包含情感/陪伴等，优先相关选题
  const filtered = ideas.filter(i => true);
  return filtered.length ? filtered : ideas;
}

async function main() {
  try {
    const exportPath = await exportDataWithCookies(COOKIES_PATH);
    console.log('导出文件:', exportPath);
    // 读取数据
    const wb = XLSX.readFile(exportPath);
    const sheet = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: null });
    if (!rows || rows.length === 0) throw new Error('导出数据为空');
    const cols = Object.keys(rows[0]);
    const { titleCol, scoreCol, typeCol } = detectColumnMappings(cols) || {};
    // Fallbacks
    const tCol = titleCol || cols[0];
    const sCol = scoreCol || null;
    const tyCol = typeCol || (cols.length > 1 ? cols[1] : null);

    // 读取与整理
    const items = rows.map(r => {
      const t = r[tCol];
      const score = sCol ? Number(r[sCol]) || 0 : 0;
      const tp = tyCol ? r[tyCol] : '未知';
      return { title: t, score, type: tp };
    }).filter(it => it.title !== undefined && it.title !== null);

    // TOP10
    let top10 = [];
    if (sCol) {
      top10 = items.slice().sort((a,b) => b.score - a.score).slice(0, 10);
    } else {
      top10 = items.slice(0, 10);
    }

    // 内容类型占比
    const typeCounts = {};
    items.forEach(it => {
      const k = it.type || '未知';
      typeCounts[k] = (typeCounts[k] || 0) + 1;
    });
    const total = items.length || 1;
    const typeDistribution = {};
    for (const k of Object.keys(typeCounts)) {
      typeDistribution[k] = (typeCounts[k] / total) * 100;
    }

    // 标题规律
    const titles = items.map(i => i.title);
    const topWords = tokenizeTitles(titles).slice(0, 20);
    const formulas = buildTitleFormulas(titles, topWords);
    const topicIdeas = analyzeTopics(titles);

    const analysis = {
      generated_at: new Date().toISOString(),
      source_export: exportPath,
      top10,
      type_distribution: typeDistribution,
      title_word_frequencies: topWords,
      title_formulas: formulas,
      topic_ideas: topicIdeas,
    };

    // 输出
    const outDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(analysis, null, 2), 'utf-8');
    console.log('分析完成，结果输出到:', OUTPUT_PATH);
  } catch (err) {
    console.error('错误:', err && err.message ? err.message : err);
  }
}

main();
