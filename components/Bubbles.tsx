import { useEffect, useRef, useState } from 'react';
import { Animated, DimensionValue, Easing, StyleSheet, View } from 'react-native';

// Soap-bubble decor: translucent circles with a shine, drifting bottom-to-
// top across the whole screen in an endless loop. Each bubble starts just
// below the screen, exits above it, and re-enters from the bottom — so the
// stream never blinks or pops. Purely decorative: absolutely positioned
// behind content, never interactive, never affects layout.
//
// `phase` is where along its journey (0 = bottom, 1 = top) a bubble begins
// on first render, so the screen is populated immediately instead of
// everything spawning at the bottom at once.
const BUBBLES: {
  left?: DimensionValue;
  right?: DimensionValue;
  size: number;
  sway: number;
  duration: number;
  phase: number;
}[] = [
  { left: '6%', size: 34, sway: 12, duration: 20000, phase: 0.15 },
  { right: '16%', size: 18, sway: 9, duration: 16000, phase: 0.7 },
  { right: '4%', size: 44, sway: 16, duration: 26000, phase: 0.4 },
  { right: '30%', size: 26, sway: 12, duration: 18000, phase: 0.9 },
  { left: '10%', size: 38, sway: 13, duration: 23000, phase: 0.55 },
  { left: '38%', size: 22, sway: 10, duration: 21000, phase: 0.28 },
];

function Bubble({ cfg, height }: { cfg: (typeof BUBBLES)[number]; height: number }) {
  const v = useRef(new Animated.Value(cfg.phase)).current;

  useEffect(() => {
    v.setValue(cfg.phase);
    // Finish the current pass from the starting phase, then loop full
    // passes forever. Same duration-per-distance, so speed never changes.
    const anim = Animated.sequence([
      Animated.timing(v, {
        toValue: 1,
        duration: cfg.duration * (1 - cfg.phase),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(v, {
            toValue: 1,
            duration: cfg.duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [v, cfg, height]);

  // From just below the bottom edge to just above the top edge.
  const travel = height + cfg.size * 2;
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] });
  // Two gentle side-to-side sways per full climb.
  const translateX = v.interpolate({
    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
    outputRange: [0, cfg.sway, 0, -cfg.sway, 0, cfg.sway, 0, -cfg.sway, 0],
  });

  return (
    <Animated.View
      style={[
        s.bubble,
        {
          top: height + cfg.size,
          left: cfg.left,
          right: cfg.right,
          width: cfg.size,
          height: cfg.size,
          borderRadius: cfg.size / 2,
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
  // Measured via onLayout: useWindowDimensions is 0 during static render
  // and hydration never repairs it.
  const [height, setHeight] = useState(0);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {height > 0 &&
        BUBBLES.map((b, i) => <Bubble key={i} cfg={b} height={height} />)}
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
