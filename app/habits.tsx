import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
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
    setModalOpen(true);
  };

  const openEdit = (habit: Habit) => {
    setEditing(habit);
    setDraft(habit.label);
    setDraftTreat(habit.reward ?? '');
    setModalOpen(true);
  };

  const saveDraft = () => {
    const label = draft.trim();
    if (!label) return;
    const reward = draftTreat.trim() || undefined;
    if (editing) {
      update(
        habits.map((h) => (h.id === editing.id ? { ...h, label, reward } : h))
      );
    } else {
      update([...habits, { id: uid(), label, reward, done: {} }]);
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
      ? 'Start with one tiny habit — that’s the whole game'
      : doneToday === habits.length
        ? 'Done for today — go enjoy yourself ✨'
        : habits.length === 1
          ? 'One small win, every day'
          : `${doneToday} of ${habits.length} done today`;

  return (
    <View style={[s.screen, { paddingTop: insets.top + 12 }]}>
      <View style={s.content}>
      <View style={s.header}>
        <Text style={s.title}>
          {habits.length > 1 ? 'Daily Habits 🌱' : 'Daily Habit 🌱'}
        </Text>
      </View>
      <Text style={s.subtitle}>{subtitle}</Text>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
      >
        {habits.map((h) => {
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
                <View style={s.dotsRow}>
                  {days.slice(0, 7).map((d) => (
                    <View key={d} style={[s.dot, h.done[d] && s.dotOn]} />
                  ))}
                </View>
                <View style={s.dotsRow}>
                  {days.slice(7).map((d) => (
                    <View
                      key={d}
                      style={[
                        s.dot,
                        h.done[d] && s.dotOn,
                        d === today && s.dotToday,
                      ]}
                    />
                  ))}
                </View>
                {!!h.reward && <Text style={s.cardTreat}>🍬 {h.reward}</Text>}
              </Pressable>
              {streakCount > 0 && <Text style={s.streak}>🔥 {streakCount}</Text>}
            </View>
          );
        })}

        {loaded && habits.length === 0 && (
          <View style={s.unlockCard}>
            <Text style={s.unlockTitle}>🌱 One tiny habit</Text>
            <Text style={s.unlockBody}>
              Pick something so small you can’t say no — and a treat for doing
              it.
            </Text>
            <Pressable style={s.unlockBtn} onPress={openAdd}>
              <Text style={s.unlockBtnText}>Start my habit</Text>
            </Pressable>
          </View>
        )}

        {suggestAdd && (
          <View style={s.unlockCard}>
            <Text style={s.unlockTitle}>✨ Feeling good?</Text>
            <Text style={s.unlockBody}>
              You’ve been on a roll lately. If you feel like it, add one more
              tiny habit — no pressure at all.
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
              <Text style={s.inputLabel}>Treat / reward for doing it (optional)</Text>
              <TextInput
                style={s.input}
                value={draftTreat}
                onChangeText={setDraftTreat}
                onSubmitEditing={saveDraft}
                returnKeyType="done"
              />
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
  screen: { flex: 1, backgroundColor: '#F6F3EE', paddingHorizontal: 20 },
  content: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', color: '#33302E' },
  subtitle: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: '#8A8480', marginTop: 4 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#D8D2C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkOn: { backgroundColor: '#00A896', borderColor: '#00A896' },
  checkMark: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Nunito_800ExtraBold' },
  cardBody: { flex: 1 },
  cardLabel: { fontSize: 17, fontFamily: 'Nunito_700Bold', color: '#33302E' },
  cardLabelDone: { color: '#A39D95', textDecorationLine: 'line-through' },
  dotsRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EDE7DC',
  },
  dotOn: { backgroundColor: '#00A896' },
  dotToday: { borderWidth: 1.5, borderColor: '#33302E' },
  cardTreat: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#8A8480', marginTop: 7 },
  streak: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: '#E8960C', marginLeft: 8 },

  unlockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 8,
    alignItems: 'center',
  },
  unlockTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: '#33302E' },
  unlockBody: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: '#8A8480',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 20,
  },
  unlockBtn: {
    backgroundColor: '#00A896',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  unlockBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' },
  notNowText: {
    color: '#8A8480',
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    paddingVertical: 10,
    marginTop: 4,
  },

  backdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(30,25,20,0.55)',
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
    color: '#33302E',
    textAlign: 'center',
    marginTop: 8,
  },
  celebrateStreak: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: '#E8960C', marginTop: 8 },
  celebrateTreatLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: '#8A8480',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 16,
  },
  celebrateTreat: {
    fontSize: 18,
    fontFamily: 'Nunito_700Bold',
    color: '#33302E',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },

  backdropBottom: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,25,20,0.55)' },
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
  sheetTitle: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: '#33302E' },
  closeX: { fontSize: 20, color: '#8A8480', fontFamily: 'Nunito_700Bold' },

  inputLabel: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#8A8480', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5DFD5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Nunito_600SemiBold',
    color: '#33302E',
    marginBottom: 16,
    minHeight: 48,
  },
  saveBtn: {
    backgroundColor: '#00A896',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Nunito_800ExtraBold' },
  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  deleteBtnText: { color: '#E23D5B', fontSize: 15, fontFamily: 'Nunito_700Bold' },
});
