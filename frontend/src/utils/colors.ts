// 根据课程名称生成随机但固定的颜色
export const getCourseColor = (courseName: string = ''): string => {
  if (!courseName) return '#999';
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
};
