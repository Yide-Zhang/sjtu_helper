// 测试排序逻辑

const safeTime = (s) => {
  if (!s) return Infinity;
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? Infinity : d.getTime();
};

// 模拟考试数据
const exams = [
  { kcmc: '考试A', kssj: '2026-06-10 14:00:00' },
  { kcmc: '考试B', kssj: '2026-05-20 08:00:00' },
  { kcmc: '考试C', kssj: '2026-07-01 09:00:00' },
  { kcmc: '考试D', kssj: '2026-04-15 10:00:00' },
  { kcmc: '考试E', kssj: '' },
  { kcmc: '考试F', kssj: null },
];

console.log('=== 考试排序测试 ===');
console.log('排序前:', exams.map(e => `${e.kcmc}(${e.kssj})`).join(', '));

const sorted = [...exams].sort((a, b) => safeTime(a.kssj) - safeTime(b.kssj));
console.log('排序后:', sorted.map(e => `${e.kcmc}(${e.kssj || '无'})`).join(', '));

// 测试每个日期的解析结果
console.log('\n=== 日期解析详情 ===');
for (const e of exams) {
  const t = safeTime(e.kssj);
  console.log(`  ${e.kcmc}: kssj="${e.kssj}" → safeTime=${t} → ${t === Infinity ? 'Infinity' : new Date(t).toISOString()}`);
}

// 模拟 HomeScreen 混合排序（作业+考试）
console.log('\n=== 混合排序测试 ===');
const assignments = [
  { title: '作业1', display_date: '2026-05-25' },
  { title: '作业2', display_date: '2026-06-15' },
  { title: '作业3', display_date: '2026-04-20' },
  { title: '作业4', display_date: null },
];

const withDue = assignments
  .filter(a => a.display_date)
  .map(a => ({ type: 'assignment', data: a, date: safeTime(a.display_date) }));
const examItems = exams
  .filter(e => e.kcmc)
  .map(e => ({ type: 'exam', data: e, date: safeTime(e.kssj) }));
const withoutDue = assignments
  .filter(a => !a.display_date)
  .map(a => ({ type: 'assignment', data: a, date: Infinity }));

const allWithDate = [...withDue, ...examItems].sort((a, b) => a.date - b.date);
const combined = [...allWithDate, ...withoutDue];

console.log('排序后合并列表:');
combined.forEach(item => {
  const label = item.type === 'exam' ? `[考试] ${item.data.kcmc}` : `[作业] ${item.data.title}`;
  const dateStr = item.date === Infinity ? '无日期' : new Date(item.date).toISOString().split('T')[0];
  console.log(`  ${label} → ${dateStr}`);
});

// 确认排序是否正确
console.log('\n=== 验证排序 ===');
let prevTime = -Infinity;
let ok = true;
for (const item of allWithDate) {
  if (item.date < prevTime) {
    console.log(`  排序错误: ${item.type} 在 ${new Date(item.date).toISOString()} 应晚于 ${new Date(prevTime).toISOString()}`);
    ok = false;
  }
  prevTime = item.date;
}
console.log(ok ? '  ✓ 排序正确' : '  ✗ 排序有误');
