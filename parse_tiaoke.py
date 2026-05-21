#!/usr/bin/env python3
"""
调课提醒解析脚本：从 i.sjtu.edu.cn 的调课通知标题中提取结构化数据

测试数据来自 isjtu_announce.har 中的 items 数组
"""
import re, json

# 从 HAR 中提取的样本
samples = [
    "调课提醒:张拳石老师于第8周星期五第1-2节在东上院215上的机器学习课程调课到由张拳石老师在第10周星期五第1-2节东上院215上课，请各位同学相互告知！",
    "调课提醒:唐敏老师于第4周星期三第11-13节在东中院1-107上的科学计算课程调课到由王增琦老师在第4周星期三第11-13节东中院1-107上课，请各位同学相互告知！",
    "调课提醒:唐敏老师于第3周星期三第11-13节在东中院1-107上的科学计算课程调课到由王增琦老师在第3周星期三第11-13节东中院1-107上课，请各位同学相互告知！",
    "调课提醒:刘满华老师于第2周星期四第6-8节在东下院302上的人工智能理论及应用课程调课到由刘满华老师在第4周星期五第11-13节东下院302上课，请各位同学相互告知！",
    "调课提醒:徐艳如老师于第16周星期四第6-8节在中院411上的马克思主义基本原理课程调课到由王旭荣老师在第16周星期四第6-8节中院411上课，请各位同学相互告知！",
    "调课提醒:唐异垒老师于第14周星期四第11-12节在上院315上的常微分方程课程调课到由唐异垒老师在第15周星期二第13-14节上院315上课，请各位同学相互告知！",
    "调课提醒:金海明老师于第14周星期四第1-3节在上院213上的计算机网络课程调课到由金海明老师在第13周星期六第7-9节上院213上课，请各位同学相互告知！",
    "调课提醒:李听昕老师于第9周星期五第7-8节在下院114上的大学物理（荣誉）（3）课程调课到由刘世勇老师在第9周星期五第7-8节下院114上课，请各位同学相互告知！",
    "调课提醒:李听昕老师于第8周星期五第7-8节在下院114上的大学物理（荣誉）（3）课程调课到由刘世勇老师在第8周星期五第7-8节下院114上课，请各位同学相互告知！",
    "调课提醒:谢春景老师于第11周星期二第11-12节在上院105上的复分析课程调课到由王芳老师在第11周星期二第11-12节上院105上课，请各位同学相互告知！",
    "调课提醒:费佳睿老师于第8周星期一第11-13节在上院112上的初等数论课程调课到由崔振老师在第8周星期一第11-13节上院112上课，请各位同学相互告知！",
    "调课提醒:朱杰老师于第4周星期一第3-4节在东下院302上的模拟电子技术课程调课到由朱杰老师在第6周星期三第7-9节上院101上课，请各位同学相互告知！",
    "调课提醒:鄂昱村老师于第12周星期四第7-8节在上院112上的军事理论课程调课到由宋玲老师在第12周星期四第7-8节上院112上课，请各位同学相互告知！",
    "调课提醒:蒋启芬老师于第8周星期四第3-4节在下院115上的线性代数课程调课到由张晓东老师在第8周星期四第3-4节下院115上课，请各位同学相互告知！",
]


def parse_tiaoke(title: str) -> dict:
    """解析调课提醒标题，返回结构化数据"""
    
    pattern = re.compile(
        r'调课提醒:'
        r'(?P<orig_teacher>[^老]+)老师于'           # 原老师
        r'第(?P<orig_week>\d+)周'                    # 原周
        r'(?P<orig_day>\S+?)'                        # 原星期（星期五/周三/周一等）
        r'第(?P<orig_periods>[\d-]+)节在'            # 原节次
        r'(?P<orig_location>.+?)(?:上)(?=的)'        # 原地点（上歧义，用前瞻解决）
        r'的(?P<course>.+?)课程'                      # 课程名
        r'调课到由'
        r'(?P<new_teacher>[^老]+)老师'               # 新老师
        r'在第(?P<new_week>\d+)周'                   # 新周
        r'(?P<new_day>\S+?)'                          # 新星期
        r'第(?P<new_periods>[\d-]+)节'               # 新节次
        r'(?P<new_location>.+?)(?:上)(?=课)'         # 新地点
        r'课'
    )
    
    m = pattern.search(title)
    if not m:
        return {"error": "无法解析", "raw": title}
    
    d = m.groupdict()
    
    # 星期映射
    day_map = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7,
        '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7,
    }
    orig_day_num = day_map.get(d['orig_day'], d['orig_day'])
    new_day_num = day_map.get(d['new_day'], d['new_day'])
    
    # 节次解析 "1-2" -> [1, 2], "11-13" -> [11, 13]
    def parse_periods(s):
        parts = s.split('-')
        return int(parts[0]), int(parts[1])
    
    orig_start, orig_end = parse_periods(d['orig_periods'])
    new_start, new_end = parse_periods(d['new_periods'])
    
    return {
        "type": "调课",
        "course": d['course'],
        "original": {
            "teacher": d['orig_teacher'] + '老师',
            "week": int(d['orig_week']),
            "day": orig_day_num,
            "day_cn": d['orig_day'],
            "periods": f"第{d['orig_periods']}节",
            "period_start": orig_start,
            "period_end": orig_end,
            "location": d['orig_location'],
        },
        "new": {
            "teacher": d['new_teacher'] + '老师',
            "week": int(d['new_week']),
            "day": new_day_num,
            "day_cn": d['new_day'],
            "periods": f"第{d['new_periods']}节",
            "period_start": new_start,
            "period_end": new_end,
            "location": d['new_location'],
        },
    }


def main():
    results = []
    for s in samples:
        r = parse_tiaoke(s)
        results.append(r)
        status = '✅' if 'error' not in r else '❌'
        print(f"{status} {r.get('course', r.get('error'))}")
        if 'error' not in r:
            o, n = r['original'], r['new']
            print(f"   原: {o['teacher']} 第{o['week']}周{o['day_cn']} {o['periods']} {o['location']}")
            print(f"   新: {n['teacher']} 第{n['week']}周{n['day_cn']} {n['periods']} {n['location']}")
    
    print(f"\n{'='*50}")
    print(f"共 {len(results)} 条，成功 {sum(1 for r in results if 'error' not in r)} 条")
    
    # 输出 JSON 示例
    print(f"\n结构化 JSON 示例（第一条）：")
    print(json.dumps(results[0], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
