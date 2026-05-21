#!/usr/bin/env python3
"""
选课通知解析脚本：从教务处选课通知 HTML 中提取选课轮次时间
用法: python parse_xuanke.py <file>
"""
import re, sys, json


def parse(html):
    t = re.search(r'上海交通大学(\d{4})-(\d{4})学年([春秋夏])季学期选课通知', html)
    if not t: return {"error": "no title"}
    ys, ye, season = t.group(1), t.group(2), t.group(3)
    smap = {'春': 'spring', '夏': 'summer', '秋': 'fall'}

    p = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', html)
    if not p: return {"error": "no pub date"}
    py, pm = int(p.group(1)), int(p.group(2))

    c = re.search(r'<div class="v_news_content">(.*?)</div>\s*</div>', html, re.DOTALL)
    if not c: return {"error": "no content"}
    content = c.group(1)

    # 时间正则：可选前缀年
    tp = re.compile(
        r'(?:\d{4}年)?(\d+)月(\d+)日（(?:夏季学期)?第(\d+)周周[一二三四五六日]）(\d+:\d+)\s*-\s*(?:\d{4}年)?(\d+)月(\d+)日（(?:夏季学期)?第(\d+)周周[一二三四五六日]）(\d+:\d+)'
    )

    def get_year(tm_match, group_idx, fallback):
        """从匹配文本中提取年份：若时间前有显式 'YYYY年' 则用，否则用 fallback"""
        txt = tm_match.group(0)
        # 找到第 group_idx 组对应的月份位置
        month_str = tm_match.group(group_idx)
        pos = txt.find(month_str + '月')
        before = txt[:pos]
        y = re.search(r'(\d{4})年', before)
        return int(y.group(1)) if y else fallback

    # 尝试两种解析方式
    rounds = _parse_rounds(content, tp, py, pm, get_year, use_red=True)
    if not rounds:
        rounds = _parse_rounds(content, tp, py, pm, get_year, use_red=False)

    return {
        "title": f"上海交通大学{ys}-{ye}学年{season}季学期选课通知",
        "academic_year": f"{ys}-{ye}",
        "season": smap.get(season, season),
        "season_cn": f"{season}季",
        "rounds": rounds,
    }


def _parse_rounds(content, tp, py, pm, get_year, use_red):
    """从 HTML 或纯文本中提取轮次"""
    if use_red:
        # 从红色 <strong> 块提取
        blocks = re.findall(r'<strong[^>]*>(.*?)</strong>', content, re.DOTALL)
        parts = []
        for b in blocks:
            if not re.search(r'color:red', b): continue
            spans = re.findall(r'<span[^>]*>(.*?)</span>', b, re.DOTALL)
            txt = ''.join(spans)
            txt = re.sub(r'<[^>]+>', '', txt).strip().replace('\u200b', '')
            if txt: parts.append(txt)
        if not parts: return []
        text = ''.join(parts)
    else:
        text = re.sub(r'<[^>]+>', '', content).replace('&nbsp;', ' ').replace('\u200b', '')

    rounds = []
    for seg in text.split('\u3002'):
        seg = seg.strip()
        if not seg: continue

        # 提取轮次名
        name = ''
        if '试选时间' in seg or seg.startswith('试选'):
            name = '试选'
        else:
            m = re.search(r'(\d+)[、．]([^：:]*?)\s*[：:]', seg)
            if m:
                name = m.group(2).strip()
                if len(name) > 15: name = ''
        if not name: continue

        tm = tp.search(seg)
        if tm:
            g = tm.groups()
            sm, em = int(g[0]), int(g[4])
            sy = get_year(tm, 0, py)
            ey = get_year(tm, 4, py)
            # 如果 get_year 没能从显式年份获取（fallback），用简单规则
            if sy == py:
                sy = py if not (pm >= 9 and sm <= 3) else py + 1
            if ey == py:
                ey = py if not (pm >= 9 and em <= 3) else py + 1
            rounds.append({
                "round": name,
                "start": f"{sy:04d}-{sm:02d}-{int(g[1]):02d}T{g[3]}",
                "end": f"{ey:04d}-{em:02d}-{int(g[5]):02d}T{g[7]}",
                "start_week": int(g[2]),
                "end_week": int(g[6]),
            })
    return rounds


if __name__ == '__main__':
    fp = sys.argv[1] if len(sys.argv) > 1 else None
    html = open(fp, 'r', encoding='utf-8-sig').read() if fp else sys.stdin.read()
    r = parse(html)
    if 'error' in r:
        print(f"ERROR: {r['error']}", file=sys.stderr)
        exit(1)
    print(json.dumps(r, ensure_ascii=False, indent=2))
