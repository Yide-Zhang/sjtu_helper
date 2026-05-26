with open('../src/screens/CommunityReviewScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '  // 加载某个老师的一页评论\n  const loadPage = async (g: CourseGroup, t: TeacherData, page: number) => {\n    try {\n      const r = await getCourseReviewsPage(t.id, page, 10);\n      const exist = g.teacherReviews.get(t.id) || [];\n      g.teacherReviews.set(t.id, [...exist, ...r.reviews]);\n      if (r.reviews.length > 0) {\n        g.teacherCred.set(t.id, calculateCredibility(g.teacherReviews.get(t.id)!));\n      }\n      g.teacherPage.set(t.id, { page, hasMore: r.hasMore });\n      setGroups(prev => [...prev]); // 用回调避免闭包陈旧值\n    } catch {}\n  };\n\n  const loadMore = (gCode: string, tId: number) => {\n    setGroups(prevGroups => {\n      const g = prevGroups.find(x => x.code === gCode);\n      if (!g) return prevGroups;\n      const p = g.teacherPage.get(tId);\n      if (!p?.hasMore) return prevGroups;\n      const t = g.teachers.find(x => x.id === tId);\n      if (t) loadPage(g, t, p.page + 1);\n      return [...prevGroups];\n    });\n  };'

new_text = '  // 首次展开时加载该老师的全部评论，算一次可信度（之后不变）\n  const loadAllReviews = async (g: CourseGroup, t: TeacherData) => {\n    if (g.teacherReviews.has(t.id)) return;\n    try {\n      const all = await getAllCourseReviews(t.id);\n      g.teacherReviews.set(t.id, all);\n      if (all.length > 0) {\n        g.teacherCred.set(t.id, calculateCredibility(all));\n      } else {\n        g.teacherReviews.set(t.id, []);\n      }\n      g.teacherPage.set(t.id, { page: 1, hasMore: all.length > 10 });\n      setGroups(prev => [...prev]);\n    } catch {}\n  };\n\n  // 展开更多评论（从已加载的全量数据中多露 10 条，不再调 API）\n  const loadMore = (gCode: string, tId: number) => {\n    setGroups(prevGroups => {\n      const g = prevGroups.find(x => x.code === gCode);\n      if (!g) return prevGroups;\n      const p = g.teacherPage.get(tId);\n      if (!p || !p.hasMore) return prevGroups;\n      g.teacherPage.set(tId, { ...p, page: p.page + 1, hasMore: (p.page + 1) * 10 < (g.teacherReviews.get(tId)?.length ?? 0) });\n      return [...prevGroups];\n    });\n  };'

if old in content:
    content = content.replace(old, new_text)
    with open('../src/screens/CommunityReviewScreen.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('REPLACED', len(new_text), 'chars')
else:
    print('NOT FOUND')
