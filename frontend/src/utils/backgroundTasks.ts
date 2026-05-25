// ⚠️ 后台任务依赖原生模块，需要 Dev Build（npx expo run:android）才能运行
//    Expo Go 不支持 expo-task-manager / expo-background-fetch

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, getBgSnapshot, setBgSnapshot, BgSnapshot, getIsjtuNoticeCache, setIsjtuNoticeCache, getJAccountUsername } from './storage';
import { fetchAllUpcomingAssignments, CanvasAssignment } from '../api/canvas';
import { ensureMailAuth, fetchInbox } from '../api/mail';
import { fetchIsjtuNotices } from '../api/isjtu';

export const BACKGROUND_FETCH_TASK = 'sjtu-helper-background-fetch';

// ── 注册/刷新后台任务 ──
export async function registerBgTask(intervalMinutes: number) {
  if (intervalMinutes <= 0) {
    // 用户关闭了后台刷新
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK).catch(() => {});
    return;
  }

  try {
    // 先取消旧的，避免重复注册
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK).catch(() => {});
  } catch {}

  await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: intervalMinutes * 60, // 秒，Android 最短 15 分钟
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

// ── 注册任务处理器 ──
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    await performBackgroundCheck();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.warn('[BgTask] Error:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── 核心检查逻辑 ──
async function performBackgroundCheck() {
  const token = await getToken();
  const oldSnap = await getBgSnapshot();
  const newSnap: BgSnapshot = {
    mailCount: 0,
    mailPreview: '',
    assignCount: 0,
    assignIds: [],
    timestamp: Date.now(),
  };

  // 1. 检查 Canvas 作业/公告
  if (token) {
    try {
      const data = await fetchAllUpcomingAssignments();
      if (data && data.length > 0) {
        newSnap.assignCount = data.length;
        newSnap.assignIds = data.map(a => a.id);

        // 和上次快照对比，有新作业则发通知
        const oldIds = oldSnap?.assignIds || [];
        const newItems = data.filter(a => !oldIds.includes(a.id));
        for (const item of newItems) {
          const isAnnouncement = item.is_canvas_announcement ||
            (item.submission_types?.includes('none') || item.submission_types?.includes('not_graded'));
          // 只通知待交作业，不通知纯公告
          if (!isAnnouncement && !item.has_submitted_submissions && item.display_date) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '📝 新作业提醒',
                body: `【${item.course_name || '未知课程'}】${item.name || '未命名作业'}`,
                sound: true,
              },
              trigger: { channelId: 'default' },
            });
          }
        }
      }
    } catch {}
  }

  // 2. 检查邮箱新邮件
  try {
    const mailAuthed = await ensureMailAuth();
    if (mailAuthed) {
      const result = await fetchInbox(1, 0);
      if (result && result.messages && result.messages.length > 0) {
        const latest = result.messages[0];
        newSnap.mailCount = result.messages.length;
        newSnap.mailPreview = `${latest.from?.name || latest.from?.address}: ${latest.subject || ''}`;

        // 和上次快照比较，有新邮件则通知
        if (oldSnap && oldSnap.mailPreview !== newSnap.mailPreview) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '📧 新邮件',
              body: newSnap.mailPreview,
              sound: true,
            },
            trigger: { channelId: 'default' },
          });
        }
      }
    }
  } catch {}

  // 3. 检查 i.sjtu 待阅通知（调课提醒等）
  try {
    const currentUser = await getJAccountUsername();
    if (currentUser) {
      const notices = await fetchIsjtuNotices(1, 50);
      if (notices && notices.length > 0) {
        const newIds = notices.map(n => n.id).filter(Boolean) as string[];

        // 读取缓存的 ID 列表及对应的用户名
        const cached = await getIsjtuNoticeCache();

        if (cached && cached.username === currentUser) {
          // 缓存存在且属于当前用户 → 只提醒新出现的通知
          const oldIds = new Set(cached.data.ids);
          const freshNotices = notices.filter(n => n.id && !oldIds.has(n.id));
          for (const notice of freshNotices) {
            const title = notice.isTiaoKe
              ? `📅 调课提醒：${notice.tiaoKeInfo?.course || ''}`
              : '📢 新教务通知';
            await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body: notice.title.substring(0, 100),
                sound: true,
              },
              trigger: { channelId: 'default' },
            });
          }
        }
        // else: 无缓存或缓存属于其他用户 → 不发送通知
        //       静默更新缓存（丢弃旧数据，从当前数据开始记录）

        // 更新缓存（无论是否发送通知，都更新为当前拉取的 ID 列表）
        await setIsjtuNoticeCache(newIds);
      }
    }
  } catch {}

  // 写入新快照
  await setBgSnapshot(newSnap);
}
