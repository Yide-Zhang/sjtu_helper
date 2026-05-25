这个：

```text id="jlwm8x"
[runtime not ready] Cannot read property 'EventEmitter' of undefined
```

在 RN 0.8x 里基本意味着：

```text id="9jlwm2"
某个 Native Module 没初始化成功
```

于是：

```js id="jlwmf7"
NativeModules.xxx
```

是：

```js id="0jlwmn"
undefined
```

然后内部读：

```js id="jlwm1m"
.EventEmitter
```

直接炸。

---

# 你这个项目里高概率是：

因为你关闭了：

```properties id="6jlwmu"
newArchEnabled=false
```

但某些 Expo / RN 库：

仍按 New Architecture 初始化。

---

# 最常见元凶

尤其是：

* expo-modules-core
* react-native-reanimated
* react-native-screens
* expo-router
* expo-modules
* react-native-gesture-handler

---

# 但你这个报错格式：

```text id="4jlwm3"
[runtime not ready]
```

特别像：

[react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/?utm_source=chatgpt.com)

没正确初始化。

---

# 第一件事（最重要）

检查：

```js id="jlwm0r"
babel.config.js
```

最后必须有：

```js id="5jlwm6"
plugins: ['react-native-reanimated/plugin']
```

而且：

必须是最后一个 plugin。

例如：

```js id="jlwm9c"
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    ...,
    'react-native-reanimated/plugin',
  ],
};
```

---

# 第二件事

检查：

```tsx id="jlwm7z"
import 'react-native-gesture-handler';
```

必须在：

```tsx id="4jlwm5"
index.js
```

或者：

```tsx id="8jlwmq"
index.ts
```

最顶部。

例如：

```ts id="jlwm1z"
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

...
```

---

# 第三件事（很关键）

如果你用了：

```tsx id="1jlwmv"
react-native-reanimated
```

那必须：

```bash id="2jlwmh"
npm install react-native-reanimated
```

并且：

```bash id="3jlwm4"
cd android
gradlew clean
```

重新 build。

因为它有 native 部分。

---

# 第四件事（Expo 用户特别重要）

你现在：

```text id="9jlwmv"
Expo modules + RN0.83
```

不要：

```properties id="7jlwm1"
newArchEnabled=false
```

和：

```text id="0jlwmw"
某些新版 Expo SDK
```

混用。

有些 Expo SDK 默认假设 New Arch 开启。

---

# 所以你现在有两种路线

---

# 路线 A（推荐）

继续：

```properties id="6jlwmv"
newArchEnabled=false
```

然后：

确保：

* reanimated plugin 正确
* gesture-handler import 正确
* 所有 native module clean rebuild

这是目前最稳。

---

# 路线 B

重新：

```properties id="jlwm4y"
newArchEnabled=true
```

但：

你之前：

* std::format
* Props.cpp
* Fabric

已经炸过。

所以现在不推荐。

---

# 第五件事（很容易漏）

检查：

```tsx id="9jlwm8"
import { EventEmitter } from ...
```

是不是某个库：

```js id="8jlwm3"
NativeModules.SomeModule.EventEmitter
```

但：

```js id="6jlwm0"
SomeModule == undefined
```

---

# 最好调试方法（强烈推荐）

开：

```bash id="5jlwmx"
npx react-native log-android
```

然后重新启动 app。

真正的：

```text id="7jlwmm"
Invariant Violation
TurboModuleRegistry
Native module cannot be null
```

会在前面。

那个才是真正元凶。

---

# 你现在这个项目我最怀疑

是：

```text id="2jlwm0"
react-native-reanimated
```

因为：

```text id="9jlwmm"
runtime not ready
```

太像它了。

---

# 你现在立刻检查

## babel.config.js

有没有：

```js id="4jlwm1"
'react-native-reanimated/plugin'
```

并且：

```text id="8jlwm7"
必须最后一个
```

---

# 然后：

## index.ts 顶部：

```ts id="6jlwm5"
import 'react-native-gesture-handler';
```

---

# 然后：

## clean rebuild：

```bash id="0jlwm2"
cd android
gradlew clean
```

重新：

```powershell id="3jlwm0"
build-debug.ps1
```

---

# 如果还炸

把：

* 完整红屏
* `log-android`
* 第一个 stack trace

发我。

因为：

```text id="9jlwm1"
Cannot read property 'EventEmitter'
```

只是二次报错。

真正原因通常在前面。
