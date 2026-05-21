// ⚠️ 通知功能依赖原生模块，需要 expo-dev-client（Dev Build）才能运行
//    Expo Go 不支持 expo-notifications，使用前请先执行:
//    npx expo run:android
//    或使用 EAS Build 打包后安装

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// 配置通知的行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 请求通知权限
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '交大作业提醒',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('未能获取通知权限！');
      return;
    }
    
    // 如果需要服务端推送，可以获取 token，这里我们只要本地推送
    // token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    // 模拟器上跑会报这个，不要紧
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// 根据作业列表调度本地通知
export async function scheduleAssignmentNotifications(assignments: any[]) {
  // 先取消所有之前调度的通知，避免重复
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  assignments.forEach(async (assignment) => {
    if (!assignment.display_date || assignment.has_submitted_submissions) return;

    const dueDate = new Date(assignment.display_date);
    if (dueDate < now) return; // 已经过期

    const timeDiff = dueDate.getTime() - now.getTime();
    
    // 提前 24 小时提醒
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (timeDiff > twentyFourHours) {
      const triggerDate = new Date(dueDate.getTime() - twentyFourHours);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '作业即将截止 (24小时内)',
          body: `【${assignment.course_name || '未知课程'}】的作业 ${assignment.name} 明天就要交啦！`,
          sound: true,
        },
        trigger: triggerDate, // 在某些 Expo 版本可以直接传 date，或者用秒/时间配置
      });
    }

    // 提前 1 小时提醒
    const oneHour = 60 * 60 * 1000;
    if (timeDiff > oneHour) {
      const triggerDate = new Date(dueDate.getTime() - oneHour);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '最后期限警报 (1小时内)',
          body: `【${assignment.course_name || '未知课程'}】的作业 ${assignment.name} 还有不到1小时截止！快冲！`,
          sound: true,
        },
        trigger: triggerDate,
      });
    }
  });
}
