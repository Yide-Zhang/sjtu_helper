import React, { useRef, useState, useMemo } from 'react';
import { View, LayoutChangeEvent } from 'react-native';

export interface DynamicSection {
  id: string;
  priority: number;
  render: () => React.ReactNode;
}

interface Props {
  sections: DynamicSection[];
  colStyle?: any;
  twoColStyle?: any;
}

/**
 * 动态双栏布局 — 使用 onLayout 实时测量每个区块的实际高度，
 * 数据变化或高度变化时自动按优先级重新贪心排列到最短列。
 */
export const DynamicTwoCol: React.FC<Props> = ({ sections, colStyle, twoColStyle }) => {
  const measH = useRef<Record<string, number>>({});
  const [tick, setTick] = useState(0);
  const pendingRef = useRef(false);

  const onLayoutRef = useRef<(id: string, e: LayoutChangeEvent) => void>(undefined);
  onLayoutRef.current = (id: string, e: LayoutChangeEvent) => {
    const raw = e.nativeEvent.layout.height;
    const h = Math.round(raw);
    const prev = measH.current[id];
    if (prev === undefined || Math.abs(h - prev) >= 5) {
      measH.current[id] = h;
      if (!pendingRef.current) {
        pendingRef.current = true;
        requestAnimationFrame(() => {
          pendingRef.current = false;
          setTick(n => n + 1);
        });
      }
    }
  };

  const [col0, col1] = useMemo(() => {
    const sorted = [...sections].sort((a, b) => a.priority - b.priority);
    const colH = [0, 0];
    const items: [React.ReactNode[], React.ReactNode[]] = [[], []];
    const meas = measH.current;
    const onLay = onLayoutRef.current!;

    for (const sec of sorted) {
      const estH = meas[sec.id] ?? 100;
      const idx = colH[0] <= colH[1] ? 0 : 1;
      items[idx].push(
        <View key={sec.id} onLayout={(e) => onLay(sec.id, e)}>
          {sec.render()}
        </View>
      );
      colH[idx] += estH;
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, tick]);

  return (
    <View style={[{ flexDirection: 'row', gap: 10 }, twoColStyle]}>
      <View style={[{ flex: 1 }, colStyle]}>{col0}</View>
      <View style={[{ flex: 1 }, colStyle]}>{col1}</View>
    </View>
  );
};
