// Simulate the TypeScript parseXuanKeContent logic
// Test with simulated red text content

function extractRoundText(contentHtml) {
  const contentMatch = contentHtml.match(/<div class="v_news_content">([\s\S]*?)<\/div>\s*<\/div>/);
  const inner = contentMatch ? contentMatch[1] : contentHtml;
  const strongBlocks = inner.match(/<strong[^>]*>[\s\S]*?<\/strong>/g) || [];
  const redParts = [];
  for (const block of strongBlocks) {
    if (!/color:red/i.test(block)) continue;
    const spans = block.match(/<span[^>]*>([\s\S]*?)<\/span>/g) || [];
    const text = spans.map(s => s.replace(/<[^>]+>/g, '').trim()).join('').replace(/\u200b/g, '');
    if (text) redParts.push(text);
  }
  if (redParts.length) return redParts.join('');
  return inner.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200b/g, '');
}

function parseXuanKeContent(contentHtml, pubYear, pubMonth) {
  const rawText = extractRoundText(contentHtml);
  console.log('=== Raw text ===');
  console.log(rawText);
  console.log();

  const tp = /(?:\d{4}年)?(\d+)月(\d+)日（(?:夏季学期)?第(\d+)周周[一二三四五六日]）(\d+:\d+)\s*-\s*(?:\d{4}年)?(\d+)月(\d+)日（(?:夏季学期)?第(\d+)周周[一二三四五六日]）(\d+:\d+)/g;

  const knownRounds = [
    { match: (s) => s.includes('试选'), name: '试选' },
    { match: (s) => s.includes('海选'), name: '海选' },
    { match: (s) => /抢选\s*[（(]\s*第一/.test(s), name: '抢选（第一阶段）' },
    { match: (s) => /抢选\s*[（(]\s*第二/.test(s), name: '抢选（第二阶段）' },
    { match: (s) => s.includes('抢选') && !s.includes('阶段'), name: '抢选' },
    { match: (s) => s.includes('第三轮选课'), name: '第三轮选课' },
  ];

  const segments = rawText.split(/[。]/);
  const rounds = [];

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;

    let name = '';
    for (const kn of knownRounds) {
      if (kn.match(s)) { name = kn.name; break; }
    }
    if (!name) {
      const rm = s.match(/(\d+)[、．]([^：:]*?)\s*[：:]/);
      if (rm) {
        const candidate = rm[2].trim();
        if (candidate.length <= 15) name = candidate;
      }
    }
    if (!name) {
      console.log('  ❌ No name for:', s.substring(0, 50));
      continue;
    }

    tp.lastIndex = 0;
    const tm = tp.exec(s);
    if (tm) {
      const sm = parseInt(tm[1]), em = parseInt(tm[5]);
      const sy = (pubMonth >= 9 && sm <= 3) ? pubYear + 1 : pubYear;
      const ey = (pubMonth >= 9 && em <= 3) ? pubYear + 1 : pubYear;
      rounds.push({
        round: name,
        start: `${sy}-${String(sm).padStart(2, '0')}-${String(parseInt(tm[2])).padStart(2, '0')}T${tm[4]}`,
        end: `${ey}-${String(em).padStart(2, '0')}-${String(parseInt(tm[6])).padStart(2, '0')}T${tm[8]}`,
        startWeek: parseInt(tm[3]),
        endWeek: parseInt(tm[7]),
      });
      console.log(`  ✅ ${name}: ${rounds[rounds.length-1].start} ~ ${rounds[rounds.length-1].end}`);
    } else {
      console.log(`  ⚠️  No time match for: ${s.substring(0, 50)}`);
    }
  }
  return rounds.length > 0 ? rounds : null;
}

// Test with simulated HTML content
const testHtml = `<div class="v_news_content">
  <strong style="color:red">
    <span>1、试选时间：2025年12月15日（第16周周一）13:00～12月18日（第16周周四）16:00</span>
  </strong>
  <strong style="color:red">
    <span>2、海选时间：2025年12月20日（第16周周五）13:00～12月25日（第17周周三）16:00</span>
  </strong>
  <strong style="color:red">
    <span>3、抢选（第一阶段）：2025年12月30日（第17周周二）13:00～2026年1月3日（第17周周六）16:00</span>
  </strong>
  <strong style="color:red">
    <span>4、抢选（第二阶段）：2026年1月5日（第18周周一）13:00～1月8日（第18周周四）16:00</span>
  </strong>
  <strong style="color:red">
    <span>5、第三轮选课（暂定）：2026年2月10日（第1周周二）13:00～2月14日（第1周周六）16:00</span>
  </strong>
</div>`;

console.log('Test 1: Standard format with full-width parentheses');
const r1 = parseXuanKeContent(testHtml, 2025, 12);
console.log('Rounds found:', r1?.length || 0);
console.log();

// Test 2: Try half-width parentheses
const test2Html = testHtml.replace(/（/g, '(').replace(/）/g, ')');
console.log('Test 2: Half-width parentheses');
const r2 = parseXuanKeContent(test2Html, 2025, 12);
console.log('Rounds found:', r2?.length || 0);
console.log();

// Test 3: No parentheses (抢选第一阶段 directly)
const test3Html = testHtml.replace(/抢选（第一阶段）/g, '抢选第一阶段').replace(/抢选（第二阶段）/g, '抢选第二阶段');
console.log('Test 3: No parentheses (抢选第一阶段)');
const r3 = parseXuanKeContent(test3Html, 2025, 12);
console.log('Rounds found:', r3?.length || 0);
console.log();

// Test 4: What if the text uses just "抢选阶段一" or similar
const test4Html = testHtml.replace(/抢选（第一阶段）/g, '抢选第一阶段').replace(/抢选（第二阶段）/g, '抢选第二阶段');
console.log('Test 4: Alternative format');
const r4 = parseXuanKeContent(test4Html, 2025, 12);
console.log('Rounds found:', r4?.length || 0);
