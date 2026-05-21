# 教务处通知获取方案研究笔记

## 数据源

### 1. 教务处官网通知列表
- **URL**: https://jwc.sjtu.edu.cn/xwtg/tztg.htm
- **编码**: UTF-8
- **内容**: 教务处所有公开通知通告

### 2. i.sjtu 教学信息服务网通知（用户已做好）
- 用户已完成 i.sjtu 的通知抓取

---

## 列表页 DOM 结构

```
<div class="ny_right_con">
  <div class="Newslist">
    <ul>
      <li class="clearfix" id="line_u9_0">
        <div class="sj">
          <h2>20</h2>           <!-- 日期-日 -->
          <p>2026.05</p>        <!-- 日期-年.月 -->
        </div>
        <div class="wz">
          <a href="../info/1222/126681.htm">
            <h2>标题文本</h2>
          </a>
          <p>摘要/片段...</p>
        </div>
      </li>
      ...
    </ul>
  </div>
</div>
```

### 提取字段
| 字段 | 位置 | 说明 |
|------|------|------|
| 日 | `li > div.sj > h2` | 如 "20" |
| 年.月 | `li > div.sj > p` | 如 "2026.05" |
| 标题 | `li > div.wz > a > h2` | 通知标题 |
| 链接 | `li > div.wz > a[href]` | 相对路径，补全为 `https://jwc.sjtu.edu.cn/info/...` |
| 摘要 | `li > div.wz > p` | 正文片段 |

### 正则提取方案
```javascript
const itemRegex = /<li class="clearfix"[^>]*>[\s\S]*?<div class="sj">\s*<h2>(\d+)<\/h2>\s*<p>([\d.]+)<\/p>[\s\S]*?<a href="([^"]+)"[\s\S]*?<h2>([\s\S]*?)<\/h2>[\s\S]*?<\/a>\s*<p>([\s\S]*?)<\/p>[\s\S]*?<\/li>/g;
```

---

## 详情页 DOM 结构

```
URL: https://jwc.sjtu.edu.cn/info/{categoryId}/{articleId}.htm

<div class="content">
  <div class="content-title">
    <h3>标题</h3>
    <i>发布日期：2026-05-20　　 　点击量：...</i>
  </div>
  <div class="content-con">
    <div id="vsb_content">
      <div class="v_news_content">
        ... HTML 正文 ...
      </div>
    </div>
    <!-- 附件列表（可能没有） -->
    <div class="nytit2"><h2>相关附件</h2></div>
    <div class="Newslist2">
      <ul>
        <li><a href="/system/_content/download.jsp?...">附件名称.docx</a></li>
      </ul>
    </div>
  </div>
</div>
```

### 提取字段
| 字段 | 位置 | 说明 |
|------|------|------|
| 标题 | `.content-title > h3` | 全文标题 |
| 发布日期 | `.content-title > i` | "发布日期：2026-05-20" |
| 正文 HTML | `#vsb_content .v_news_content` | 完整 HTML 内容 |
| 附件 | `.Newslist2 > ul > li > a` | 附件链接和名称 |

---

## 分页模式

```
首页 → /xwtg/tztg.htm          (第1页)
第2页 → /xwtg/tztg/230.htm
第3页 → /xwtg/tztg/229.htm
第4页 → /xwtg/tztg/228.htm
...
第231页 → /xwtg/tztg/1.htm
```

- 共 231 页，每页 10 条
- 页码编号是**倒序**的：第 N 页 (N>=2) 的路径为 `tztg/{232-N}.htm`
- 分页 HTML 结构：
```html
<div class="pb_sys_common pb_sys_normal pb_sys_style2">
  <span class="p_pages">
    <span class="p_first_d p_fun_d">首页</span>
    <span class="p_prev_d p_fun_d">上页</span>
    <span class="p_no_d">1</span>
    <span class="p_no"><a href="tztg/230.htm">2</a></span>
    <span class="p_no"><a href="tztg/229.htm">3</a></span>
    ...
    <span class="p_no"><a href="tztg/1.htm">231</a></span>
    <span class="p_next p_fun"><a href="tztg/230.htm">下页</a></span>
    <span class="p_last p_fun"><a href="tztg/1.htm">尾页</a></span>
  </span>
</div>
```

---

## 选课通知定型文分析

### 两个样本

| 样本 | 学期 | URL |
|------|------|------|
| 1 | 2025-2026 夏季 | `/info/1222/125311.htm` |
| 2 | 2025-2026 春季 | `/info/1222/124411.htm` |

### 标题格式
```
上海交通大学{学年}学年{季节}学期选课通知
```
例：`上海交通大学2025-2026学年夏季学期选课通知`

### 轮次结构

**春季/秋季学期**（完整 海选 + 抢选 + 第三轮）：
| 次序 | 名称 | 说明 |
|------|------|------|
| 试选 | 试选 | 正式选课前开放，结果会被清除 |
| 1 | 海选 | 不设人数上限，结束后随机筛选 |
| 2 | 抢选 | 先到先得，有专业限制阶段 |
| 3 | 第三轮选课（暂定） | 开学初，可退可选→只能选不能退 |

**夏季学期**（只有 2 轮抢选，无海选）：
| 次序 | 名称 |
|------|------|
| 1 | 第一轮抢选 |
| 2 | 第二轮抢选 |

### HTML 提取模式

时间信息在 `<div class="v_news_content">` 内的红色 `<strong><span style="color:red">` 中：
```html
<strong><span ...color:red>1、海选：</span></strong>
<strong><span ...color:red>12月17日（第14周周三）13:00-12月22日（第15周周一）09:00</span></strong>
```

**提取思路**：
1. 分割 `v_news_content` 中的 HTML
2. 用 `<strong>.*?color:red.*?>(\d+)[、.](.*?)：</span></strong>` 匹配轮次名
3. 用 `<strong>.*?color:red.*?>([^<]+?)</span></strong>` 匹配紧跟的时间文本
4. 解析时间格式：`X月Y日（第Z周周W）HH:MM-X月Y日（第Z周周W）HH:MM`

### 测试集（4 个样本全部通过 ✅）

| # | 学期 | URL | 轮次 | 特殊之处 |
|---|------|-----|------|---------|
| 1 | 2025-2026 春季 | `/1222/124411.htm` | 试选+海选+抢选+第三轮 | 标准 format，红色标签 |
| 2 | 2025-2026 夏季 | `/1222/125311.htm` | 第一轮抢选+第二轮抢选 | "夏季学期第N周" 格式 |
| 3 | 2025-2026 秋季 | `/1027/120851.htm` | 试选+海选+抢选+第三轮 | **无红色标签**，纯文字回退 |
| 4 | 2024-2025 春季 | `/1027/118191.htm` | 试选+海选+抢选+第三轮 | 时间含 **显式年份** `2024年12月30日` |

### 解析策略总结

1. **优先**从 `color:red` 的 `<strong>` 块提取（春/夏通知常用）
2. **回退**直接从 `v_news_content` 纯文本提取（秋通知无红色标签）
3. **年份推断**：
   - 若时间文本前有显式 `YYYY年` 前缀，直接使用
   - 否则根据发布日期推断（12月→次年1月跨年）
4. **时间格式**支持三种变体：
   - `12月17日（第14周周三）13:00-12月22日（第15周周一）09:00`
   - `7月6日（夏季学期第1周周一）13:00-7月8日（夏季学期第1周周三）16:00`
   - `2024年12月30日（第16周周一）20:45-2025年1月6日（第17周周一）20:00`

### 选课通知（最高优先级）
- **标题格式**: `上海交通大学XXXX-XXXX学年X季学期选课通知`
- 正则匹配: `/上海交通大学\d{4}-\d{4}学年[春秋夏]季学期选课通知/`
- 示例: `上海交通大学2025-2026学年春季学期选课通知`
- 识别后标记为 `priority: "high"`，单独在首页突出展示

### 一般通知（普通优先级）
- 所有其他通知
- 标记为 `priority: "normal"`

---

## 实施方案

### 1. 新建 `frontend/src/api/jwc.ts`
- `fetchJwcNoticeList(page = 1)`: 获取指定页的通知列表
  - 拼接 URL：第1页 → `/xwtg/tztg.htm`，第N页(N>=2) → `/xwtg/tztg/{232-N}.htm`
  - 用 `fetch()` 获取 HTML
  - 用正则解析列表项
  - 返回结构化数组
- `fetchJwcNoticeDetail(url)`: 获取某条通知的详情
  - 用 `fetch()` 获取详情页 HTML
  - 用正则提取标题、发布日期、正文 HTML、附件列表
- `classifyJwcNotices(notices)`: 对通知列表分类
  - 检测选课通知，标记优先级

### 2. 更新 `MainScreen.tsx`
- 在主页添加"教务处通知"区块
- 选课通知使用醒目样式（橙色/红色标签 + 大字号）
- 一般通知使用普通列表样式
- 可点击跳转到详情页（WebView 或新屏幕）

### 3. 集成到现有导航
- 可考虑复用 `AnnouncementsScreen` 或新增 `JwcNoticeScreen`
- 详情可以用 WebView 展示

---

## 注意事项
- 教务处网站可能没有反爬机制，但注意请求频率
- 列表页和详情页都可能包含附件下载链接
- 选课通知是最重要的，开学前后是关键时段
- React Native 没有 DOM 解析器，需要用正则解析 HTML
- 建议对列表页结果做缓存（AsyncStorage），避免频繁请求
