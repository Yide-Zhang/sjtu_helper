import * as Device from 'expo-device';

export interface DeviceBatteryGuide {
  brand: string;
  guideTitle: string;
  guideSteps: string[];
}

export function getBatteryOptimizationGuide(): DeviceBatteryGuide {
  const brand = (Device.brand || '').toLowerCase();
  const manufacturer = (Device.manufacturer || '').toLowerCase();

  // OPPO / OnePlus / Realme
  if (brand.includes('oppo') || manufacturer.includes('oppo') || brand.includes('oneplus') || manufacturer.includes('oneplus') || brand.includes('realme') || manufacturer.includes('realme')) {
    return {
      brand: Device.manufacturer || Device.brand || 'OPPO',
      guideTitle: 'ColorOS 电池优化设置',
      guideSteps: [
        '打开「设置」→「应用」→「应用管理」',
        '找到「SJTU Helper」→ 点击进入',
        '选择「耗电管理」',
        '将「智能优化后台运行」改为「**完全允许后台行为**」',
        '返回上一页 → 开启「**自启动**」',
        '如手机开启「免打扰」模式：设置 → 声音与振动 → 免打扰 → **允许优先打扰** → 添加「SJTU Helper」',
      ],
    };
  }

  // Xiaomi / Redmi / POCO
  if (brand.includes('xiaomi') || manufacturer.includes('xiaomi') || brand.includes('redmi') || brand.includes('poco')) {
    return {
      brand: Device.manufacturer || Device.brand || 'Xiaomi',
      guideTitle: 'MIUI 电池优化设置',
      guideSteps: [
        '打开「手机管家」→「应用管理」→「权限」',
        '点击「**自启动管理**」→ 找到「SJTU Helper」→ 开启',
        '返回 → 「**省电策略**」→ 选择「**无限制**」',
        '打开「设置」→「应用设置」→「应用管理」',
        '找到「SJTU Helper」→「省电策略」→「**无限制**」',
        '如手机开启「免打扰」模式：设置 → 声音与振动 → 免打扰 → **允许应用例外** → 添加「SJTU Helper」',
      ],
    };
  }

  // Huawei
  if (brand.includes('huawei') || manufacturer.includes('huawei') || brand.includes('honor')) {
    return {
      brand: Device.manufacturer || Device.brand || 'Huawei',
      guideTitle: 'EMUI / HarmonyOS 电池优化设置',
      guideSteps: [
        '打开「手机管家」→「**应用启动管理**」',
        '找到「SJTU Helper」→ 改为「**手动管理**」',
        '**全部开启**：允许自启动、允许关联启动、允许后台活动',
        '打开「设置」→「应用」→「应用管理」',
        '找到「SJTU Helper」→「耗电详情」→「**启动管理**」→ 全部允许',
        '如手机开启「免打扰」模式：设置 → 通知 → 免打扰 → **允许例外应用** → 添加「SJTU Helper」',
      ],
    };
  }

  // Samsung
  if (brand.includes('samsung') || manufacturer.includes('samsung')) {
    return {
      brand: Device.manufacturer || Device.brand || 'Samsung',
      guideTitle: 'One UI 电池优化设置',
      guideSteps: [
        '打开「设置」→「电池和设备维护」→「电池」',
        '点击「**后台使用限制**」→ 找到「SJTU Helper」→ **关闭「自动优化」**',
        '返回 →「**不受限制的应用**」→ 添加「SJTU Helper」',
        '打开「设置」→「应用」→ 找到「SJTU Helper」→「电池」→「**不受限制**」',        '如手机开启「免打扰」模式：设置 → 通知 → **请勿打扰** → **允许例外** → 添加「SJTU Helper」',      ],
    };
  }

  // Vivo / iQOO
  if (brand.includes('vivo') || manufacturer.includes('vivo') || brand.includes('iqoo')) {
    return {
      brand: Device.manufacturer || Device.brand || 'vivo',
      guideTitle: 'Funtouch OS / OriginOS 电池优化设置',
      guideSteps: [
        '打开「设置」→「电池」→「**后台耗电管理**」',
        '找到「SJTU Helper」→ 选择「**允许后台运行**」',
        '返回 →「**自启动**」→ 开启「SJTU Helper」',
        '打开「i管家」→「电池管理」→「**后台耗电管理**」→ 设为「**允许**」',
      ],
    };
  }

  // Meizu
  if (brand.includes('meizu') || manufacturer.includes('meizu')) {
    return {
      brand: Device.manufacturer || Device.brand || 'Meizu',
      guideTitle: 'Flyme 电池优化设置',
      guideSteps: [
        '打开「设置」→「应用管理」→「应用列表」',
        '找到「SJTU Helper」→「权限管理」',
        '开启「**后台运行**」和「**自启动**」',
        '如手机开启「免打扰」模式：设置 → 通知 → 免打扰 → **允许应用通知** → 添加「SJTU Helper」',
      ],
    };
  }

  // 通用（Google / 原生 Android / 其他）
  return {
    brand: Device.manufacturer || Device.brand || 'Android',
    guideTitle: '电池优化设置',
    guideSteps: [
      '打开「设置」→「应用」→「特殊应用权限」',
      '点击「**电池优化**」→ 选择「**所有应用**」',
      '找到「SJTU Helper」→ 改为「**不优化**」',
      '打开「设置」→「应用」→ 找到「SJTU Helper」→「**后台限制**」→ 选「**无限制**」',
      '如手机开启「免打扰」模式：设置 → 通知 → 免打扰 → **允许应用通知** → 添加「SJTU Helper」',
    ],
  };
}

export function getDeviceInfoString(): string {
  const brand = Device.brand || 'unknown';
  const manufacturer = Device.manufacturer || 'unknown';
  const model = Device.modelName || 'unknown';
  return `${manufacturer} ${model} (品牌: ${brand})`;
}
