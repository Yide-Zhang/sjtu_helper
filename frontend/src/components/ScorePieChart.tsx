import React, { MutableRefObject } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, G, Circle, Text as SvgText, Rect } from 'react-native-svg';

interface Props {
  components: { name: string; pct: number; score: number }[];
  totalScore: string;
  gradeLetter?: string;
  width?: number;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  sliceHitRef: MutableRefObject<boolean>;
}

const COLORS = [
  '#0055A8', '#E65100', '#4CAF50', '#9C27B0', '#FF9800',
  '#00BCD4', '#F44336', '#607D8B', '#795548', '#8BC34A',
];

const arc = (cx: number, cy: number, r: number, a1: number, a2: number) => {
  const rad1 = (a1 - 90) * Math.PI / 180;
  const rad2 = (a2 - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(rad1);
  const y1 = cy + r * Math.sin(rad1);
  const x2 = cx + r * Math.cos(rad2);
  const y2 = cy + r * Math.sin(rad2);
  const large = (a2 - a1) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${cx} ${cy} Z`;
};

const ScorePieChart: React.FC<Props> = ({ components, totalScore, gradeLetter, width = 280, selectedIndex, onSelectIndex, sliceHitRef }) => {
  const svgW = width + 20;
  const svgH = width + 20;
  const cx = svgW / 2;
  const cy = svgH / 2;
  const R = width / 2 - 6;
  const rInner = R * 0.42;
  const totalPct = components.reduce((s, c) => s + c.pct, 0) || 100;

  let cur = 0;
  const slices = components.map((c, i) => {
    const sweep = totalPct > 0 ? (c.pct / totalPct) * 360 : 0;
    const s = cur;
    const e = cur + sweep;
    cur = e;
    return { ...c, start: s, end: e, color: COLORS[i % COLORS.length] };
  });

  return (
    <View style={{ alignItems: 'center', position: 'relative' }}>
      <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <G>
          {/* 空白区域点击取消选中 */}
          <Rect x={0} y={0} width={svgW} height={svgH} fill="rgba(0,0,0,0.001)" onPress={() => onSelectIndex(null)} />
          {slices.map((s, i) => {
            /* xmcj 可能是加权分（≤权重）或原始分（>权重，百分制） */
            const maxScore = s.score > s.pct ? 100 : s.pct;
            const ratio = s.pct > 0 ? Math.min(s.score / maxScore, 1) : 0;
            const maxInnerR = R - 4; /* 留 4px 露出外圈满分区域 */
            const scoreR = rInner + (maxInnerR - rInner) * Math.pow(ratio, 0.7);
            const isSel = selectedIndex === i;
            return (
              <G key={i}>
                {/* 外圈（满分区域）—— 点击选中此项 */}
                <Path d={arc(cx, cy, R, s.start, s.end)} fill={s.color} opacity={isSel ? 0.6 : 0.35} onPress={() => { sliceHitRef.current = true; onSelectIndex(i); }} />
                {/* 内圈（得分区域）—— 点击选中此项 */}
                <Path d={arc(cx, cy, scoreR, s.start, s.end)} fill={s.color} opacity={isSel ? 1 : 0.85} onPress={() => { sliceHitRef.current = true; onSelectIndex(i); }} />
                {/* 选中亮边 */}
                {isSel && <Path d={arc(cx, cy, R + 2, s.start, s.end)} fill="none" stroke={s.color} strokeWidth={2.5} />}
              </G>
            );
          })}
            <Circle cx={cx} cy={cy} r={rInner} fill="#FFF" />
            {gradeLetter ? (
              <>
                <SvgText x={cx} y={cy + 5} textAnchor="middle" fontSize={22} fontWeight="800" fill="#0055A8">{gradeLetter}</SvgText>
                <SvgText x={cx} y={cy + 20} textAnchor="middle" fontSize={10} fill="#999">总评</SvgText>
              </>
            ) : (
              <>
                <SvgText x={cx} y={cy - 5} textAnchor="middle" fontSize={18} fontWeight="800" fill="#333">{totalScore}</SvgText>
                <SvgText x={cx} y={cy + 13} textAnchor="middle" fontSize={11} fill="#999">总评</SvgText>
              </>
            )}
          </G>
        </Svg>

      {/* 浮窗 */}
      {selectedIndex !== null && slices[selectedIndex] && (() => {
        const s = slices[selectedIndex];
        const mid = (s.start + s.end) / 2;
        const rad = (mid - 90) * Math.PI / 180;
        const tipX = cx + (R + 20) * Math.cos(rad);
        const tipY = cy + (R + 20) * Math.sin(rad);
        const onRight = mid > 270 || mid < 90;
        const boxW = 140;
        const boxH = 56;
        let boxX = onRight ? cx + R + 24 : cx - R - 24;
        let boxY = Math.max(10, Math.min(svgH - boxH - 10, tipY - boxH / 2));
        if (onRight) boxX = Math.min(boxX, svgW - boxW - 8);
        else boxX = Math.max(8, boxX - boxW);

        return (
          <View style={{
            position: 'absolute', left: boxX, top: boxY, width: boxW,
            paddingVertical: 8, paddingHorizontal: 12,
            backgroundColor: 'rgba(255,255,255,0.93)',
            borderRadius: 12,
            shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: s.color, marginBottom: 2 }}>{s.name}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: '#666' }}>占比 {s.pct}%</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#333' }}>{s.score}分</Text>
            </View>
          </View>
        );
      })()}
    </View>
  );
};

export default ScorePieChart;
