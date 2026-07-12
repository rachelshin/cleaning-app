import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';
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

// The hero card's big button: a heart waiting in a dashed slot, gently
// pulsing until it's tapped, then a solid green heart with a sparkle burst.
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
        <Text style={done ? s.heroCheckMark : s.heroCheckHeart}>{done ? '♥' : '♡'}</Text>
        {done && (
          <>
            <Text style={s.heroSparkleA}>✨</Text>
            <Text style={s.heroSparkleB}>✨</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

// A little vine that grows along the last 14 days: a leaf for every day
// done, a bare twig for every day missed — so the habit's own history
// reads as a tiny garden instead of a progress bar.
function VineProgress({ done }: { done: Record<string, boolean> }) {
  const days = lastNDays(14);
  return (
    <View style={{ marginTop: 18 }}>
      <Svg width="100%" height={40} viewBox="0 0 340 40" preserveAspectRatio="none">
        <Path
          d="M6 26 Q 30 8, 55 22 T 105 20 T 155 24 T 205 16 T 255 22 T 305 14 T 334 20"
          fill="none"
          stroke="#B98A63"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </Svg>
      <View style={s.vineRow}>
        {days.map((d) => (
          <Text key={d} style={[s.vineLeaf, { opacity: done[d] ? 1 : 0.3 }]}>
            {done[d] ? '🍃' : '·'}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Small heart checkbox used by the trellis-style rows (medium / compact
// tiers): outline when untouched, solid green + filled heart when done.
function HeartCheck({ done, onPress }: { done: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[s.check, done && s.checkOn]}>
      <Text style={[s.checkGlyph, done && s.checkGlyphOn]}>{done ? '♥' : '♡'}</Text>
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

  // One habit gets the full hero treatment; cards simplify as more exist.
  const tier: 'hero' | 'list' = habits.length <= 1 ? 'hero' : 'list';

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

  return (
    <View style={[s.screen, { paddingTop: insets.top + 12 }]}>
      <Bubbles />
      <View style={s.content}>
        <View style={s.header}>
          <Text style={s.title}>
            {habits.length > 1 ? 'Daily Beans 🌱' : 'Daily Bean 🌱'}
          </Text>
        </View>

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
                    <Text style={s.heroSparkleCorner}>✦</Text>
                    <Text style={s.heroLeafCorner}>🌿</Text>
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
                      {isDone ? 'Done today ✨' : 'Tap the heart when it’s done'}
                    </Text>

                    <VineProgress done={h.done} />

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

          {tier === 'list' && (
            <View style={{ position: 'relative', paddingLeft: 30 }}>
              <Svg
                width={22}
                height={habits.length * 118}
                viewBox={`0 0 22 ${habits.length * 118}`}
                style={{ position: 'absolute', left: 0, top: 0 }}
                preserveAspectRatio="none"
              >
                <Path
                  d={`M11 0 C 20 ${habits.length * 15}, 2 ${habits.length * 30}, 11 ${habits.length * 45} S 20 ${habits.length * 75}, 11 ${habits.length * 90} S 2 ${habits.length * 105}, 11 ${habits.length * 118}`}
                  fill="none"
                  stroke="#8FAF6E"
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              </Svg>
              {habits.map((h, i) => {
                const isDone = !!h.done[today];
                const streakCount = streak(h.done);
                const days7 = lastNDays(7);
                return (
                  <View key={h.id} style={{ marginBottom: 16 }}>
                    <Text style={s.trellisLeaf}>{isDone ? '🌸' : '🍃'}</Text>
                    <View style={s.card}>
                      <HeartCheck done={isDone} onPress={() => toggleToday(h)} />
                      <Pressable style={s.cardBody} onPress={() => openEdit(h)}>
                        <Text style={[s.cardLabel, isDone && s.cardLabelDone]}>
                          {h.label}
                        </Text>
                        <View style={s.dotsRow}>
                          {days7.map((d) => (
                            <View
                              key={d}
                              style={[s.dot, h.done[d] && s.dotOn, d === today && s.dotToday]}
                            />
                          ))}
                        </View>
                        <View style={s.pillsRow}>
                          {treatPill(h)}
                          {!!h.pairing && (
                            <View style={s.pairPillSmall}>
                              <Text style={s.pairPillText}>🎧 {h.pairing}</Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                      {streakCount > 0 && <Text style={s.streak}>🔥 {streakCount}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {loaded && habits.length === 0 && (
            <View style={s.unlockCard}>
              <Image
                source={require('../assets/mascot/bean-sprout.png')}
                style={s.unlockMascot}
                resizeMode="contain"
              />
              <Text style={s.unlockTitle}>Plant your first bean</Text>
              <Text style={s.unlockBody}>
                Pick a habit so small you can’t say no — and a treat for doing
                it.
              </Text>
              <Pressable onPress={openAdd}>
                <LinearGradient
                  colors={['#9BC178', '#6F9E4C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.unlockBtn}
                >
                  <Text style={s.unlockBtnText}>Plant it</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {suggestAdd && (
            <View style={s.unlockCard}>
              <Image
                source={require('../assets/mascot/bean-sprout.png')}
                style={s.unlockMascot}
                resizeMode="contain"
              />
              <Text style={s.unlockTitle}>Feeling good?</Text>
              <Text style={s.unlockBody}>
                You’ve been on a roll lately. If you feel like it, plant one
                more tiny bean — no pressure at all.
              </Text>
              <Pressable onPress={openAdd}>
                <LinearGradient
                  colors={['#9BC178', '#6F9E4C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.unlockBtn}
                >
                  <Text style={s.unlockBtnText}>+ Add a habit</Text>
                </LinearGradient>
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
            <Text style={s.confettiA}>🎊</Text>
            <Text style={s.confettiB}>💛</Text>
            <Image
              source={require('../assets/mascot/bean-bubbles.png')}
              style={s.celebrateMascot}
              resizeMode="contain"
            />
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
            <Pressable onPress={() => setCelebrating(null)}>
              <LinearGradient
                colors={['#9BC178', '#6F9E4C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.saveBtn}
              >
                <Text style={s.saveBtnText}>
                  {celebrating?.reward ? 'Claim it' : 'Nice!'}
                </Text>
              </LinearGradient>
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
              <Pressable onPress={saveDraft}>
                <LinearGradient
                  colors={['#9BC178', '#6F9E4C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.saveBtn}
                >
                  <Text style={s.saveBtnText}>{editing ? 'Save' : 'Add habit'}</Text>
                </LinearGradient>
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
  screen: { flex: 1, backgroundColor: '#CDE8F3', paddingHorizontal: 20 },
  content: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', color: '#5B4636' },

  // ---- hero (single habit) ----
  heroCard: {
    backgroundColor: '#FBEFE3',
    borderRadius: 32,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroSparkleCorner: { position: 'absolute', top: 16, left: 18, fontSize: 14, color: '#EFC15A' },
  heroLeafCorner: { position: 'absolute', bottom: 18, right: 20, fontSize: 20 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  heroName: {
    flex: 1,
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#4A3B2C',
    textAlign: 'center',
  },
  heroEdit: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: '#5E8A44',
    textAlign: 'right',
  },
  heroCheck: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#E6D2BE',
    backgroundColor: '#F6E7D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    position: 'relative',
  },
  heroCheckOn: {
    backgroundColor: '#7FA35C',
    borderColor: '#7FA35C',
    borderStyle: 'solid',
  },
  heroCheckMark: { color: '#FFFFFF', fontSize: 46, fontFamily: 'Nunito_800ExtraBold' },
  heroCheckHeart: { color: '#D9A38C', fontSize: 44 },
  heroSparkleA: { position: 'absolute', top: -10, right: -8, fontSize: 16 },
  heroSparkleB: { position: 'absolute', bottom: -6, left: -12, fontSize: 14 },
  heroCheckLabel: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: '#8A6C52',
    marginTop: 10,
  },
  vineRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, width: '100%' },
  vineLeaf: { fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statNum: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', color: '#4A3B2C' },
  statLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', color: '#8A7A68', marginTop: 2 },

  // ---- trellis list (2+ habits) ----
  trellisLeaf: { position: 'absolute', left: -30, top: 22, fontSize: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  check: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0EAD8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkOn: { backgroundColor: '#7FA35C' },
  checkGlyph: { fontSize: 19, color: '#B7A88F' },
  checkGlyphOn: { color: '#FFFFFF' },
  cardBody: { flex: 1 },
  cardLabel: { fontSize: 16, fontFamily: 'Nunito_700Bold', color: '#4A3B2C' },
  cardLabelDone: { color: '#B7A88F', textDecorationLine: 'line-through' },
  dotsRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EFE6D3',
  },
  dotOn: { backgroundColor: '#8FAF6E' },
  dotToday: { borderWidth: 1.5, borderColor: '#4A3B2C' },
  streak: { fontSize: 14, fontFamily: 'Nunito_800ExtraBold', color: '#DE9159', marginLeft: 8 },

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
    borderColor: '#E6D2BE',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 9,
  },
  treatPillEmptyText: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#8A7A68' },
  pairPill: {
    alignSelf: 'center',
    backgroundColor: '#E3EEF6',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 9,
  },
  pairPillSmall: {
    backgroundColor: '#E3EEF6',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 9,
  },
  pairPillText: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#4E7E9B' },

  unlockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    marginTop: 8,
    alignItems: 'center',
  },
  unlockMascot: { width: 84, height: 84, marginBottom: 4 },
  unlockTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: '#4A3B2C' },
  unlockBody: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: '#8A7A68',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 20,
  },
  unlockBtn: {
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 26,
    shadowColor: '#6F9E4C',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  unlockBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Nunito_800ExtraBold' },
  notNowText: {
    color: '#8A7A68',
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    paddingVertical: 10,
    marginTop: 4,
  },

  backdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(74,59,44,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  confettiA: { position: 'absolute', top: 14, left: 22, fontSize: 16 },
  confettiB: { position: 'absolute', top: 8, right: 26, fontSize: 18 },
  celebrateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 26,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    position: 'relative',
  },
  celebrateMascot: { width: 108, height: 108, marginTop: 4 },
  celebrateTitle: {
    fontSize: 21,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#4A3B2C',
    textAlign: 'center',
    marginTop: 8,
  },
  celebrateStreak: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: '#DE9159', marginTop: 8 },
  celebrateTreatLabel: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: '#8A7A68',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 16,
  },
  celebrateTreat: {
    fontSize: 18,
    fontFamily: 'Nunito_700Bold',
    color: '#4A3B2C',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },

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

  inputLabel: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#8A7A68', marginBottom: 6 },
  inputHelper: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: '#B7A88F',
    marginBottom: 8,
    lineHeight: 18,
  },
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
  formError: {
    color: '#C4645A',
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  saveBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 8,
    shadowColor: '#6F9E4C',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Nunito_800ExtraBold' },
  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  deleteBtnText: { color: '#C4645A', fontSize: 15, fontFamily: 'Nunito_700Bold' },
});
