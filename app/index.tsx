import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import AccountSheet from '../components/AccountSheet';
import Bubbles from '../components/Bubbles';
import {
  LogEntry,
  Task,
  loadLog,
  loadTasks,
  loadTreat,
  onDataChange,
  saveLog,
  saveTasks,
  saveTreat,
  todayStr,
  uid,
  weekCount,
} from '../lib/storage';
import { useIosPWAKeyboard } from '../lib/useIosPWAKeyboard';

// Clean Bean pastel garden palette — ordered around the wheel so
// neighbors (including last→first wrap) stay visually distinct.
const COLORS = [
  '#F6C9B8', // peach
  '#BFE0EE', // sky
  '#B9D49B', // sage
  '#F4B8C4', // blush
  '#F0C86B', // gold
  '#CBB8E8', // lilac
  '#F3D6A8', // honey
  '#A9D6C9', // seafoam
  '#F1AFA0', // coral
  '#C6D9F0', // periwinkle
  '#E2C7D8', // mauve
  '#D7E3B0', // leaf
];

// Nearly everything here is pastel-light, so warm brown text reads best
// almost always — this only flips for the rare darker segment.
function labelColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#5B4636' : '#FFFFFF';
}

// Split at the word break that keeps the longer line shortest.
function wrapTwoLines(label: string): string[] {
  const words = label.split(' ');
  if (words.length === 1) return [label];
  let best = [label];
  let bestMax = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const m = Math.max(a.length, b.length);
    if (m < bestMax) {
      bestMax = m;
      best = [a, b];
    }
  }
  return best;
}

function WheelFace({ tasks, size }: { tasks: Task[]; size: number }) {
  const C = size / 2;
  const R = C - 4;
  const n = tasks.length;
  const per = 360 / n;
  const rad = (a: number) => (a * Math.PI) / 180;
  const pt = (a: number, r: number): [number, number] => [
    C + r * Math.cos(rad(a)),
    C + r * Math.sin(rad(a)),
  ];
  const baseFontSize = Math.max(13, Math.min(19, size * 0.05));
  const hubR = size * 0.09;
  // Radial room a label can occupy: from just outside the hub to the rim.
  const availLen = R * 0.93 - hubR - 10;

  return (
    <Svg width={size} height={size}>
      {n === 1 ? (
        <Circle cx={C} cy={C} r={R} fill={COLORS[0]} stroke="#FFFFFF" strokeWidth={4} />
      ) : (
        tasks.map((t, i) => {
          const a0 = i * per - 90;
          const [x0, y0] = pt(a0, R);
          const [x1, y1] = pt(a0 + per, R);
          return (
            <Path
              key={t.id}
              d={`M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${per > 180 ? 1 : 0} 1 ${x1} ${y1} Z`}
              fill={COLORS[i % COLORS.length]}
              stroke="#FFFFFF"
              strokeWidth={4}
            />
          );
        })
      )}
      {tasks.map((t, i) => {
        const mid = (i + 0.5) * per - 90;
        const norm = ((mid % 360) + 360) % 360;
        // Flip labels on the left half so they never render upside down.
        const flip = norm > 90 && norm < 270;
        const angle = flip ? mid + 180 : mid;
        const [lx, ly] = pt(mid, R * 0.93);
        const fill = labelColor(COLORS[i % COLORS.length]);
        const oneLineFs = availLen / (t.label.length * 0.54);
        let lines = [t.label];
        let fs = Math.min(baseFontSize, oneLineFs);
        if (oneLineFs < baseFontSize) {
          const two = wrapTwoLines(t.label);
          if (two.length === 2) {
            const maxLen = Math.max(two[0].length, two[1].length);
            const twoFs = availLen / (maxLen * 0.54);
            if (twoFs > oneLineFs) {
              lines = two;
              fs = Math.min(baseFontSize, twoFs);
            }
          }
        }
        fs = Math.max(8, fs);
        const lineOffset = fs * 0.62;
        return (
          <Fragment key={t.id}>
            {lines.map((line, li) => (
              <SvgText
                key={li}
                x={lx}
                y={
                  lines.length === 1
                    ? ly
                    : li === 0
                      ? ly - lineOffset
                      : ly + lineOffset
                }
                fill={fill}
                fontSize={fs}
                fontFamily="Nunito_800ExtraBold"
                textAnchor={flip ? 'start' : 'end'}
                alignmentBaseline="middle"
                transform={`rotate(${angle} ${lx} ${ly})`}
              >
                {line}
              </SvgText>
            ))}
          </Fragment>
        );
      })}
      <Circle cx={C} cy={C} r={hubR} fill="#FFFFFF" />
    </Svg>
  );
}

export default function WheelScreen() {
  const insets = useSafeAreaInsets();
  const iosPWAKeyboard = useIosPWAKeyboard();

  // Measured on the client via onLayout. Deriving this from
  // useWindowDimensions breaks under static rendering: the server renders
  // width 0 and hydration never repairs the stale SVG size attributes.
  const [wheelBox, setWheelBox] = useState<{ w: number; h: number } | null>(null);
  const size = wheelBox
    ? Math.floor(Math.min(wheelBox.w, wheelBox.h - 16, 640))
    : 0;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Task | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  // undefined = showing the task list; null = adding; Task = editing that task
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [treat, setTreat] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);

  const rotation = useRef(new Animated.Value(0)).current;
  const rotationTotal = useRef(0);

  useEffect(() => {
    const reload = () => {
      loadTasks().then(setTasks);
      loadLog().then(setLog);
      loadTreat().then(setTreat);
    };
    reload();
    return onDataChange(reload); // refresh when sync applies remote data
  }, []);

  const updateTasks = (next: Task[]) => {
    setTasks(next);
    saveTasks(next);
  };

  const spin = () => {
    if (spinning || tasks.length === 0) return;
    // Rewards aren't optional: no spinning until a treat is on the table.
    if (!treat.trim()) {
      setManageOpen(true);
      return;
    }
    const n = tasks.length;
    const idx = Math.floor(Math.random() * n);
    const per = 360 / n;
    // Rotation that puts segment idx's center under the top pointer.
    const desired = (360 - (idx + 0.5) * per + 360) % 360;
    const current = ((rotationTotal.current % 360) + 360) % 360;
    const target =
      rotationTotal.current + ((desired - current + 360) % 360) + 360 * 5;
    setSpinning(true);
    setResult(null);
    Animated.timing(rotation, {
      toValue: target,
      duration: 4200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      rotationTotal.current = target;
      setSpinning(false);
      setResult(tasks[idx]);
    });
  };

  const markDone = () => {
    if (!result) return;
    const next = [...log, { label: result.label, date: todayStr() }];
    setLog(next);
    saveLog(next);
    setResult(null);
  };

  const saveDraft = () => {
    const label = draft.trim();
    if (!label) return;
    if (editing) {
      updateTasks(tasks.map((t) => (t.id === editing.id ? { ...t, label } : t)));
    } else {
      updateTasks([...tasks, { id: uid(), label }]);
    }
    setEditing(undefined);
    setDraft('');
  };

  const deleteEditing = () => {
    if (!editing) return;
    updateTasks(tasks.filter((t) => t.id !== editing.id));
    setEditing(undefined);
    setDraft('');
  };

  const closeManage = () => {
    setManageOpen(false);
    setEditing(undefined);
    setDraft('');
  };

  const doneThisWeek = weekCount(log);
  const spinDeg = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[s.screen, { paddingTop: insets.top + 12 }]}>
      <Bubbles />
      <View style={s.content}>
        <View style={s.header}>
          <Text style={s.title}>clean bean</Text>
          <View style={s.headerRight}>
            <Pressable onPress={() => setManageOpen(true)} hitSlop={8}>
              <Text style={s.headerAction}>Edit tasks</Text>
            </Pressable>
            <Pressable onPress={() => setAccountOpen(true)} hitSlop={8} style={s.avatarBtn}>
              <Image
                source={require('../assets/mascot/bean-avatar.png')}
                style={s.avatarImg}
                resizeMode="contain"
              />
            </Pressable>
          </View>
        </View>
        <Text style={s.subtitle}>
          {doneThisWeek > 0
            ? `✨ ${doneThisWeek} bean${doneThisWeek === 1 ? '' : 's'} earned this week`
            : "What'll it bean today? Spin to find out 🌿"}
        </Text>

        <View
          style={s.wheelArea}
          onLayout={(e) => {
            const { width: w, height: h } = e.nativeEvent.layout;
            setWheelBox((prev) =>
              prev && prev.w === w && prev.h === h ? prev : { w, h }
            );
          }}
        >
          {size > 0 && (
            <View style={{ width: size, height: size }}>
              <View style={s.pointer} />
              <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
                <WheelFace tasks={tasks} size={size} />
              </Animated.View>
              <View pointerEvents="none" style={[s.hub, { width: size, height: size }]}>
                <View style={s.hubBadge}>
                  <Image
                    source={require('../assets/mascot/bean-avatar.png')}
                    style={{ width: size * 0.11, height: size * 0.11 }}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        <Pressable style={s.treatPill} onPress={() => setManageOpen(true)}>
          <Text style={s.treatPillText}>
            {treat.trim()
              ? `🍬 Reward: ${treat.trim()}`
              : '🍬 Set your reward first'}
          </Text>
        </Pressable>

        <Pressable
          onPress={spin}
          disabled={spinning || tasks.length === 0}
          style={({ pressed }) => [
            s.spinWrap,
            (pressed || spinning) && { transform: [{ scale: 0.97 }], opacity: 0.9 },
          ]}
        >
          <LinearGradient
            colors={['#9BC178', '#6F9E4C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.spinBtn}
          >
            <Text style={s.spinBtnText}>{spinning ? 'SPINNING…' : 'SPIN'}</Text>
            <Text style={s.spinSparkle}>✨</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Result overlay */}
      <Modal visible={!!result} transparent animationType="fade" onRequestClose={() => setResult(null)}>
        <View style={s.backdropCenter}>
          <View style={s.resultCard}>
            <Text style={s.confettiA}>🎊</Text>
            <Text style={s.confettiB}>🎉</Text>
            <Image
              source={require('../assets/mascot/bean-bubbles.png')}
              style={s.resultMascot}
              resizeMode="contain"
            />
            <Text style={s.resultLabel}>Your mission</Text>
            <Text style={s.resultTask}>{result?.label}</Text>
            {!!treat.trim() && (
              <Text style={s.treatText}>Then treat yourself: {treat} 🍬</Text>
            )}
            <Pressable onPress={markDone}>
              <LinearGradient
                colors={['#9BC178', '#6F9E4C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.doneBtn}
              >
                <Text style={s.doneBtnText}>Done! 🎉</Text>
              </LinearGradient>
            </Pressable>
            <View style={s.resultRow}>
              <Pressable
                style={s.ghostBtn}
                onPress={() => {
                  setResult(null);
                  setTimeout(spin, 50);
                }}
              >
                <Text style={s.ghostBtnText}>Spin again</Text>
              </Pressable>
              <Pressable style={s.ghostBtn} onPress={() => setResult(null)}>
                <Text style={s.ghostBtnText}>Later</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manage tasks sheet */}
      <Modal visible={manageOpen} transparent animationType="slide" onRequestClose={closeManage}>
        <View style={s.backdropBottom}>
          <Pressable style={s.backdropFill} onPress={closeManage} />
          <View
            style={[s.sheet, { paddingBottom: insets.bottom + 24 + iosPWAKeyboard }]}
          >
            <View style={s.sheetHeader}>
              {editing !== undefined ? (
                <Pressable onPress={() => { setEditing(undefined); setDraft(''); }} hitSlop={8}>
                  <Text style={s.headerAction}>‹ Back</Text>
                </Pressable>
              ) : (
                <Text style={s.sheetTitle}>Wheel tasks</Text>
              )}
              <Pressable onPress={closeManage} hitSlop={8}>
                <Text style={s.closeX}>✕</Text>
              </Pressable>
            </View>

            {editing === undefined ? (
              <>
                <Text style={s.inputLabel}>Treat when you finish a task</Text>
                <TextInput
                  style={s.input}
                  value={treat}
                  onChangeText={(v) => {
                    setTreat(v);
                    saveTreat(v);
                  }}
                  returnKeyType="done"
                  placeholder="Movie night, a treat, a nap…"
                  placeholderTextColor="#C9BBA3"
                />
                <Pressable
                  style={s.addBtn}
                  onPress={() => { setEditing(null); setDraft(''); }}
                >
                  <Text style={s.addBtnText}>+ Add a task</Text>
                </Pressable>
                <ScrollView
                  style={{ flexGrow: 0 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {tasks.map((t, i) => (
                    <Pressable
                      key={t.id}
                      style={s.taskRow}
                      onPress={() => { setEditing(t); setDraft(t.label); }}
                    >
                      <View
                        style={[s.taskDot, { backgroundColor: COLORS[i % COLORS.length] }]}
                      />
                      <Text style={s.taskRowText}>{t.label}</Text>
                      <Text style={s.taskRowChevron}>›</Text>
                    </Pressable>
                  ))}
                  {tasks.length === 0 && (
                    <Text style={s.emptyText}>No tasks — add one to spin!</Text>
                  )}
                </ScrollView>
              </>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
                <Text style={s.inputLabel}>Task</Text>
                <TextInput
                  style={s.input}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={saveDraft}
                  returnKeyType="done"
                />
                <Pressable onPress={saveDraft}>
                  <LinearGradient
                    colors={['#9BC178', '#6F9E4C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.doneBtn}
                  >
                    <Text style={s.doneBtnText}>{editing ? 'Save' : 'Add to wheel'}</Text>
                  </LinearGradient>
                </Pressable>
                {editing && (
                  <Pressable style={s.deleteBtn} onPress={deleteEditing}>
                    <Text style={s.deleteBtnText}>Delete task</Text>
                  </Pressable>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#CDE8F3', paddingHorizontal: 20 },
  content: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', color: '#5B4636', letterSpacing: 0.2 },
  headerAction: { fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#5E8A44' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#F6C9B8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 32, height: 32, marginTop: 5 },
  subtitle: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#7E9A5E', marginTop: 6 },

  wheelArea: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  pointer: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#5B4636',
    zIndex: 2,
  },
  hub: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubBadge: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5B4636',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  treatPill: {
    alignSelf: 'center',
    backgroundColor: '#FBE7E2',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  treatPillText: { fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#B26558' },

  spinWrap: { marginBottom: 24, borderRadius: 999 },
  spinBtn: {
    borderRadius: 999,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#6F9E4C',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  spinBtnText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 3,
  },
  spinSparkle: { position: 'absolute', top: 10, right: 26, fontSize: 14 },

  backdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(74,59,44,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 26,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    position: 'relative',
  },
  confettiA: { position: 'absolute', top: 14, left: 22, fontSize: 16 },
  confettiB: { position: 'absolute', top: 8, right: 26, fontSize: 18 },
  resultMascot: { width: 116, height: 116, marginTop: 4 },
  resultLabel: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: '#8A7A68',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  resultTask: {
    fontSize: 25,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#4A3B2C',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  treatText: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: '#8A7A68',
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 18,
  },
  doneBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
    shadowColor: '#6F9E4C',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Nunito_800ExtraBold' },
  resultRow: { flexDirection: 'row', gap: 20, marginTop: 14 },
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  ghostBtnText: { color: '#8A7A68', fontSize: 15, fontFamily: 'Nunito_700Bold' },

  backdropBottom: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(74,59,44,0.5)' },
  backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#FCF6EA',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 19, fontFamily: 'Nunito_800ExtraBold', color: '#4A3B2C' },
  closeX: { fontSize: 18, color: '#8A7A68', fontFamily: 'Nunito_800ExtraBold' },

  addBtn: {
    borderWidth: 2,
    borderColor: '#7FA35C',
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtnText: { color: '#5E8A44', fontSize: 16, fontFamily: 'Nunito_700Bold' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E7D3',
  },
  taskDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  taskRowText: { flex: 1, fontSize: 16, fontFamily: 'Nunito_600SemiBold', color: '#4A3B2C' },
  taskRowChevron: { fontSize: 20, color: '#D9C9AE' },
  emptyText: {
    textAlign: 'center',
    color: '#8A7A68',
    paddingVertical: 24,
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
  },

  inputLabel: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#8A7A68', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E6D9C4',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: 'Nunito_600SemiBold',
    color: '#4A3B2C',
    marginBottom: 16,
    minHeight: 48,
  },
  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  deleteBtnText: { color: '#C4645A', fontSize: 15, fontFamily: 'Nunito_700Bold' },
});
