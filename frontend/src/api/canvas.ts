import axios from 'axios';
import { getToken } from '../utils/storage';

const CANVAS_BASE_URL = 'https://oc.sjtu.edu.cn/api/v1';

export const canvasApi = axios.create({
  baseURL: CANVAS_BASE_URL,
  timeout: 10000,
});

// 请求拦截器：自动注入我们存储过的 Access Token
canvasApi.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

/** 检查是否有有效的 Canvas Token（不发送网络请求） */
export const hasCanvasToken = async (): Promise<boolean> => {
  const token = await getToken();
  return !!token;
};

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  has_submitted_submissions: boolean;
  course_id: number;
  submission_types: string[];
  // 以下是为了适配需求，我们自定义扩展的字段
  course_name?: string;
  status?: 'submitted' | 'unsubmitted' | 'graded';
  display_date?: string | null;
  is_canvas_announcement?: boolean;
}

/**
 * 获取用户当前所有的活跃课程
 */
export const getActiveCourses = async () => {
  const response = await canvasApi.get('/users/self/courses', {
    params: {
      'enrollment_state': 'active',
      'include[]': 'term',
      'per_page': 100,
    }
  });
  return response.data;
};

/**
 * 提取某个特定课程下的作业列表
 */
export const getAssignmentsForCourse = async (courseId: number): Promise<CanvasAssignment[]> => {
  const response = await canvasApi.get(`/courses/${courseId}/assignments`, {
    params: {
      'include[]': 'submission',
      'per_page': 100,
    }
  });
  return response.data;
};

/**
 * 提取某个特定课程下的公告列表（Canvas Discussion Topics API）
 */
export const getAnnouncementsForCourse = async (courseId: number): Promise<CanvasAssignment[]> => {
  try {
    const response = await canvasApi.get(`/courses/${courseId}/discussion_topics`, {
      params: {
        'only_announcements': true,
        'per_page': 100,
        'include[]': 'sections',
      }
    });
    // 将公告数据映射为 CanvasAssignment 兼容格式
    return response.data.map((topic: any) => ({
      id: topic.id,
      name: topic.title || '(无标题)',
      description: topic.message || '',
      due_at: topic.delayed_post_at || topic.posted_at || null,
      unlock_at: topic.posted_at || null,
      lock_at: topic.lock_at || null,
      has_submitted_submissions: false,
      course_id: courseId,
      submission_types: ['none'],
      is_canvas_announcement: true,
    }));
  } catch (err) {
    return [];
  }
};

/**
 * 汇总方案：获取所有活跃课程的作业+公告，排序后返回
 */
export const fetchAllUpcomingAssignments = async () => {
  if (!(await hasCanvasToken())) {
    console.warn('[Canvas] No token, skipping assignment fetch');
    return [];
  }
  try {
    const courses = await getActiveCourses();
    let allAssignments: CanvasAssignment[] = [];

    // 过滤掉无效或被禁止的课程
    const validCourses = courses.filter((c: any) => c.id && c.name);

    // 并发拉取各个课程的作业和公告
    const coursePromises = validCourses.map(async (course: any) => {
      try {
        const [assignments, announcements] = await Promise.all([
          getAssignmentsForCourse(course.id),
          getAnnouncementsForCourse(course.id),
        ]);

        // 处理作业：挂载课程名、判断提交状态
        const mappedAssignments = assignments.map((assign: any) => {
          const sub = assign.submission;
          let isActuallySubmitted = sub ?
            (sub.submitted_at != null || ['submitted', 'graded', 'pending_review'].includes(sub.workflow_state)) :
            !!assign.has_submitted_submissions;

          return {
            ...assign,
            course_name: course.name,
            has_submitted_submissions: isActuallySubmitted,
          };
        });

        // 处理公告：挂载课程名
        const mappedAnnouncements = announcements.map((ann: any) => ({
          ...ann,
          course_name: course.name,
        }));

        return [...mappedAssignments, ...mappedAnnouncements];
      } catch (err) {
        return [];
      }
    });

    const resultsArray = await Promise.all(coursePromises);
    resultsArray.forEach(res => {
      allAssignments = allAssignments.concat(res);
    });

    // 处理综合日期并排序
    return allAssignments
      .map(assign => {
        let displayDate = assign.due_at;
        if (!displayDate) {
          displayDate = assign.unlock_at || assign.lock_at || null;
        }

        return {
          ...assign,
          display_date: displayDate
        };
      })
      .sort((a, b) => {
        if (!a.display_date) return 1;
        if (!b.display_date) return -1;
        return new Date(a.display_date).getTime() - new Date(b.display_date).getTime();
      });
  } catch (error) {
    console.error('Failed to fetch assignments:', error);
    throw error;
  }
};
