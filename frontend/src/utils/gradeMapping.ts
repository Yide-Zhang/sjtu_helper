/** 百分制 → 等级制转换 */
export function numericToGrade(score: number): string | null {
  if (score < 0 || score > 100) return null;
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A−';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B−';
  if (score >= 67) return 'C+';
  if (score >= 65) return 'C';
  if (score >= 62) return 'C−';
  if (score >= 60) return 'D';
  return 'F';
}
