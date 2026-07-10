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
import {
  bestStreak,
  dayChance,
  Habit,
  lastNDays,
  loadHabits,
  loadSuggestDismissed,
  onDataChange,
  saveHabits,
  saveSuggestDismissed,
  streak,
  SUGGEST_AFTER_STREAK,
  SUGGEST_CHANCE,
  todayStr,
  uid,
} from '../lib/storage';
import { useIosPWAKeyboard } from '../lib/useIosPWAKeyboard';
import Bubbles from '../components/Bubbles';

// The hero card's big button: a bean waiting in a dashed slot, gently
// pulsing until it's tapped, then a solid green check.
function HeroCheck({ done, onPress }: { done: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (done) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [done, pulse]);

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={[
          s.heroCheck,
          done && s.heroCheckOn,
          { transform: [{ scale: pulse }] },
        ]}
      >
        <Text style={done ? s.heroCheckMark : s.heroCheckBean}>
          {done ? '✓' : '🫘'}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function HabitsScreen() {
  const insets = useSafeAreaInsets();
  const iosPWAKeyboard = useIosPWAKeyboard();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // null = adding a new habit; Habit = editing that habit
  const [editing, setEditing] = useState<Habit | null>(null);
  const [draft, setDraft] = useState('');
  const [draftTreat, setDraftTreat] = useState('');
  const [draftPair, setDraftPair] = useState('');
  const [formError, setFormError] = useState('');
  const [celebrating, setCelebrating] = useState<Habit | null>(null);
  const [suggestDismissed, setSuggestDismissed] = useState<string | null>(null);

  useEffect(() => {
    const reload = () => {
      loadHabits().then((h) => {
        setHabits(h);
        setLoaded(true);
      });
      loadSuggestDismissed().then(setSuggestDismissed);
    };
    reload();
    return onDataChange(reload); // refresh when sync applies remote data
  }, []);

  const update = (next: Habit[]) => {
    setHabits(next);
    saveHabits(next);
  };

  const today = todayStr();
  const days = lastNDays(14);
  const doneToday = habits.filter((h) => h.done[today]).length;
  const streaks = habits.map((h) => streak(h.done));
  // Quiet suggestion: only once every habit has held a solid streak, and
  // then only on a random ~30% of days — never announced, never counted
  // down, so success doesn't look like it earns more work.
  const suggestAdd =
    habits.length > 0 &&
    streaks.every((s) => s >= SUGGEST_AFTER_STREAK) &&
    dayChance(today, SUGGEST_CHANCE) &&
    suggestDismissed !== today;

  const dismissSuggest = () => {
    setSuggestDismissed(today);
    saveSuggestDismissed(today);
  };

  const toggleToday = (habit: Habit) => {
    const turningOn = !habit.done[today];
    const next = habits.map((h) => {
      if (h.id !== habit.id) return h;
      const done = { ...h.done };
      if (done[today]) delete done[today];
      else done[today] = true;
      return { ...h, done };
    });
    update(next);
    if (turningOn) setCelebrating(next.find((h) => h.id === habit.id) ?? null);
  };

  const openAdd = () => {
    setEditing(null);
    setDraft('');
    setDraftTreat('');
    setDraftPair('');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (habit: Habit) => {
    setEditing(habit);
    setDraft(habit.label);
    setDraftTreat(habit.reward ?? '');
    setDraftPair(habit.pairing ?? '');
    setFormError('');
    setModalOpen(true);
  };

  const saveDraft = () => {
    const label = draft.trim();
    if (!label) {
      setFormError('Give your habit a name.');
      return;
    }
    const reward = draftTreat.trim();
    if (!reward) {
      setFormError('Every bean needs a treat — add one!');
      return;
    }
    const pairing = draftPair.trim() || undefined;
    if (editing) {
      update(
        habits.map((h) =>
          h.id === editing.id ? { ...h, label, reward, pairing } : h
        )
      );
    } else {
      update([...habits, { id: uid(), label, reward, pairing, done: {} }]);
    }
    setModalOpen(false);
  };

  const deleteEditing = () => {
    if (!editing) return;
    update(habits.filter((h) => h.id !== editing.id));
    setModalOpen(false);
  };

  const subtitle =
    habits.length === 0
      ? 'Every big bean starts as a tiny sprout'
      : doneToday === habits.length
        ? 'All done for today, human bean ✨'
        : habits.length === 1
          ? 'One small bean, every day'
          : `${doneToday} of ${habits.length} beans done today`;

  // One habit gets the full hero treatment; cards simplify as more exist.
  const tier: 'hero' | 'medium' | 'compact' =
    habits.length <= 1 ? 'hero' : habits.length <= 3 ? 'medium' : 'compact';

  const renderDots = (h: Habit, dotStyle: object, dotOnStyle: object) => (
    <>
      <View style={s.dotsRow}>
        {days.slice(0, 7).map((d) => (
          <View key={d} style={[dotStyle, h.done[d] && dotOnStyle]} />
        ))}
      </View>
      <View style={s.dotsRow}>
        {days.slice(7).map((d) => (
          <View
            key={d}
            style={[dotStyle, h.done[d] && dotOnStyle, d === today && s.dotToday]}
          />
        ))}
      </View>
    </>
  );

  const treatPill = (h: Habit) =>
    h.reward ? (
      <View style={s.treatPill}>
        <Text style={s.treatPillText}>🍬 {h.reward}</Text>
      </View>
    ) : (
      <View style={s.treatPillEmpty}>
        <Text style={s.treatPillEmptyText}>🍬 Add a treat</Text>
      </View>
    );

  const pairPill = (h: Habit) =>
    h.pairing ? (
      <View style={s.pairPill}>
        <Text style={s.pairPillText}>🎧 {h.pairing}</Text>
      </View>
    ) : null;

  return (
    <View style={[s.screen, { paddingTop: insets.top + 12 }]}>
      <Bubbles />
      <View style={s.content}>
      <View style={s.header}>
        <Text style={s.title}>
          {habits.length > 1 ? 'Daily Beans 🌱' : 'Daily Bean 🌱'}
        </Text>
      </View>
      <Text style={s.subtitle}>{subtitle}</Text>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
      >
        {tier === 'hero' &&
          habits.map((h) => {
            const isDone = !!h.done[today];
            const streakCount = streak(h.done);
            const total = Object.keys(h.done).filter((d) => h.done[d]).length;
            return (
              <View key={h.id}>
                <View style={s.heroCard}>
                  <View style={s.heroTop}>
                    <View style={{ width: 40 }} />
                    <Text style={s.heroName}>{h.label}</Text>
                    <Pressable onPress={() => openEdit(h)} hitSlop={8} style={{ width: 40 }}>
                      <Text style={s.heroEdit}>Edit</Text>
                    </Pressable>
                  </View>

                  {!!h.pairing && (
                    <View style={s.pairPill}>
                      <Text style={s.pairPillText}>🎧 Only with: {h.pairing}</Text>
                    </View>
                  )}

                  <HeroCheck done={isDone} onPress={() => toggleToday(h)} />
                  <Text style={s.heroCheckLabel}>
                    {isDone ? 'Done today ✨' : 'Tap the bean when it’s done'}
                  </Text>

                  <View style={s.heroDots}>
                    {renderDots(h, s.heroDot, s.dotOn)}
                  </View>

                  {treatPill(h)}
                </View>

                <View style={s.statsRow}>
                  <View style={s.statTile}>
                    <Text style={s.statNum}>{streakCount}</Text>
                    <Text style={s.statLabel}>day streak 🔥</Text>
                  </View>
                  <View style={s.statTile}>
                    <Text style={s.statNum}>{bestStreak(h.done)}</Text>
                    <Text style={s.statLabel}>best streak 🏆</Text>
                  </View>
                  <View style={s.statTile}>
                    <Text style={s.statNum}>{total}</Text>
                    <Text style={s.statLabel}>days done ✅</Text>
                  </View>
                </View>
              </View>
            );
          })}

        {tier === 'medium' &&
          habits.map((h) => {
            const isDone = !!h.done[today];
            const streakCount = streak(h.done);
            return (
              <View key={h.id} style={s.card}>
                <Pressable
                  onPress={() => toggleToday(h)}
                  hitSlop={8}
                  style={[s.check, isDone && s.checkOn]}
                >
                  {isDone && <Text style={s.checkMark}>✓</Text>}
                </Pressable>
                <Pressable style={s.cardBody} onPress={() => openEdit(h)}>
                  <Text style={[s.cardLabel, isDone && s.cardLabelDone]}>
                    {h.label}
                  </Text>
                  {renderDots(h, s.dot, s.dotOn)}
                  <View style={s.pillsRow}>
                    {treatPill(h)}
                    {pairPill(h)}
                  </View>
                </Pressable>
                {streakCount > 0 && <Text style={s.streak}>🔥 {streakCount}</Text>}
              </View>
            );
          })}

        {tier === 'compact' &&
          habits.map((h) => {
            const isDone = !!h.done[today];
            const streakCount = streak(h.done);
            return (
              <View key={h.id} style={s.cardCompact}>
                <Pressable
                  onPress={() => toggleToday(h)}
                  hitSlop={8}
                  style={[s.check, isDone && s.checkOn]}
                >
                  {isDone && <Text style={s.checkMark}>✓</Text>}
                </Pressable>
                <Pressable style={s.cardBody} onPress={() => openEdit(h)}>
                  <Text style={[s.cardLabel, isDone && s.cardLabelDone]}>
                    {h.label}
                  </Text>
                  {!!h.reward && (
                    <Text style={s.compactTreat}>🍬 {h.reward}</Text>
                  )}
                </Pressable>
                {streakCount > 0 && <Text style={s.streak}>🔥 {streakCount}</Text>}
              </View>
            );
          })}

        {loaded && habits.length === 0 && (
          <View style={s.unlockCard}>
            <Text style={s.unlockTitle}>🫘 Plant your first bean</Text>
            <Text style={s.unlockBody}>
              Pick a habit so small you can’t say no — and a treat for doing
              it.
            </Text>
            <Pressable style={s.unlockBtn} onPress={openAdd}>
              <Text style={s.unlockBtnText}>Plant it</Text>
            </Pressable>
          </View>
        )}

        {suggestAdd && (
          <View style={s.unlockCard}>
            <Text style={s.unlockTitle}>✨ Feeling good?</Text>
            <Text style={s.unlockBody}>
              You’ve been on a roll lately. If you feel like it, plant one
              more tiny bean — no pressure at all.
            </Text>
            <Pressable style={s.unlockBtn} onPress={openAdd}>
              <Text style={s.unlockBtnText}>+ Add a habit</Text>
            </Pressable>
            <Pressable onPress={dismissSuggest} hitSlop={8}>
              <Text style={s.notNowText}>Not now</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      </View>

      {/* Celebration on checking off */}
      <Modal
        visible={!!celebrating}
        transparent
        animationType="fade"
        onRequestClose={() => setCelebrating(null)}
      >
        <View style={s.backdropCenter}>
          <View style={s.celebrateCard}>
            <Text style={s.celebrateEmoji}>🎉</Text>
            <Text style={s.celebrateTitle}>{celebrating?.label} — done!</Text>
            {celebrating && streak(celebrating.done) > 1 && (
              <Text style={s.celebrateStreak}>
                🔥 {streak(celebrating.done)} days in a row
              </Text>
            )}
            {!!celebrating?.reward && (
              <>
                <Text style={s.celebrateTreatLabel}>Treat yourself</Text>
                <Text style={s.celebrateTreat}>🍬 {celebrating.reward}</Text>
              </>
            )}
            <Pressable style={s.saveBtn} onPress={() => setCelebrating(null)}>
              <Text style={s.saveBtnText}>
                {celebrating?.reward ? 'Claim it' : 'Nice!'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add/edit habit sheet */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={s.backdropBottom}>
          <Pressable style={s.backdropFill} onPress={() => setModalOpen(false)} />
          <View
            style={[s.sheet, { paddingBottom: insets.bottom + 24 + iosPWAKeyboard }]}
          >
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{editing ? 'Edit habit' : 'New habit'}</Text>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
                <Text style={s.closeX}>✕</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
              <Text style={s.inputLabel}>Habit</Text>
              <TextInput
                style={s.input}
                value={draft}
                onChangeText={setDraft}
                returnKeyType="done"
              />
              <Text style={s.inputLabel}>Treat / reward for doing it</Text>
              <TextInput
                style={s.input}
                value={draftTreat}
                onChangeText={setDraftTreat}
                returnKeyType="done"
              />
              <Text style={s.inputLabel}>Pair it with (optional)</Text>
              <Text style={s.inputHelper}>
                One special thing you only enjoy while doing this habit — a
                podcast, playlist, candle…
              </Text>
              <TextInput
                style={s.input}
                value={draftPair}
                onChangeText={setDraftPair}
                onSubmitEditing={saveDraft}
                returnKeyType="done"
              />
              {!!formError && <Text style={s.formError}>{formError}</Text>}
              <Pressable style={s.saveBtn} onPress={saveDraft}>
                <Text style={s.saveBtnText}>{editing ? 'Save' : 'Add habit'}</Text>
              </Pressable>
              {editing && (
                <Pressable style={s.deleteBtn} onPress={deleteEditing}>
                  <Text style={s.deleteBtnText}>Delete habit</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#DCEBF4', paddingHorizontal: 20 },
  content: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', color: '#3A4750' },
  subtitle: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: '#7E95A6', marginTop: 4 },

  // ---- hero (single habit) ----
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  heroName: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#3A4750',
    textAlign: 'center',
  },
  heroEdit: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: '#5E8A44',
    textAlign: 'right',
  },
  heroCheck: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#C6D9E5',
    backgroundColor: '#EAF3F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  heroCheckOn: {
    backgroundColor: '#7FA35C',
    borderColor: '#7FA35C',
    borderStyle: 'solid',
  },
  heroCheckMark: { color: '#FFFFFF', fontSize: 44, fontFamily: 'Nunito_800ExtraBold' },
  heroCheckBean: { fontSize: 42 },
  heroCheckLabel: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: '#7E95A6',
    marginTop: 10,
  },
  heroDots: { alignItems: 'center', marginTop: 16, gap: 2 },
  heroDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#E0EBF3',
  },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statNum: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', color: '#3A4750' },
  statLabel: { fontSize: 12, fontFamily: 'Nunito_700Bold', color: '#7E95A6', marginTop: 2 },

  // ---- medium (2-3 habits) ----
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  // ---- compact (4+ habits) ----
  cardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  compactTreat: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: '#B26558',
    marginTop: 3,
  },

  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#C6D9E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkOn: { backgroundColor: '#7FA35C', borderColor: '#7FA35C' },
  checkMark: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Nunito_800ExtraBold' },
  cardBody: { flex: 1 },
  cardLabel: { fontSize: 17, fontFamily: 'Nunito_700Bold', color: '#3A4750' },
  cardLabelDone: { color: '#9FB4C2', textDecorationLine: 'line-through' },
  dotsRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#E0EBF3',
  },
  dotOn: { backgroundColor: '#7FA35C' },
  dotToday: { borderWidth: 1.5, borderColor: '#3A4750' },
  streak: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: '#DE9159', marginLeft: 8 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  treatPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FBE7E2',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 9,
  },
  treatPillText: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#B26558' },
  treatPillEmpty: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C6D9E5',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 9,
  },
  treatPillEmptyText: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#7E95A6' },
  pairPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3EEF6',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 9,
  },
  pairPillText: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#4E7E9B' },

  unlockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 8,
    alignItems: 'center',
  },
  unlockTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: '#3A4750' },
  unlockBody: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: '#7E95A6',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 20,
  },
  unlockBtn: {
    backgroundColor: '#7FA35C',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  unlockBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' },
  notNowText: {
    color: '#7E95A6',
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    paddingVertical: 10,
    marginTop: 4,
  },

  backdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(38,52,63,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  celebrateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  celebrateEmoji: { fontSize: 44 },
  celebrateTitle: {
    fontSize: 21,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#3A4750',
    textAlign: 'center',
    marginTop: 8,
  },
  celebrateStreak: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: '#DE9159', marginTop: 8 },
  celebrateTreatLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: '#7E95A6',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 16,
  },
  celebrateTreat: {
    fontSize: 18,
    fontFamily: 'Nunito_700Bold',
    color: '#3A4750',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },

  backdropBottom: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38,52,63,0.5)' },
  backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  sheetTitle: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: '#3A4750' },
  closeX: { fontSize: 20, color: '#7E95A6', fontFamily: 'Nunito_700Bold' },

  inputLabel: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#7E95A6', marginBottom: 6 },
  inputHelper: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: '#9FB4C2',
    marginBottom: 8,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D7E4EE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Nunito_600SemiBold',
    color: '#3A4750',
    marginBottom: 16,
    minHeight: 48,
  },
  formError: {
    color: '#D96A5B',
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: '#7FA35C',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Nunito_800ExtraBold' },
  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  deleteBtnText: { color: '#D96A5B', fontSize: 15, fontFamily: 'Nunito_700Bold' },
});
