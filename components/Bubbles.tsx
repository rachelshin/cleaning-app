import { DimensionValue, StyleSheet, View } from 'react-native';

// Soft floating bubbles echoing the app icon's background. Purely
// decorative: absolutely positioned behind content, never interactive.
const BUBBLES: {
  top: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  size: number;
}[] = [
  { top: '11%', left: '5%', size: 44 },
  { top: '7%', right: '14%', size: 20 },
  { top: '28%', right: '3%', size: 56 },
  { top: '46%', left: '2%', size: 24 },
  { top: '64%', right: '9%', size: 34 },
  { top: '80%', left: '10%', size: 50 },
];

export default function Bubbles() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BUBBLES.map((b, i) => (
        <View
          key={i}
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
    </View>
  );
}

const s = StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
});
