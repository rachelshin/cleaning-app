import { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleSheet, Text, View } from 'react-native';

// Soft floating decor echoing the Clean Bean garden: bubbles, sparkles and
// a couple of drifting hearts. Purely decorative: absolutely positioned
// behind content, never interactive, never affects layout.
const BUBBLES: {
  top: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  size: number;
}[] = [
  { top: '9%', left: '6%', size: 34 },
  { top: '6%', right: '16%', size: 18 },
  { top: '26%', right: '4%', size: 44 },
  { top: '58%', right: '10%', size: 26 },
  { top: '74%', left: '8%', size: 38 },
];

const SPARKLES: { top: DimensionValue; left?: DimensionValue; right?: DimensionValue; size: number; delay: number }[] = [
  { top: '13%', right: '8%', size: 15, delay: 0 },
  { top: '34%', left: '4%', size: 12, delay: 400 },
  { top: '68%', right: '20%', size: 13, delay: 800 },
];

const HEARTS: { top: DimensionValue; left?: DimensionValue; right?: DimensionValue; delay: number }[] = [
  { top: '46%', left: '3%', delay: 0 },
  { top: '20%', right: '2%', delay: 900 },
];

function Twinkle({ style, delay }: { style: any; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      <Text style={{ fontSize: style.size }}>✦</Text>
    </Animated.View>
  );
}

function FloatHeart({ style, delay }: { style: any; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 3400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });
  const opacity = v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.85, 0] });
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      <Text style={{ fontSize: 14 }}>💗</Text>
    </Animated.View>
  );
}

export default function Bubbles() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BUBBLES.map((b, i) => (
        <View
          key={`b${i}`}
          style={[
            s.bubble,
            {
              top: b.top,
              left: b.left,
              right: b.right,
              width: b.size,
              height: b.size,
              borderRadius: b.size / 2,
            },
          ]}
        />
      ))}
      {SPARKLES.map((sp, i) => (
        <Twinkle
          key={`s${i}`}
          delay={sp.delay}
          style={{ position: 'absolute', top: sp.top, left: sp.left, right: sp.right, size: sp.size }}
        />
      ))}
      {HEARTS.map((h, i) => (
        <FloatHeart
          key={`h${i}`}
          delay={h.delay}
          style={{ position: 'absolute', top: h.top, left: h.left, right: h.right }}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});
