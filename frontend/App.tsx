import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { AppNavigator } from './src/navigation/AppNavigator';
import { getBackgroundInterval } from './src/utils/storage';
import { registerBgTask } from './src/utils/backgroundTasks';
import { registerForPushNotificationsAsync } from './src/utils/notifications';

// ── 阻止特定未捕获错误/异常刷屏（但其他错误必须透传）──
if (typeof ErrorUtils !== 'undefined') {
  const origHandler = typeof ErrorUtils.getGlobalHandler === 'function' ? ErrorUtils.getGlobalHandler() : null;
  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    if (error?.message?.includes("status provided (0) is outside the range")) {
      return; // 静默过滤 onnxruntime 等库的 Response 构造错误
    }
    // 透传给原始 handler（如果没有原始 handler，至少 console.error）
    if (origHandler) {
      origHandler(error, isFatal);
    } else {
      console.error(error);
    }
  });
}
// 同时也过滤 console.error 中该错误的重复打印
if (typeof console !== 'undefined') {
  const origConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    const msg = args.map(a => String(a)).join(' ');
    if (msg.includes("status provided (0) is outside the range")) return;
    origConsoleError(...args);
  };
}

export default function App() {
  useEffect(() => {
    // 启动时通知权限 + 注册后台任务
    (async () => {
      try {
        await registerForPushNotificationsAsync();
        const interval = await getBackgroundInterval();
        if (interval > 0) {
          await registerBgTask(interval);
        }
      } catch (e) {
        // Expo Go 下会报错，静默忽略
        console.log('[App] 后台任务/通知初始化跳过（Expo Go）');
      }
    })();
  }, []);

  return <AppNavigator />;
}
