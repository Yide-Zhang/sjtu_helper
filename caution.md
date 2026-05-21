# 点名签到 (RollCall) 研究备忘

## 系统架构

```
Canvas LTI Launch
  ↓ POST (OAuth 1.0 HMAC-SHA1 签名)
https://mlearning.sjtu.edu.cn/lms-auth-sjtu/lti/redirectRollcallRequest
  ↓ 302 重定向（带上 JWT Token）
https://mlearning.sjtu.edu.cn/lms/rollcall/?token=eyJ...&courseCode=87080&roleCode=StudentEnrollment
  ↓ Vue SPA 加载
  ↓ AJAX 请求（mlearning 有自己的 session，跟 Canvas 无关）
https://mlearning.sjtu.edu.cn/lms-lti-rollcall-sjtu/sign/records/?courseCode=87080
```

## API 端点（从 JS bundle 中找到）

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/sign/records/` | 获取签到记录 |
| GET | `/rollcall/existentB` | 检查当前是否有签到（学生轮询用） |
| GET | `/rollcall/{signHistoryId}/qrB` | 获取签到二维码（学生） |
| GET | `/rollcall/{signHistoryId}/qr` | 获取签到二维码（教师） |
| GET | `/rollcall/findInfo` | 查签到信息 |
| POST | `/rollcall/publish/` | 发起签到（教师） |

## 获取 Canvas Session Cookie（jc token）的完整流程

### 步骤

1. Canvas 登录页 → 点击 `#jaccount` 按钮 → 跳转 jAccount OAuth
2. jAccount 登录页 → 填写账密 + 验证码 → POST `/jaccount/ulogin`
3. 登录成功 → 302 回 Canvas OAuth callback → Canvas 设置 session cookie
4. 用 Canvas cookie 访问 LTI 工具页 → 页面内有表单 POST 到 mlearning
5. mlearning 建立 session → 可调 API

### 验证码识别（ONNX 模型）

模型位置: `frontend/assets/nn_model.onnx`
输入: `input.1`, shape `[1, 1, 40, 110]`, type `tensor(float)`
输出: 5 个 tensor（`218`~`222`），shape: 前 4 个 `[1, 26]`, 最后 1 个 `[1, 27]`

**关键预处理（易错点）:**
- resize 到 110x40（不是 100x40！）
- 转灰度（luminosity 方法）
- **二值化阈值 156**（≥156 → 1.0 白，< 156 → 0.0 黑）
- 转 `float32`
- reshape 到 `[1, 1, 40, 110]`
- Python ONNX 输入 key 是 `input.1`（不是 `input`）

## UI组件与样式修改注意事项（防踩坑）

1. **避免为单一需求暴力拆解公共组件**
   - **错误发生背景**：在实现“紧急度测试”的UI效果时，（前序模型）直接在 `MainScreen.tsx` 和 `RenderTestScreen.tsx` 中手动拆解了卡片内部布局代码（写了一堆原样的 `<View>` 和 `substring`）以套用外部的发光效果，甚至还在 `RenderTestScreen` 里特意新增了独立的“作业/考试紧急度测试”大板块。这导致卡片本身的内容渲染出现不一致（破坏了原始组件的展示逻辑）。
   - **正确做法**：如果需要对现有的卡片（如 `AssignmentSummaryCard`、`ExamCard`）添加样式或动态发光效果，应该直接修改或扩充该卡片组件的 Props（如新增支持 `urgency` 或 `外发光包裹层`），而不是摒弃原组件、在调用处重新将该组件的内部标签再写一遍。

2. **测试页面整合而非另起炉灶**
   - 不要为了展示某个效果在 `RenderTestScreen` 中另建一个独立的测试 section。紧急度测试应该**归入对应的业务 section 内**（例如作业紧急度测试卡片放在“作业” section 中），作为该区块的前几条测试项，而不是单独开一个“作业紧急度测试” section 与原本的业务 section 并列。
   - 这样既保持了布局整洁，又能直观对比动态紧急度测试项与静态固定日期测试项的外观差异。

3. **不要使用默认 Alert 提示样式**
   - 默认的 `Alert.alert()` 弹窗在不同平台风格不同且难以定制，视觉上很突兀。
   - **正确做法**：使用 `Modal` + 自定义布局（白色圆角卡片 + 图标 + 按钮），参考 `MainScreen.tsx` 的刷新确认弹窗或 `SettingsScreen.tsx` 的开发者密码弹窗样式。
   - 统一样式规范：`modalOverlay`（半透明黑色遮罩）、`modalContent`（白色圆角卡片、`width: '80%'`、`maxWidth: 300`）、`modalTitle`（18号粗体）、`modalDesc`（14号灰色）、`modalButtons`（横向排列、`gap: 12`）、`modalCancelBtn`/`modalConfirmBtn`（圆角按钮）。
   - `SettingsScreen.tsx` 中的"清除所有本地数据"已使用此规范的自定义弹窗，包含确认 → 清除中（ActivityIndicator）→ 成功/失败三个状态。

Python 代码示例:

Python 代码示例:
```python
def preprocess(img):
    img = img.convert('L').resize((110, 40), Image.LANCZOS)
    pixels = np.array(img, dtype=np.float32)
    binary = np.where(pixels >= 156, 1.0, 0.0).astype(np.float32)
    return binary.reshape(1, 1, 40, 110)

outputs = model.run(None, {'input.1': tensor})
```

### 易错点

1. **Canvas 需要先点 `#jaccount` 按钮**，不能直接打开 jAccount 登录页，否则 OAuth state 会不匹配
2. **jAccount 登录必须带验证码**，OCR 模型输入尺寸是 110×40 不是 100×40
3. **二值化阈值 156** 必须跟 RN 端 `captcha.ts` 一致，否则识别率极低
4. **`errno:0` 后的 redirect URL 是相对路径**（`/jaccount/jalogin?...`），需要拼接 `https://jaccount.sjtu.edu.cn`
5. **mlearning 的 session 和 Canvas 的 session 是两套**，有 Canvas cookie 不代表能直接调 mlearning API
6. **mlearning 的 token 在 LTI 表单提交后才会建立**，无法直接通过 API 获取
7. Python 打印 emoji（✅❌🎉）在中文 Windows 控制台会报 `UnicodeEncodeError`，用纯 ASCII

### 已验证结果

- Canvas session cookie: `_normandy_session`, `_csrf_token`, `log_session_id` ✅
- jAccount cookie: `JAAuthCookie`, `JSESSIONID` ✅
- LTI 工具页可访问（200 OK）✅
- Rollcall Token 可在页面中找到 ✅
- 但 mlearning API 返回 `token不存在`（需要走 WebView 建立 session）⚠️

---

# 凭据管理相关注意事项

## 邮箱认证 (`ensureMailAuth`)

**文件**: `frontend/src/api/mail.ts`

### 策略
- 用 XHR `withCredentials=true` 走完重定向链，原生 cookie 存储自动管理 `ZM_AUTH_TOKEN`
- 只需从 `/zimbra/mail` 页面提取 CSRF token 即可

### 易错点
1. **CSRF token 持久化但不代表 session 有效**：之前 `ensureMailAuth` 拿到 CSRF token 后存在 AsyncStorage，下次直接 return true。但 ZM_AUTH_TOKEN cookie 可能已过期（Zimbra session 有时效），导致后续 SOAP 调用静默失败。
   - **修复**: 先 GET `/zimbra/mail` 验证 CSRF 是否仍有效，无效则重新走登录流程
2. **验证码识别失败需重试**：captcha 识别可能失败，加 3 次重试（WRONG_CAPTCHA 时 1.5s 延迟重试）
3. **邮箱和 i.sjtu 使用不同 OAuth client**：
   - i.sjtu: `sid=jaoauth220160718`
   - 邮箱: `sid=jasjtumail`
   - 登录一个不会自动登录另一个，需要分别认证

## HomeScreen 凭据检查 (`MainScreen.tsx`)

### 自动重登录流程
1. `checkJAccountSession()` → 探测 i.sjtu 接口是否可访问
2. 如果过期 → `autoLoginJAccount()` 尝试后台 jAccount 登录（含验证码识别），最多 3 次
3. 如果 3 次都失败 → 导航到 `JAccountLogin` WebView 登录页交给用户
4. 邮箱认证 `ensureMailAuth()` 紧随其后独立执行

### 易错点
1. ~~重复的 `useEffect` 和 `useFocusEffect` 竞争条件~~（已修复，删除了重复的 useEffect）
2. `autoLoginJAccount()` 用的 `sid=jaoauth220160718`（i.sjtu），不会建立邮箱 session
3. `autoLoginJAccount()` 成功后 jAccount SSO cookie 已设置，后续 `ensureMailAuth()` 可复用 SSO 自动完成邮箱 OAuth，无需再次输入密码

## JAccountLoginScreen

### 登录成功后的处理
- 检测到 `i.sjtu.edu.cn/xtgl/index_cxDbsy.html` 时判定登录成功
- **后台静默调用 `ensureMailAuth()`** 获取邮箱凭证（无需用户额外操作）
- 400ms 后导航返回

---

# 图标构建（Debug 与 Release 区分）

## 实现方式
- Android 使用 source set 机制：`src/debug/res/mipmap-*/` 下的资源覆盖 `src/main/` 的对应资源
- Debug 构建自动使用 `debug_icon.png`（1254x1254），缩放到各密度：
  - mdpi: 48x48
  - hdpi: 72x72
  - xhdpi: 96x96
  - xxhdpi: 144x144
  - xxxhdpi: 192x192

### 易错点
1. **不要创建 `mipmap-anydpi-v26/ic_launcher.xml`**：主项目没有自适应图标配置，加了的话 debug 构建会启用圆形裁剪导致图标不完整
2. Debug 构建已设 `applicationIdSuffix ".debug"` 和 `resValue "string", "app_name", "SJTU Helper Debug"`，和 release 版共存

---

# 主页课表卡片（MainScreen）课表渲染

### 三个场景
| 场景 | 渲染方式 |
|------|---------|
| 现在上课 + 后面还有课 | 两个独立 `sectionCard`：现在卡片（无小字）+ 下节卡片（带时间地点） |
| 只有下节或只有现在（最后一节） | 一个 `sectionCard`（badge + 课程名）+ `scheduleDetail` 在底部衬块 |
| 今天没课/上完了 | 纯文字（无白色卡片） |

### 实现要点
- `nextCourseName`/`nextCourseDetail` 状态：当 `scheduleBadge === '现在' && nextCourseName` 时渲染两个独立卡片
- **现在卡片不显示小字 detail**，下节卡片才显示时间地点
- 最后一节课：`scheduleDetail === '这是今天最后一节课啦~'` 显示在卡片**下方衬块**（而非卡片内部）
- 双卡片/最后一节**不嵌套在外层 `sectionCard` 内**，直接放在 TouchableOpacity section 下
- 所有重置课表状态的分支都必须清空 `nextCourseName` 和 `nextCourseDetail`

### numberOfLines 演进
| 阶段 | 值 | 原因 |
|------|-----|------|
| 最初 | 无 | 课程名溢出容器 |
| 第1次修复 | `numberOfLines={1}` | 单行截断防溢出 |
| 第2次修复 | `numberOfLines={2}` | 两行显示更长课程名 |
- 课表所有 `scheduleCourse`/`nextCourseName` 统一用 `numberOfLines={2}`
- 渲染测试（RenderTestScreen）需同步修改

---

# 共享卡片组件（CardViews）

**文件**: `frontend/src/components/CardViews.tsx`

### 用途
提取主页各区块的卡片渲染为共享组件，消除 MainScreen 和 RenderTestScreen 之间的代码重复。

### 组件列表
| 组件 | 用途 |
|------|------|
| `ScheduleSingleCard` | 课表单卡片（badge + 课程名 + 可选 detail） |
| `ExamCard` | 考试卡片（课程名 + 日期 + 时间 + 地点） |
| `MinorNoticeCard` | 暗色半透明普通通知 |
| `HighlightNoticeCard` | 带左侧边框的醒目通知（选课/评教） |
| `BadgeNoticeCard` | 带 badge 的通知（调课） |
| `AssignmentSummaryCard` | 作业摘要卡片 |
| `AnnouncementSummaryCard` | 公告摘要卡片 |
| `MailErrorCard` | 邮箱错误提示 |

### 易错点
- 修改卡片样式时需同时检查 MainScreen 和 RenderTestScreen 的样式一致性
- 共享样式通过 `cardStyles` 导出，React Native `StyleSheet.create` 创建后样式不可变

---

# 渲染测试（RenderTestScreen）

**文件**: `frontend/src/screens/RenderTestScreen.tsx`

### 重要原则
渲染测试必须严格调用 MainScreen 的样式（cardStyles/sectionCard/borderRadius 等），保持视觉一致，
不定义与 MainScreen 功能重复的本地样式。

### 用途
独立的渲染测试屏幕，不污染真实缓存，展示主页各区块在长名称下的表现。

### 测试场景
| 区块 | 测试内容 |
|------|---------|
| 课表 | 现在+下节（双卡片）、只有下节、最后一节 |
| 考试 | 3 门含超长名称、时间/地点布局 |
| 邮箱 | 错误状态提示 |
| 公告 | 长标题 + 课程名 |
| 作业 | 长课程名 + 长作业名 |
| 教务通知 | 选课(置顶)、评教、普通(暗色)、调课(badge) |

### 注意事项
- 使用 `CardViews` 共享组件，和 MainScreen 同一套渲染代码
- 列宽用 `flex: 1` + `paddingHorizontal: 5` + 外层负 margin 确保等宽
- 双列布局和 MainScreen 保持一致（左：课表→考试→邮箱；右：公告→作业→教务通知）

---

# React Native 开发：JS/TS 修改无需 Android 构建

纯 JS/TypeScript 文件的修改（`frontend/src/` 下的 `.ts` / `.tsx`）**不需要重新运行 gradle assembleDebug**。React Native debug 模式通过 Metro bundler 实时打包 JS bundle，安装后的 APK 在启动时会连接 Metro dev server 获取最新代码。

### 何时需要构建
- 修改了 `android/` 目录下的文件（原生代码、资源、Gradle 配置）
- 修改了 `app.json` 中的某些字段（如 version）
- 修改了原生模块（native modules）
- 需要生成独立的 APK 安装包（如发给别人安装）

### 开发流程
1. 启动 Metro: `npx expo start`
2. 修改 TS/TSX → 保存 → Metro 自动热重载
3. 如果需要安装到手机：用 ADB 安装一次 APK 后，后续 JS 修改通过 Metro 推送，无需重新 build

### 工具行为注意
- **`replace_string_in_file` / `multi_replace_string_in_file` 只替换每处匹配的第一次出现**，当有多个完全相同字符串时需为每个提供足够上下文（3-5 行前后代码）来区分
- 验证方式：改完后用 `grep_search` 确认所有目标位置都已更新

---

# 主页作业卡片紧急度辉光

根据 `display_date` 计算剩余时间，阈值与 `AssignmentCard.tsx` 保持一致：
- 1h 内 → red（勃艮第绯红）
- 24h 内 → orange（柿红琉璃橙）
- 72h 内 → yellow（蜜糖琥珀金）
用 `examGlowWrapper`/`examPureColorBase` 包裹卡片。

# 渲染测试新增实例原则

主页的所有新样式（辉光、卡片布局等）都必须在渲染测试中新增对应的测试实例，
确保样式在不同设备上表现一致，且修改后能快速验证。

### 紧急度测试布局原则
- 紧急度测试实例（动态计算时间偏移）必须**归入对应的业务 section 内**，作为该 section 的前几条测试项
- 例如：作业紧急度测试放在“作业” section 内，考试紧急度测试放在“考试” section 内
- 不允许创建独立的“紧急度测试” section 与业务 section 并列

# 已踩坑记录

### 1. 辉光元素尺寸错误
**问题**: `examPureColorBase` 用正值 inset（`top: 2, bottom: 2, left: 6, right: 6`）
使辉光比卡片**小一圈**，白色不透明卡片完全遮住辉光，看不见。
**修复**: 改为负值外扩（`top: -3, bottom: -3, left: -3, right: -3`），
辉光从卡片边缘溢出形成可见光晕。

### 2. 作业紧急度阈值抄错
**问题**: 直接把考试卡片的阈值（24h/72h/168h）复制给作业卡片，
但 `AssignmentCard.tsx` 使用的是 1h/24h/72h。
**修复**: 作业卡片阈值与 `AssignmentCard.tsx` 保持一致。

### 3. 考试卡片辉光在主页能显示而在渲染测试不能显示
（同上，尺寸问题。修复后渲染测试也能正常显示）

# 后台刷新（Android Background Fetch）

**相关文件**: `frontend/src/utils/backgroundTasks.ts`, `frontend/App.tsx`, `frontend/src/screens/SettingsScreen.tsx`

### 实现方案
- 使用 Expo 官方 `expo-task-manager` + `expo-background-fetch`
- **只在前台活跃时定时执行的**不是真后台，真正的系统级后台使用 Android `WorkManager` 调度
- 后台任务间隔设置为 15 分钟 ≥ 15 分钟（Android 系统最小限制）

### 后台检查内容
| 检查项 | 触发通知条件 |
|--------|-------------|
| Canvas 作业 | 出现新待交作业（与上次快照对比 id） |
| 邮箱 | 最新邮件内容变化（对比发件人+主题） |

### 设置位置
`SettingsScreen` → "自定义" → "后台刷新间隔"：
- 关闭 (0) / 15 分钟 / 30 分钟 / 60 分钟

### 注册流程
1. `App.tsx` 启动时读取 `BACKGROUND_REFRESH_INTERVAL`，>0 则调用 `registerBgTask()`
2. 用户修改间隔时动态注册/注销
3. 每次后台唤醒执行 `performBackgroundCheck()`，对比快照，有变化则发本地通知

### 注意事项
- **Expo Go 不支持后台任务**，需要 `npx expo run:android`（Dev Build）或 EAS Build
- 快照存储在 AsyncStorage `BG_LAST_SNAPSHOT_KEY` 中
- 任务不会在 App 被用户强行杀死后运行（`stopOnTerminate: false` 仅对系统因资源而终止的情况有效）
- 若用户从最近任务列表划掉 App，后台任务会停止。下次手动打开 App 后恢复

# 主页考试卡片（MainScreen）

**文件**: `frontend/src/screens/MainScreen.tsx`

### 布局
```
课程名（numberOfLines=1, ellipsizeMode=tail）
6/30  08:00-10:00
东上院201
```

### 实现细节
- **时间范围**：从 `e.kssj`（格式 `"2025-12-30(08:00-10:00)"`）用正则 `/\((\d{2}:\d{2}-\d{2}:\d{2})\)/` 提取括号内的时间段
- **日期**：用 `safeTime(e.kssj)` 获取时间戳 → Date 对象 → 格式化 `M/D`
- **课程名**：原用 `.substring(0, 10)` 硬截断，改为 `numberOfLines={1}` + `ellipsizeMode="tail"`

### 易错点
考试卡片的地点单独一行（不和日期/时间在同一行），避免溢出

---

# 主页教务通知点击行为（MainScreen）

**文件**: `frontend/src/screens/MainScreen.tsx`

### 规则
- **选课/评教/调课通知**（带 badge 的白色 `sectionCard`）→ 点击导航到 Notif 屏幕
- **普通通知**（暗色半透明 `notifMinorCard`，无 badge）→ 点击通过 `navigation.navigate('WebView', { url, title })` 打开应用内 WebView 显示教务处通知原文
- isjtu 通知没有 JWC URL，走 fallback 到 Notif 屏幕

### 实现
```tsx
// merged 对象增加 url 字段
merged.push({ ..., url: n.url });

// 渲染时判断
onPress={() => {
  if (item.url && !item.badge) { navigation.navigate('WebView', { url: item.url, title: '教务通知' }); }
  else { navigation.navigate('Notif'); }
}}
```
暗色卡片从 `View` 改为 `TouchableOpacity`。

### 易错点：通知标题溢出
- 通知标题使用 `styles.citem`（`fontSize: 12, lineHeight: 18`）搭配 `numberOfLines={1}`
- **必须确保 `citem` 有 `flexShrink: 1`**，否则在 `flexDirection: 'row'` 的 `notifItemRow` 中标题不会收缩，badge 会被挤出容器
- 已在 `citem` 样式中加 `flexShrink: 1`，之后不要误删

---

# 主页下拉刷新（MainScreen confirmRefresh）

**文件**: `frontend/src/screens/MainScreen.tsx`

### 需要清除的缓存键
```tsx
await AsyncStorage.removeItem('CALENDAR_CACHE');
const allKeys = await AsyncStorage.getAllKeys();
const removeKeys = allKeys.filter(k =>
  k.startsWith('SCHEDULE_CACHE_') ||
  k.startsWith('EXAM_CACHE_') ||
  k === 'JWC_NOTICES_CACHE'
);
await AsyncStorage.multiRemove(removeKeys);
```

### 易错点
之前只清了 `CALENDAR_CACHE`，但 `SCHEDULE_CACHE_*` / `EXAM_CACHE_*` / `JWC_NOTICES_CACHE` 残留导致测试数据无法清除。所有相关缓存键都必须删除。

---

# 主页疯狂星期四（MainScreen）

**文件**: `frontend/src/screens/MainScreen.tsx`

`crazyOuter` 样式：`marginTop: 12` 防止紧贴上面内容区块。

### 实时计算
- `checkCrazyThursday()` 用 `useFocusEffect` 每次聚焦时重新判断，而非只在挂载时检查
- 四个条件必须全部满足才显示：`getDay() === 4`（周四）&& `getCrazyThursdayEnabled()`（设置中开启）&& `!isCrazyThursdayDismissedThisWeek()`（本周未关闭）
- 任一条件不满足时主动 `setShowCrazyThu(false)` 确保不会残留显示

---

# AssignmentCard 导航行为

**文件**: `frontend/src/components/AssignmentCard.tsx`

### 重要：hooks 必须在所有早 return 之前
`AssignmentCard` 有多个早 return（`compact` 模式、已提交/已过期模式），所有 `useState` / `useEffect` / `useMemo` **必须放在这些 return 之前**，否则会导致：

> Render Error: Rendered fewer hooks than expected.
> This may be caused by an accidental early return statement.

**错误历史**：第 5 个 hook（`dynamicCardStyle` 的 `useMemo`）之前放在两个早 return 之后，当 `compact` 或 `isActuallySubmitted` 状态变化时，hook 数量在 4 和 5 之间切换，触发 React 报错。

**修复**：将 `dynamicCardStyle` 的 `useMemo` 移到所有早 return 之前，确保每次渲染调用相同数量的 hook。

### 点击行为
- 有点击导航到 `WebViewScreen`（应用内浏览器）显示 Canvas 作业/公告页
- 无 navigation prop 时回退到 `Linking.openURL`（系统浏览器）
- `WebViewScreen` 右上角有 `open-in-new` 图标可一键切到系统浏览器

### Props
- `navigation?: any` — 可选，传入则导航到 WebViewScreen
- `onAnnounceAction`, `onUnhide`, `compact`, `forceShowActions`, `footerDateStr`

---

# WebViewScreen 应用内浏览器

**文件**: `frontend/src/screens/WebViewScreen.tsx`

### 功能
- 接收 `url` 和 `title` 参数，渲染 WebView 显示网页
- 左上角返回箭头
- 右上角 `open-in-new` 图标 → `Linking.openURL(url)` 在系统浏览器中打开
- 适用于教务通知详情、Canvas 作业/公告等

---

# ScheduleScreen 课表渲染

**文件**: `frontend/src/screens/ScheduleScreen.tsx`

### 课程卡片渲染
```tsx
<Text style={styles.classTitle} numberOfLines={3}>{c.kcmc}</Text>
```
- 课程名会**自动换行**，最多 3 行
- 卡片高度 = `sessionCount * 50 - 4`（按课程节数动态计算）
- `overflow: 'hidden'` 防止溢出
- 极长课程名（超过 3 行）会被 `numberOfLines={3}` 截断加省略号

### 易错点
1. 字体大小 10px，lineHeight 12px，3 行约 36px + padding
2. 1 节课的卡片 46px 高，对于 3 行文字基本够用
3. 课程名不截断的问题只存在于"节数少但课程名极长"的极端情况

# 后台通知与电池优化

## 通知 API 注意事项（Expo Notifications v55）

### channelId 位置
`channelId` **不能**放在 `NotificationContentInput` 中（v55 类型检查会报错），而是放在 **trigger** 中：

```tsx
// ❌ 错误
content: { title: 'Hi', body: 'test', channelId: 'default' }

// ✅ 正确 — 放在 trigger 中
trigger: { channelId: 'default' }                                    // 立即发送
trigger: { type: 'timeInterval', seconds: 10, channelId: 'default' } // 延迟发送
```

### NotificationBehavior 属性变更
v55 中 `shouldShowAlert` 已废弃，改用 `shouldShowBanner` + `shouldShowList`：

```tsx
// ❌ 旧版
handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true })

// ✅ 新版
handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true })
```

### setNotificationHandler 位置
- 应在 `App.tsx` 启动时调用一次，不要重复调用
- 模块级调用（`notifications.ts` 顶层）即可生效
- 前台 `trigger: null` + handler 返回 `shouldShowBanner: true` 才能在 App 前台弹出横幅

## 国内 ROM 后台限制

| 品牌 | 系统 | 检测依据 |
|------|------|---------|
| OPPO / OnePlus / Realme | ColorOS | `brand`/`manufacturer` 含 `oppo`/`oneplus`/`realme` |
| Xiaomi / Redmi / POCO | MIUI | 含 `xiaomi`/`redmi`/`poco` |
| Huawei / Honor | EMUI / HarmonyOS | 含 `huawei`/`honor` |
| Samsung | One UI | 含 `samsung` |
| Vivo / iQOO | Funtouch / OriginOS | 含 `vivo`/`iqoo` |

- `expo-device` 中 `Device.brand` 和 `Device.manufacturer` 可用于检测手机品牌
- 检测到品牌后展示对应步骤引导用户去设置中添加白名单
- 检测代码在 `src/utils/batteryOptimization.ts`

## 电池优化引导
- 位于 **设置 → 自定义 → 后台刷新间隔** 选定 >0 后自动弹出
- 也位于 **开发者模式 → 电池优化检测** 手动查看
- 使用自定义 `Modal` 展示（**禁止** `Alert.alert`），风格与其他弹窗一致

# 构建注意事项

### 终端命令规范
- **构建命令运行期间绝不允许执行任何其他终端命令**，否则会打断 Gradle 进程导致构建失败
- 构建前确保 Metro bundler 已关闭（或使用不同端口）
- 构建命令：`cd android && .\gradlew assembleRelease`（Release）或 `cd android && .\gradlew assembleDebug`（Debug）
