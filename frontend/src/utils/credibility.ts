import { Review } from '../api/courseCommunity';

// ========== 可信度计算 ==========

/** 可信度计算结果 */
export interface CredibilityResult {
  /** 可信度等级：高/中/低 */
  level: string;
  /** 可信度分数 0-100 */
  score: number;
  /** 平均评分 1-5 */
  avgRating: number;
  /** 评价总数 */
  count: number;
}

/** 计算可信度（含平均评分） */
export const calculateCredibility = (reviews: Review[]): CredibilityResult => {
  if (reviews.length === 0) return { level: '低', score: 0, avgRating: 0, count: 0 };

  // 因子1：时效性
  const now = new Date();
  const recencyScores = reviews.map(r => {
    const createdAt = new Date(r.created_at);
    if (isNaN(createdAt.getTime())) return 50; // 无法解析时给中值
    const monthsDiff = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());
    const score = Math.max(0, Math.min(100, 100 * Math.pow(0.8, Math.max(0, monthsDiff - 6) / 6)));
    return score;
  });
  const recencyAvg = recencyScores.reduce((a, b) => a + b, 0) / recencyScores.length;

  // 因子2：评价数量
  const volumeScore = Math.min(100, (reviews.length / 10) * 100);

  // 因子3：一致性
  const ratings = reviews.map(r => r.rating);
  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance = ratings.reduce((sum, r) => sum + (r - avgRating) ** 2, 0) / ratings.length;
  const stdDev = Math.sqrt(variance);
  const consensusScore = Math.max(0, 100 - stdDev * 30);

  // 加权总分
  const total = recencyAvg * 0.30 + volumeScore * 0.35 + consensusScore * 0.35;
  const level = total >= 70 ? '高' : total >= 40 ? '中' : '低';

  return {
    level,
    score: Math.round(total * 100) / 100,
    avgRating: Math.round(avgRating * 100) / 100,
    count: reviews.length,
  };
};

/** 评分转星级显示 */
export const ratingToStars = (rating: number): string => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? '½' : '';
  return '★'.repeat(full) + half + '☆'.repeat(5 - full - (half ? 1 : 0));
};

// ========== 课程分组 ==========

export interface AggregatedTeacherInfo {
  avg: number;
  level: string;
  score: number;
  totalReviews: number;
  perCourseCount: number;
}

export interface GroupedCourseResult {
  code: string;
  name: string;
  teachers: Array<{
    id: number;
    name: string;
    teacher: string;
    code: string;
    rating: { count: number; avg: number };
    categories?: string[];
  }>;
}

/** 按课程名分组（同课号不同老师合并） */
export const groupByCourseName = (
  items: Array<{
    id: number;
    code: string;
    name: string;
    teacher: string;
    rating: { count: number; avg: number };
    categories?: string[];
  }>
): GroupedCourseResult[] => {
  const map = new Map<string, GroupedCourseResult>();
  for (const item of items) {
    const key = item.code;
    if (!map.has(key)) {
      map.set(key, { code: item.code, name: item.name, teachers: [] });
    }
    map.get(key)!.teachers.push({
      id: item.id,
      name: item.teacher,
      teacher: item.teacher,
      code: item.code,
      rating: item.rating,
      categories: item.categories,
    });
  }
  return Array.from(map.values());
};
