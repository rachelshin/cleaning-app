import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import {
  LogEntry,
  Task,
  loadLog,
  loadTasks,
  loadTreat,
  saveLog,
  saveTasks,
  saveTreat,
  todayStr,
  uid,
  weekCount,
} from '../lib/storage';
import { useIosPWAKeyboard } from '../lib/useIosPWAKeyboard';

const COLORS = [
  '#9D5B43', '#A87C33', '#6E7F45', '#3F7561', '#35748C', '#4C6B95',
  '#64548C', '#8A5878', '#A05262', '#7A6A55', '#566A76', '#8C6B4F',
];

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
  const fontSize = n <= 6 ? 13 : n <= 10 ? 11.5 : 10.5;
  const maxChars = n <= 8 ? 18 : 15;

  return (
    <Svg width={size} height={size}>
      {n === 1 ? (
        <Circle cx={C} cy={C} r={R} fill={COLORS[0]} stroke="#FFFFFF" strokeWidth={2} />
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
              strokeWidth={2}
            />
          );
        })
      )}
      {tasks.map((t, i) => {
        const mid = (i + 0.5) * per - 90;
        const norm = ((mid % 360) + 360) % 360;
        // Flip labels on the left half so they never render upside down.
        const angle = norm > 90 && norm < 270 ? mid + 180 : mid;
        const [lx, ly] = pt(mid, R * 0.62);
        const label =
          t.label.length > maxChars ? t.label.slice(0, maxChars - 1) + '…' : t.label;
        return (
          <SvgText
            key={t.id}
            x={lx}
            y={ly}
            fill="#FFFFFF"
            fontSize={fontSize}
            fontWeight="700"
            textAnchor="middle"
            alignmentBaseline="middle"
            transform={`rotate(${angle} ${lx} ${ly})`}
          >
            {label}
          </SvgText>
        );
      })}
      <Circle cx={C} cy={C} r={size * 0.085} fill="#FFFFFF" />
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
    ? Math.floor(Math.min(wheelBox.w, wheelBox.h - 16, 340))
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

  const rotation = useRef(new Animated.Value(0)).current;
  const rotationTotal = useRef(0);

  useEffect(() => {
    loadTasks().then(setTasks);
    loadLog().then(setLog);
    loadTreat().then(setTreat);
  }, []);

  const updateTasks = (next: Task[]) => {
    setTasks(next);
    saveTasks(next);
  };

  const spin = () => {
    if (spinning || tasks.length === 0) return;
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
      <View style={s.header}>
        <Text style={s.title}>Spin to Clean 🧽</Text>
        <Pressable onPress={() => setManageOpen(true)} hitSlop={8}>
          <Text style={s.headerAction}>Edit tasks</Text>
        </Pressable>
      </View>
      <Text style={s.subtitle}>
        {doneThisWeek > 0
          ? `✨ ${doneThisWeek} task${doneThisWeek === 1 ? '' : 's'} crushed this week`
          : 'Spin the wheel — future you says thanks'}
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
            <View pointerEvents="none" style={s.hub}>
              <Text style={{ fontSize: size * 0.09 }}>🧹</Text>
            </View>
          </View>
        )}
      </View>

      <Pressable
        onPress={spin}
        disabled={spinning || tasks.length === 0}
        style={({ pressed }) => [
          s.spinBtn,
          (pressed || spinning) && { opacity: 0.7 },
        ]}
      >
        <Text style={s.spinBtnText}>{spinning ? 'Spinning…' : 'SPIN'}</Text>
      </Pressable>

      {/* Result overlay */}
      <Modal visible={!!result} transparent animationType="fade" onRequestClose={() => setResult(null)}>
        <View style={s.backdropCenter}>
          <View style={s.resultCard}>
            <Text style={s.resultEmoji}>🎯</Text>
            <Text style={s.resultLabel}>Your mission</Text>
            <Text style={s.resultTask}>{result?.label}</Text>
            {!!treat.trim() && (
              <Text style={s.treatText}>Then treat yourself: {treat} 🍬</Text>
            )}
            <Pressable style={s.doneBtn} onPress={markDone}>
              <Text style={s.doneBtnText}>Done! 🎉</Text>
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
                <Pressable style={s.doneBtn} onPress={saveDraft}>
                  <Text style={s.doneBtnText}>{editing ? 'Save' : 'Add to wheel'}</Text>
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
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F3EE', paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#33302E' },
  headerAction: { fontSize: 15, fontWeight: '700', color: '#3F7561' },
  subtitle: { fontSize: 14, color: '#8A8480', marginTop: 4 },

  wheelArea: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  pointer: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#33302E',
    zIndex: 2,
  },
  hub: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  spinBtn: {
    backgroundColor: '#2E2A26',
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  spinBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 2 },

  backdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(30,25,20,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  resultEmoji: { fontSize: 44 },
  resultLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A8480',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  resultTask: {
    fontSize: 24,
    fontWeight: '800',
    color: '#33302E',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  treatText: {
    fontSize: 15,
    color: '#8A8480',
    textAlign: 'center',
    marginTop: -10,
    marginBottom: 20,
  },
  doneBtn: {
    backgroundColor: '#3F7561',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  resultRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  ghostBtnText: { color: '#8A8480', fontSize: 15, fontWeight: '700' },

  backdropBottom: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,25,20,0.55)' },
  backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#33302E' },
  closeX: { fontSize: 20, color: '#8A8480', fontWeight: '600' },

  addBtn: {
    borderWidth: 2,
    borderColor: '#3F7561',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  addBtnText: { color: '#3F7561', fontSize: 16, fontWeight: '700' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F2EDE4',
  },
  taskDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  taskRowText: { flex: 1, fontSize: 16, color: '#33302E' },
  taskRowChevron: { fontSize: 20, color: '#C9C3BC' },
  emptyText: { textAlign: 'center', color: '#8A8480', paddingVertical: 24, fontSize: 15 },

  inputLabel: { fontSize: 14, fontWeight: '700', color: '#8A8480', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5DFD5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#33302E',
    marginBottom: 16,
    minHeight: 48,
  },
  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  deleteBtnText: { color: '#A64D57', fontSize: 15, fontWeight: '700' },
});
