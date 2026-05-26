/**
 * 验证工具——用 SHA-256 哈希代替明文，防止源码泄露后凭据直接暴露。
 *
 * 原理：
 *  - 源码中只存哈希值，不存原始密码/设备 ID
 *  - 运行时比对的是 "用户输入 + 盐" 的哈希
 *  - 攻破方式：仍需逆向 APK 拿到盐和哈希，再暴力穷举
 */

import * as Crypto from 'expo-crypto';

// ===== 哈希常量（预计算，不存原文） =====

/** 开发者密码 "devPAss" 的 SHA-256 */
const DEV_PASSWORD_HASH = '02260b71c5a6a2bec0fdc89c2646750a96bcdf992231cd66cb0a6715433b8220';

/** 盐：用于设备 ID 哈希，对抗彩虹表 */
const SALT = 'SJTU_Secret_2026';

/**
 * 目标设备 Android ID 加盐后的 SHA-256。
 * 原始值为 "61f032bc314cd103"，加盐后哈希如下：
 */
const TARGET_DEVICE_HASH = 'c8f5859a1b63fee36d7b97014df9b6badceb0e45b3484ec62915523b0d327f6b';

// ===== 工具函数 =====

/** 计算 SHA-256 摘要 */
async function sha256(str: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    str
  );
}

/** 验证开发者密码 */
export async function verifyDevPassword(input: string): Promise<boolean> {
  const hash = await sha256(input);
  return hash === DEV_PASSWORD_HASH;
}

/** 验证设备 ID（加盐） */
export async function verifyDeviceId(deviceId: string): Promise<boolean> {
  const hash = await sha256(deviceId + SALT);
  return hash === TARGET_DEVICE_HASH;
}
