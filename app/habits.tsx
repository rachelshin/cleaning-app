import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { ComponentType, useCallback, useEffect, useRef, useState } from 'react';
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
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import {
  bestStreak,
  dayChance,
  Habit,
  lastNDays,
  loadHabits,
  loadLog,
  loadSuggestDismissed,
  LogEntry,
  onDataChange,
  saveHabits,
  saveSuggestDismissed,
  singDays,
  streak,
  SUGGEST_AFTER_STREAK,
  SUGGEST_CHANCE,
  todayStr,
  uid,
} from '../lib/storage';
import { useIosPWAKeyboard } from '../lib/useIosPWAKeyboard';
import Bubbles from '../components/Bubbles';

// The hero card's garden bed. The first-ever completion plants a bean in
// the soil; every later completion is a tap of the watering can. The plant
// grows with total days done: mound → sprout → leaves → flower → tomato.
// Growth never reverses — a missed day just pauses it. On days a wheel
// task got finished, the bean mascot stands in the garden singing to the
// plant (each such day is a bonus growth day — see singDays in storage).
// All garden art is hand-drawn SVG — no emoji.
function BeanArt() {
  return (
    <Svg width={34} height={26} viewBox="0 0 34 26">
      <Ellipse cx={17} cy={13} rx={14} ry={9.5} fill="#9C6B45" transform="rotate(-18 17 13)" />
      <Path
        d="M9 9 Q13 4.5 20 5"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function NoteArt() {
  return (
    <Svg width={16} height={18} viewBox="0 0 16 18">
      <Ellipse cx={5} cy={14} rx={3.6} ry={2.8} fill="#5B4636" transform="rotate(-20 5 14)" />
      <Path d="M8.4 13.5 L8.4 3.5" stroke="#5B4636" strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M8.4 3.5 Q12.5 4.6 13.2 8.2"
        stroke="#5B4636"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function SproutArt() {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Path d="M32 62 C32 52, 32 44, 32 34" stroke="#6F9E4C" strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M32 36 Q18 34 12 20 Q28 20 32 36 Z" fill="#8FAF6E" />
      <Path d="M32 36 Q46 34 52 20 Q36 20 32 36 Z" fill="#7FA35C" />
    </Svg>
  );
}

function LeafyArt() {
  return (
    <Svg width={72} height={88} viewBox="0 0 72 88">
      <Path d="M36 86 C36 64, 36 38, 36 16" stroke="#6F9E4C" strokeWidth={4.5} strokeLinecap="round" fill="none" />
      <Path d="M36 62 Q20 60 14 46 Q32 46 36 62 Z" fill="#8FAF6E" />
      <Path d="M36 62 Q52 60 58 46 Q40 46 36 62 Z" fill="#7FA35C" />
      <Path d="M36 38 Q22 36 17 24 Q33 24 36 38 Z" fill="#7FA35C" />
      <Path d="M36 38 Q50 36 55 24 Q39 24 36 38 Z" fill="#8FAF6E" />
      <Circle cx={36} cy={14} r={5} fill="#8FAF6E" />
    </Svg>
  );
}

function FlowerArt() {
  return (
    <Svg width={72} height={100} viewBox="0 0 72 100">
      <Path d="M36 98 C36 76, 36 52, 36 34" stroke="#6F9E4C" strokeWidth={4.5} strokeLinecap="round" fill="none" />
      <Path d="M36 74 Q20 72 14 58 Q32 58 36 74 Z" fill="#8FAF6E" />
      <Path d="M36 74 Q52 72 58 58 Q40 58 36 74 Z" fill="#7FA35C" />
      <Path d="M36 52 Q22 50 17 38 Q33 38 36 52 Z" fill="#7FA35C" />
      <Circle cx={36} cy={12} r={8} fill="#F4B8C4" />
      <Circle cx={46} cy={19} r={8} fill="#F4B8C4" />
      <Circle cx={42} cy={31} r={8} fill="#F4B8C4" />
      <Circle cx={30} cy={31} r={8} fill="#F4B8C4" />
      <Circle cx={26} cy={19} r={8} fill="#F4B8C4" />
      <Circle cx={36} cy={22} r={7} fill="#F0C86B" />
    </Svg>
  );
}

function TomatoArt() {
  return (
    <Svg width={84} height={104} viewBox="0 0 84 104">
      <Path d="M42 102 C42 80, 42 54, 42 24" stroke="#6F9E4C" strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M42 64 Q24 62 16 46 Q38 46 42 64 Z" fill="#8FAF6E" />
      <Path d="M42 64 Q60 62 68 46 Q46 46 42 64 Z" fill="#7FA35C" />
      <Path d="M42 40 Q26 38 20 24 Q38 24 42 40 Z" fill="#7FA35C" />
      <Path d="M42 40 Q58 38 64 24 Q46 24 42 40 Z" fill="#8FAF6E" />
      <Circle cx={42} cy={18} r={6} fill="#8FAF6E" />
      <Circle cx={28} cy={74} r={10} fill="#D95F4B" />
      <Circle cx={56} cy={80} r={9} fill="#D95F4B" />
      <Circle cx={42} cy={88} r={10} fill="#D95F4B" />
      <Circle cx={28} cy={66} r={2.5} fill="#6F9E4C" />
      <Circle cx={56} cy={73} r={2.5} fill="#6F9E4C" />
      <Circle cx={42} cy={80} r={2.5} fill="#6F9E4C" />
    </Svg>
  );
}

// Days 1–3 the bean stays buried (mound only, no visible growth); the
// sprout breaks ground on day 4, then leaves, a flower, and tomatoes on
// day 21. Picking the ripe tomato drops the plant back to flowering; it
// fruits again REGROW_DAYS done-days later.
const FIRST_FRUIT = 21;
const REGROW_DAYS = 7;
const PLANT_STAGES: { min: number; Art: ComponentType }[] = [
  { min: 14, Art: FlowerArt },
  { min: 8, Art: LeafyArt },
  { min: 4, Art: SproutArt },
];


// Auto-playing harvest moment: the picked tomato gets three bites taken
// out of it (with a little squish on each), then the card closes itself.
// Bites are card-background circles overlaid on the rim so they read as
// missing chunks.
function EatingTomato({ onDone }: { onDone: () => void }) {
  const eat = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(450),
      Animated.timing(eat, {
        toValue: 1,
        duration: 1900,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.delay(650),
    ]);
    anim.start(({ finished }) => {
      if (finished) done.current();
    });
    return () => anim.stop();
  }, [eat]);

  const scale = eat.interpolate({
    inputRange: [0, 0.24, 0.27, 0.31, 0.54, 0.57, 0.61, 0.84, 0.87, 0.91, 1],
    outputRange: [1, 1, 0.93, 1, 1, 0.93, 1, 1, 0.93, 1, 1],
  });

  const bites = [
    { at: 0.25, x: 128, y: 40, r: 20 },
    { at: 0.55, x: 148, y: 82, r: 23 },
    { at: 0.85, x: 132, y: 126, r: 21 },
  ];

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Svg width={190} height={190} viewBox="0 0 120 120">
        <Circle cx={60} cy={68} r={44} fill="#D95F4B" />
        <Ellipse
          cx={44}
          cy={52}
          rx={10}
          ry={6}
          fill="rgba(255,255,255,0.35)"
          transform="rotate(-24 44 52)"
        />
        <Path
          d="M60 18 C58 22, 58 26, 60 30"
          stroke="#6F9E4C"
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <Path d="M60 30 Q44 24 36 32 Q50 38 60 33 Q70 38 84 32 Q76 24 60 30 Z" fill="#7FA35C" />
      </Svg>
      {bites.map((b, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: b.x,
            top: b.y,
            opacity: eat.interpolate({
              inputRange: [0, b.at, b.at + 0.001, 1],
              outputRange: [0, 0, 1, 1],
            }),
          }}
        >
          <View style={[s.biteChunk, { width: b.r * 2, height: b.r * 2, borderRadius: b.r }]} />
          <View style={[s.biteChunk, s.biteNibA]} />
          <View style={[s.biteChunk, s.biteNibB]} />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

function GardenBed({
  totalDone,
  harvests,
  wateredToday,
  singing,
  onToggle,
  onPick,
}: {
  totalDone: number;
  harvests: number;
  wateredToday: boolean;
  singing: boolean;
  onToggle: () => void;
  onPick: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const drops = useRef(new Animated.Value(0)).current;
  const sink = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const notes = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  // The serenade: the mascot sways side to side while notes drift up
  // toward the plant, all day on days a wheel task got finished.
  useEffect(() => {
    if (!singing) return;
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    const noteLoop = Animated.loop(
      Animated.timing(notes, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    swayLoop.start();
    noteLoop.start();
    return () => {
      swayLoop.stop();
      noteLoop.stop();
    };
  }, [singing, sway, notes]);

  // The tappable control pulses gently until today's care is done.
  useEffect(() => {
    if (wateredToday) {
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
  }, [wateredToday, pulse]);

  // The can rests centered; watering slides it right until the spout is
  // over the plant, tilts it while the shower falls, then brings it home
  // and marks the day done. Tapping again un-waters instantly.
  const water = () => {
    if (wateredToday) {
      onToggle();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    drops.setValue(0);
    Animated.sequence([
      Animated.timing(slide, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(tilt, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.delay(560),
          Animated.timing(tilt, {
            toValue: 0,
            duration: 220,
            easing: Easing.in(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.timing(drops, {
          toValue: 1,
          duration: 950,
          easing: Easing.in(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.timing(slide, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      busy.current = false;
      onToggle();
    });
  };

  // Day one: the bean sinks into the soil, then counts as done.
  const plantBean = () => {
    if (busy.current) return;
    busy.current = true;
    Animated.timing(sink, {
      toValue: 1,
      duration: 550,
      easing: Easing.in(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      busy.current = false;
      sink.setValue(0);
      onToggle();
    });
  };

  const fruitReady = totalDone >= FIRST_FRUIT + harvests * REGROW_DAYS;
  const StageArt = fruitReady
    ? TomatoArt
    : totalDone >= FIRST_FRUIT
      ? FlowerArt
      : PLANT_STAGES.find((p) => totalDone >= p.min)?.Art;
  const tiltDeg = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-24deg'] });

  return (
    <View style={s.garden}>
      <View style={s.gardenSky}>
        {StageArt &&
          (fruitReady ? (
            <Pressable onPress={onPick} hitSlop={8}>
              <StageArt />
            </Pressable>
          ) : (
            <StageArt />
          ))}
      </View>
      <View style={[s.soil, wateredToday && s.soilWet]} />
      {totalDone >= 1 && totalDone < 4 && <View style={s.mound} />}

      {singing && totalDone >= 1 && (
        <View pointerEvents="none" style={s.singerSpot}>
          {[0, 1, 2].map((i) => {
            const start = i * 0.3;
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  top: -12,
                  left: 14 + i * 22,
                  opacity: notes.interpolate({
                    inputRange: [start, start + 0.06, start + 0.34, start + 0.4],
                    outputRange: [0, 1, 1, 0],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      translateY: notes.interpolate({
                        inputRange: [start, start + 0.4],
                        outputRange: [0, -44],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                }}
              >
                <NoteArt />
              </Animated.View>
            );
          })}
          <Animated.View
            style={{
              transform: [
                {
                  rotate: sway.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-7deg', '7deg'],
                  }),
                },
              ],
            }}
          >
            <Image
              source={require('../assets/mascot/bean-sprout.png')}
              style={{ width: 84, height: 84 }}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      )}

      {totalDone === 0 ? (
        <Pressable onPress={plantBean} hitSlop={12} style={s.beanSpot}>
          <Animated.View
            style={{
              transform: [
                { scale: pulse },
                {
                  translateY: sink.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 16],
                  }),
                },
              ],
              opacity: sink.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 1, 0],
              }),
            }}
          >
            <BeanArt />
          </Animated.View>
        </Pressable>
      ) : (
        <>
          <Pressable onPress={water} hitSlop={10} style={s.canSpot}>
            <Animated.View
              style={{
                transform: [
                  {
                    translateX: slide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 72],
                    }),
                  },
                  { scale: pulse },
                  { rotate: tiltDeg },
                ],
              }}
            >
              <Image
                source={require('../assets/mascot/can.png')}
                style={{ width: 180, height: 180 }}
                resizeMode="contain"
              />
            </Animated.View>
          </Pressable>
          {Array.from({ length: 8 }, (_, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                s.droplet,
                {
                  left: '50%',
                  marginLeft: -28 + i * 8,
                  opacity: drops.interpolate({
                    inputRange: [0, 0.02 + i * 0.07, 0.14 + i * 0.07, 0.9, 1],
                    outputRange: [0, 0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: drops.interpolate({
                        inputRange: [0.02 + i * 0.07, 1],
                        outputRange: [0, 166],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </>
      )}
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
  const [eating, setEating] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const reload = useCallback(() => {
    loadHabits().then((h) => {
      setHabits(h);
      setLoaded(true);
    });
    loadSuggestDismissed().then(setSuggestDismissed);
    loadLog().then(setLog);
  }, []);

  // Runs on mount and every time the tab regains focus — the screen stays
  // mounted behind the tab bar, and "Done" on the wheel flips over here
  // expecting today's serenade to already be visible.
  useFocusEffect(reload);
  useEffect(() => onDataChange(reload), [reload]); // sync applied remote data

  const update = (next: Habit[]) => {
    setHabits(next);
    saveHabits(next);
  };

  const today = todayStr();
  const streaks = habits.map((h) => streak(h.done));
  // The serenade: live whenever a wheel task was finished today; every
  // such day (past ones included) counts as one bonus growth day.
  const sangToday = log.some((e) => e.date === today);
  const singBoost = singDays(log);
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
    const next = habits.map((h) => {
      if (h.id !== habit.id) return h;
      const done = { ...h.done };
      if (done[today]) delete done[today];
      else done[today] = true;
      return { ...h, done };
    });
    update(next);
  };

  const pickFruit = (habit: Habit) => {
    update(
      habits.map((h) =>
        h.id === habit.id ? { ...h, harvests: (h.harvests ?? 0) + 1 } : h
      )
    );
    setEating(true);
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
            {habits.length > 1 ? 'daily beans 🌱' : 'daily bean 🌱'}
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
              // Serenade days advance the plant's stage, but only once it
              // exists — and the stat tiles keep counting real habit days.
              const grown = total === 0 ? 0 : total + singBoost;
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

                    <GardenBed
                      totalDone={grown}
                      harvests={h.harvests ?? 0}
                      wateredToday={isDone}
                      singing={sangToday}
                      onToggle={() => toggleToday(h)}
                      onPick={() => pickFruit(h)}
                    />
                    {isDone && (
                      <Text style={s.heroCheckLabel}>
                        {total <= 1 ? 'Planted today ✨' : 'Watered today ✨'}
                      </Text>
                    )}

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

      {/* Eating the picked tomato */}
      <Modal
        visible={eating}
        transparent
        animationType="fade"
        onRequestClose={() => setEating(false)}
      >
        <View style={s.backdropCenter}>
          <View style={s.eatCard}>
            {eating && <EatingTomato onDone={() => setEating(false)} />}
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
  heroCheckLabel: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: '#8A6C52',
    marginTop: 10,
  },
  garden: { alignSelf: 'stretch', height: 300, marginTop: 16 },
  // Negative margin tucks the stem base under the soil bar (drawn after,
  // so it paints on top) — otherwise the plant looks like it's floating.
  gardenSky: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginBottom: -10 },
  soil: { height: 24, borderRadius: 12, backgroundColor: '#B08155', alignSelf: 'stretch' },
  soilWet: { backgroundColor: '#8A6647' },
  mound: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 16,
    width: 40,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7A583C',
  },
  beanSpot: { position: 'absolute', alignSelf: 'center', bottom: 20 },
  // Standing at the garden's left edge, feet overlapping the soil bar.
  singerSpot: { position: 'absolute', left: 16, bottom: 14 },
  canSpot: { position: 'absolute', top: 0, alignSelf: 'center' },
  droplet: {
    position: 'absolute',
    top: 100,
    width: 6,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7FB3D6',
  },
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
  eatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biteChunk: { position: 'absolute', backgroundColor: '#FFFFFF' },
  biteNibA: { width: 18, height: 18, borderRadius: 9, left: -8, top: 20 },
  biteNibB: { width: 16, height: 16, borderRadius: 8, left: 26, top: -6 },

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
