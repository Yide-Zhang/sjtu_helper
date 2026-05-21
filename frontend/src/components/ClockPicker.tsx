import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Animated, Easing } from 'react-native';

interface Props {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}

const CLOCK_SIZE = 180;
const CX = CLOCK_SIZE / 2;
const CY = CLOCK_SIZE / 2;
const RADIUS = CLOCK_SIZE / 2 - 10;
const HOUR_MARKS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const pad = (n: number) => String(n).padStart(2, '0');

export const ClockPicker: React.FC<Props> = ({ 
  hour, minute, onHourChange, onMinuteChange
}) => {
  const [activeHand, setActiveHand] = useState<'hour' | 'minute'>('hour');
  const activeRef = useRef(activeHand);
  activeRef.current = activeHand;

  const [localHour, setLocalHour] = useState(hour);
  const [localMinute, setLocalMinute] = useState(minute);
  
  const isPMRef = useRef(hour >= 12);
  const [localIsPM, setLocalIsPM] = useState(hour >= 12);

  const internalMinutesRef = useRef(hour * 60 + minute);
  const lastAngleRef = useRef<number | null>(null);
  const clockCenterRef = useRef({ pageX: 0, pageY: 0 });
  const isInteracting = useRef(false);

  // 物理角度轴
  const initMinDeg = (minute / 60) * 360;
  const initHourDeg = ((hour % 12) / 12) * 360 + (minute / 60) * 30;

  const currentMinAngleRef = useRef(initMinDeg);
  const currentHourAngleRef = useRef(initHourDeg);

  const hourAnimAngle = useRef(new Animated.Value(initHourDeg)).current;
  const minuteAnimAngle = useRef(new Animated.Value(initMinDeg)).current;

  // 全原生不透明度轴
  const pmOpacity = useRef(new Animated.Value(hour >= 12 ? 1 : 0)).current;
  const lastAnimTargetRef = useRef<number>(hour >= 12 ? 1 : 0);

  useEffect(() => {
    if (!isInteracting.current) {
      internalMinutesRef.current = hour * 60 + minute;
      setLocalHour(hour);
      setLocalMinute(minute);
      setLocalIsPM(hour >= 12);
      isPMRef.current = hour >= 12;

      const targetMinDeg = (minute / 60) * 360;
      const targetHourDeg = ((hour % 12) / 12) * 360 + (minute / 60) * 30;

      currentMinAngleRef.current = targetMinDeg;
      currentHourAngleRef.current = targetHourDeg;
      hourAnimAngle.setValue(targetHourDeg);
      minuteAnimAngle.setValue(targetMinDeg);

      const targetOpacity = hour >= 12 ? 1 : 0;
      lastAnimTargetRef.current = targetOpacity;
      Animated.timing(pmOpacity, { toValue: targetOpacity, duration: 120, useNativeDriver: true }).start();
    }
  }, [hour, minute]);

  const triggerColorFade = (target: number) => {
    if (lastAnimTargetRef.current === target) return;
    lastAnimTargetRef.current = target;
    Animated.timing(pmOpacity, { toValue: target, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  const handleLocalAmPmToggle = () => {
    const isNowPM = internalMinutesRef.current >= 720;
    const delta = isNowPM ? -720 : 720;
    const nextTotalMins = ((internalMinutesRef.current + delta) % 1440 + 1440) % 1440;
    internalMinutesRef.current = nextTotalMins;

    const calcHour24 = Math.floor(nextTotalMins / 60);
    const calcMinute = Math.floor(nextTotalMins % 60);

    setLocalHour(calcHour24);
    setLocalMinute(calcMinute);
    setLocalIsPM(calcHour24 >= 12);
    isPMRef.current = calcHour24 >= 12;

    triggerColorFade(calcHour24 >= 12 ? 1 : 0);
    onHourChange(calcHour24);
    onMinuteChange(calcMinute);
  };

  const handleArrowStepAnimation = (isIncrement: boolean, type: 'hour' | 'minute') => {
    isInteracting.current = true;
    let deltaMinutes = type === 'hour' ? (isIncrement ? 60 : -60) : (isIncrement ? 1 : -1);
    const nextTotalMins = ((internalMinutesRef.current + deltaMinutes) % 1440 + 1440) % 1440;
    internalMinutesRef.current = nextTotalMins;

    const calcHour24 = Math.floor(nextTotalMins / 60);
    const calcMinute = Math.floor(nextTotalMins % 60);

    setLocalHour(calcHour24);
    setLocalMinute(calcMinute);
    
    const checkIsPM = calcHour24 >= 12;
    if (checkIsPM !== isPMRef.current) {
      isPMRef.current = checkIsPM;
      setLocalIsPM(checkIsPM);
      triggerColorFade(checkIsPM ? 1 : 0);
    }

    const diffMin = type === 'minute' ? (isIncrement ? 6 : -6) : 0;
    const diffHour = type === 'hour' ? (isIncrement ? 30 : -30) : (isIncrement ? 0.5 : -0.5);

    const targetMinAngle = currentMinAngleRef.current + diffMin;
    const targetHourAngle = currentHourAngleRef.current + diffHour;

    currentMinAngleRef.current = targetMinAngle;
    currentHourAngleRef.current = targetHourAngle;

    Animated.parallel([
      Animated.timing(minuteAnimAngle, { toValue: targetMinAngle, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(hourAnimAngle, { toValue: targetHourAngle, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true })
    ]).start(() => {
      isInteracting.current = false;
      onHourChange(calcHour24);
      onMinuteChange(calcMinute);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isInteracting.current = true;
        const normalizedMin = ((currentMinAngleRef.current % 360) + 360) % 360;
        const normalizedHour = ((currentHourAngleRef.current % 360) + 360) % 360;
        currentMinAngleRef.current = normalizedMin;
        currentHourAngleRef.current = normalizedHour;
        minuteAnimAngle.setValue(normalizedMin);
        hourAnimAngle.setValue(normalizedHour);

        const touchPageX = evt.nativeEvent.pageX;
        const touchPageY = evt.nativeEvent.pageY;
        const touchLocationX = evt.nativeEvent.locationX;
        const touchLocationY = evt.nativeEvent.locationY;

        clockCenterRef.current = { pageX: touchPageX - touchLocationX + CX, pageY: touchPageY - touchLocationY + CY };

        const dx = touchPageX - clockCenterRef.current.pageX;
        const dy = touchPageY - clockCenterRef.current.pageY;
        const raw = Math.atan2(dy, dx);
        lastAngleRef.current = (((raw + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) * (180 / Math.PI);
      },
      onPanResponderMove: (evt) => {
        const touchPageX = evt.nativeEvent.pageX;
        const touchPageY = evt.nativeEvent.pageY;
        const dx = touchPageX - clockCenterRef.current.pageX;
        const dy = touchPageY - clockCenterRef.current.pageY;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

        const raw = Math.atan2(dy, dx);
        const currentAngle = (((raw + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) * (180 / Math.PI);
        if (lastAngleRef.current === null) { lastAngleRef.current = currentAngle; return; }

        let deltaAngle = currentAngle - lastAngleRef.current;
        if (deltaAngle > 180) deltaAngle -= 360;
        if (deltaAngle < -180) deltaAngle += 360;
        lastAngleRef.current = currentAngle;

        const mode = activeRef.current;
        let currentTotalMinutes = internalMinutesRef.current;
        if (mode === 'minute') { currentTotalMinutes += deltaAngle * (60 / 360); } else { currentTotalMinutes += deltaAngle * (720 / 360); }

        currentTotalMinutes = (currentTotalMinutes % 1440 + 1440) % 1440;
        internalMinutesRef.current = currentTotalMinutes;

        const finalMinAngle = (currentTotalMinutes % 60) / 60 * 360;
        const finalHourAngle = ((currentTotalMinutes % 720) / 720) * 360;

        currentMinAngleRef.current = finalMinAngle;
        currentHourAngleRef.current = finalHourAngle;
        minuteAnimAngle.setValue(finalMinAngle);
        hourAnimAngle.setValue(finalHourAngle);

        const calcHour24 = Math.floor(currentTotalMinutes / 60);
        setLocalHour(calcHour24);
        setLocalMinute(Math.floor(currentTotalMinutes % 60));
        
        const checkIsPM = calcHour24 >= 12;
        if (checkIsPM !== isPMRef.current) {
          isPMRef.current = checkIsPM;
          setLocalIsPM(checkIsPM);
          triggerColorFade(checkIsPM ? 1 : 0);
        }
      },
      onPanResponderRelease: () => {
        lastAngleRef.current = null;
        let snappedMinutes = Math.round(internalMinutesRef.current);
        snappedMinutes = (snappedMinutes % 1440 + 1440) % 1440;
        internalMinutesRef.current = snappedMinutes;

        const finalHour = Math.floor(snappedMinutes / 60);
        const finalMinute = snappedMinutes % 60;

        const targetMinAngle = (finalMinute / 60) * 360;
        const targetHourAngle = ((finalHour % 12) / 12) * 360 + (finalMinute / 60) * 30;

        let diffMin = targetMinAngle - currentMinAngleRef.current;
        if (diffMin > 180) diffMin -= 360; if (diffMin < -180) diffMin += 360;
        let diffHour = targetHourAngle - currentHourAngleRef.current;
        if (diffHour > 180) diffHour -= 360; if (diffHour < -180) diffHour += 360;

        const endMinAngle = currentMinAngleRef.current + diffMin;
        const endHourAngle = currentHourAngleRef.current + diffHour;

        currentMinAngleRef.current = endMinAngle;
        currentHourAngleRef.current = endHourAngle;

        Animated.parallel([
          Animated.spring(minuteAnimAngle, { toValue: endMinAngle, useNativeDriver: true, tension: 160, friction: 14 }),
          Animated.spring(hourAnimAngle, { toValue: endHourAngle, useNativeDriver: true, tension: 160, friction: 14 })
        ]).start(() => {
          isInteracting.current = false;
          onHourChange(finalHour);
          onMinuteChange(finalMinute);
        });
      }
    })
  ).current;

  const hourRotate = hourAnimAngle.interpolate({ inputRange: [-50000, 50000], outputRange: ['-50000deg', '50000deg'] });
  const minuteRotate = minuteAnimAngle.interpolate({ inputRange: [-50000, 50000], outputRange: ['-50000deg', '50000deg'] });

  const amViewOpacity = pmOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const pmViewOpacity = pmOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.container}>
      {/* AM/PM 按钮 */}
      <View style={styles.ampmContainer}>
        <TouchableOpacity onPress={handleLocalAmPmToggle} activeOpacity={0.85} style={styles.ampmBtnWrapper}>
          <Animated.View style={[styles.ampmBtn, styles.ampmBtnAM, { opacity: amViewOpacity }]} />
          <Animated.View style={[styles.ampmBtn, styles.ampmBtnPM, { opacity: pmViewOpacity }]} />
          <Text style={[styles.ampmBtnText, localIsPM ? styles.ampmBtnTextPM : styles.ampmBtnTextAM]}>
            {localIsPM ? '下午 PM' : '上午 AM'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 数字步进面板 */}
      <View style={styles.digitalCol}>
        <View style={styles.digitalRow}>
          <View style={styles.digitBlock}>
            <TouchableOpacity onPress={() => handleArrowStepAnimation(false, 'hour')} style={styles.stepArrow} activeOpacity={0.5}><Text style={styles.stepArrowText}>▲</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveHand('hour')} activeOpacity={0.6}>
              <View style={[styles.digitBox, activeHand === 'hour' && styles.digitBoxActive]}>
                <Text style={[styles.digit, activeHand === 'hour' && styles.digitActive]}>{pad(localHour)}</Text>
                <Text style={[styles.digitLabel, activeHand === 'hour' && styles.digitLabelActive]}>时</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleArrowStepAnimation(true, 'hour')} style={styles.stepArrow} activeOpacity={0.5}><Text style={styles.stepArrowText}>▼</Text></TouchableOpacity>
          </View>
          <Text style={styles.digitSep}>:</Text>
          <View style={styles.digitBlock}>
            <TouchableOpacity onPress={() => handleArrowStepAnimation(false, 'minute')} style={styles.stepArrow} activeOpacity={0.5}><Text style={styles.stepArrowText}>▲</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveHand('minute')} activeOpacity={0.6}>
              <View style={[styles.digitBox, activeHand === 'minute' && styles.digitBoxActive]}>
                <Text style={[styles.digit, activeHand === 'minute' && styles.digitActive]}>{pad(localMinute)}</Text>
                <Text style={[styles.digitLabel, activeHand === 'minute' && styles.digitLabelActive]}>分</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleArrowStepAnimation(true, 'minute')} style={styles.stepArrow} activeOpacity={0.5}><Text style={styles.stepArrowText}>▼</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 核心双层交叠盘面 */}
      <View style={styles.clockContainer} {...panResponder.panHandlers}>
        {/* ==================== 上午白色底层 ==================== */}
        <Animated.View style={[styles.clockFace, styles.clockFaceAM, { opacity: amViewOpacity }]}>
          {HOUR_MARKS.map((h, i) => {
            const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
            return <Text key={`am-${h}`} style={[styles.hourMarkText, styles.hourMarkTextAM, { left: CX + RADIUS * Math.cos(angle) - 18, top: CY + RADIUS * Math.sin(angle) - 14 }]}>{h}</Text>;
          })}
          {Array.from({ length: 60 }, (_, i) => i % 5 !== 0 && <View key={`am-t${i}`} style={[styles.minuteTick, styles.minuteTickAM, { left: CX + (RADIUS - 12) * Math.cos((i / 60) * 2 * Math.PI - Math.PI / 2) - 1, top: CY + (RADIUS - 12) * Math.sin((i / 60) * 2 * Math.PI - Math.PI / 2) - 1, transform: [{ rotate: `${(i / 60) * 360}deg` }] }]} />)}
          
          {/* 🌟 上午独立无污染原心轴 */}
          <View style={styles.pointerBridge}>
            <Animated.View style={[styles.hand, styles.hourHand, styles.hourHandAM, activeHand === 'hour' && styles.handActive, { transform: [{ rotate: hourRotate }] }]} />
            <Animated.View style={[styles.hand, styles.minuteHand, styles.minuteHandAM, activeHand === 'minute' && styles.handActive, { transform: [{ rotate: minuteRotate }] }]} />
            <View style={[styles.centerDot, activeHand === 'hour' ? styles.hourHandAM : styles.minuteHandAM]} />
          </View>
        </Animated.View>

        {/* ==================== 下午黑色顶层 ==================== */}
        <Animated.View style={[styles.clockFace, styles.clockFacePM, { opacity: pmViewOpacity }, StyleSheet.absoluteFill]}>
          {HOUR_MARKS.map((h, i) => {
            const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
            return <Text key={`pm-${h}`} style={[styles.hourMarkText, styles.hourMarkTextPM, { left: CX + RADIUS * Math.cos(angle) - 18, top: CY + RADIUS * Math.sin(angle) - 14 }]}>{h}</Text>;
          })}
          {Array.from({ length: 60 }, (_, i) => i % 5 !== 0 && <View key={`pm-t${i}`} style={[styles.minuteTick, styles.minuteTickPM, { left: CX + (RADIUS - 12) * Math.cos((i / 60) * 2 * Math.PI - Math.PI / 2) - 1, top: CY + (RADIUS - 12) * Math.sin((i / 60) * 2 * Math.PI - Math.PI / 2) - 1, transform: [{ rotate: `${(i / 60) * 360}deg` }] }]} />)}
          
          {/* 🌟 下午独立无污染原心轴 */}
          <View style={styles.pointerBridge}>
            <Animated.View style={[styles.hand, styles.hourHand, styles.hourHandPM, activeHand === 'hour' && styles.handActive, { transform: [{ rotate: hourRotate }] }]} />
            <Animated.View style={[styles.hand, styles.minuteHand, styles.minuteHandPM, activeHand === 'minute' && styles.handActive, { transform: [{ rotate: minuteRotate }] }]} />
            <View style={[styles.centerDot, activeHand === 'hour' ? styles.hourHandPM : styles.minuteHandPM]} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: '#F9FAFC', borderRadius: 14, padding: 14, marginBottom: 12 },
  ampmContainer: { marginBottom: 10, width: 160, height: 44 },
  ampmBtnWrapper: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  ampmBtn: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 24, borderWidth: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  ampmBtnAM: { backgroundColor: '#E8F0FE', borderColor: '#0055A8' },
  ampmBtnPM: { backgroundColor: '#1A1A2E', borderColor: '#7C4DFF' },
  ampmBtnText: { fontSize: 16, fontWeight: '800', zIndex: 10 },
  ampmBtnTextAM: { color: '#0055A8' },
  ampmBtnTextPM: { color: '#FFF' },
  digitalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  digitalCol: { alignItems: 'center', marginBottom: 12 },
  digitBlock: { alignItems: 'center' },
  stepArrow: { paddingVertical: 2, paddingHorizontal: 12 },
  stepArrowText: { fontSize: 12, color: '#0055A8', fontWeight: '700' },
  digitBox: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F2F5' },
  digitBoxActive: { backgroundColor: '#0055A8' },
  digit: { fontSize: 28, fontWeight: '800', color: '#333' },
  digitActive: { color: '#FFF' },
  digitLabel: { fontSize: 11, color: '#999', marginTop: -2 },
  digitLabelActive: { color: '#FFF' },
  digitSep: { fontSize: 28, fontWeight: '800', color: '#CCC', marginHorizontal: 4 },
  
  clockContainer: { width: CLOCK_SIZE, height: CLOCK_SIZE, position: 'relative' },
  clockFace: { width: CLOCK_SIZE, height: CLOCK_SIZE, borderRadius: CLOCK_SIZE / 2, borderWidth: 2, position: 'relative' },
  clockFaceAM: { backgroundColor: '#FFF', borderColor: '#E2E8F0' },
  clockFacePM: { backgroundColor: '#1A1A2E', borderColor: '#333366' },
  
  hourMarkText: { position: 'absolute', width: 36, height: 28, textAlign: 'center', lineHeight: 28, fontSize: 14, fontWeight: '700' },
  hourMarkTextAM: { color: '#333' },
  hourMarkTextPM: { color: '#DDD' },
  minuteTick: { position: 'absolute', width: 2, height: 4, borderRadius: 1 },
  minuteTickAM: { backgroundColor: '#CCC' },
  minuteTickPM: { backgroundColor: '#555' },

  // ==================== 🌟 核心增设：零污染物理原心桥接层 ====================
  pointerBridge: {
    position: 'absolute',
    top: CY, // 强行定死在绝对几何中线的 Y 轴
    left: CX, // 强行定死在绝对几何中线的 X 轴
    width: 0,
    height: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  
  hand: { 
    position: 'absolute', 
    borderTopLeftRadius: 3, 
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 1.5,
    borderBottomRightRadius: 1.5,
    transformOrigin: 'bottom center' 
  },
  // 时针：因为父级 pointerBridge 已经把原点定在中心，指针直接以 bottom: 0 向上长出
  hourHand: { 
    width: 4, 
    height: 46, 
    bottom: 0,  
    left: -2 // 宽度的一半，实现完美左右居中
  },
  // 分针：直接以 bottom: 0 向上长出
  minuteHand: { 
    width: 3, 
    height: 66, 
    bottom: 0,  
    left: -1.5 // 宽度的一半，实现完美左右居中
  },
  
  hourHandAM: { backgroundColor: '#0055A8' },
  minuteHandAM: { backgroundColor: '#E53935' },
  hourHandPM: { backgroundColor: '#7C4DFF' },
  minuteHandPM: { backgroundColor: '#FF6F00' },
  
  handActive: { opacity: 1, shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 2 },
  
  // 中心轴盖子：同样直接在 0 尺寸原点里居中摆放
  centerDot: { 
    position: 'absolute', 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    top: -6, 
    left: -6, 
    borderWidth: 2, 
    borderColor: '#FFF',
    zIndex: 100 
  },
});