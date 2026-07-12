import { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleSheet, View } from 'react-native';

// Soap-bubble decor: translucent circles with a shine, endlessly drifting
// upward with a gentle side-to-side sway. Purely decorative: absolutely
// positioned behind content, never interactive, never affects layout.
const BUBBLES: {
  top: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  size: number;
  rise: number;
  sway: number;
  duration: number;
  delay: number;
}[] = [
  { top: '12%', left: '6%', size: 34, rise: 90, sway: 10, duration: 9000, delay: 0 },
  { top: '9%', right: '16%', size: 18, rise: 70, sway: 8, duration: 7000, delay: 1400 },
  { top: '30%', right: '4%', size: 44, rise: 110, sway: 14, duration: 11000, delay: 600 },
  { top: '62%', right: '10%', size: 26, rise: 90, sway: 12, duration: 8000, delay: 2200 },
  { top: '80%', left: '8%', size: 38, rise: 100, sway: 11, duration: 10000, delay: 1000 },
];

function Bubble({ cfg }: { cfg: (typeof BUBBLES)[number] }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(cfg.delay),
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: cfg.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [v, cfg]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -cfg.rise] });
  const translateX = v.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, cfg.sway, 0, -cfg.sway, 0],
  });
  const opacity = v.interpolate({
    inputRange: [0, 0.12, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        s.bubble,
        {
          top: cfg.top,
          left: cfg.left,
          right: cfg.right,
          width: cfg.size,
          height: cfg.size,
          borderRadius: cfg.size / 2,
          opacity,
          transform: [{ translateY }, { translateX }],
        },
      ]}
    >
      <View
        style={[
          s.shine,
          {
            top: cfg.size * 0.16,
            left: cfg.size * 0.2,
            width: cfg.size * 0.3,
            height: cfg.size * 0.18,
          },
        ]}
      />
    </Animated.View>
  );
}

export default function Bubbles() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BUBBLES.map((b, i) => (
        <Bubble key={i} cfg={b} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  shine: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    transform: [{ rotate: '-25deg' }],
  },
});
