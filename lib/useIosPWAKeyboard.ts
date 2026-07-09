import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// On iOS PWA the layout viewport doesn't shrink when the keyboard opens —
// only the visual viewport does. Returns the keyboard overlap in px to use
// as extra bottom padding on modals/sheets containing text inputs.
export function useIosPWAKeyboard() {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!(window.navigator as any)?.standalone || !window.visualViewport) return;
    const onResize = () =>
      setOverlap(Math.max(0, window.innerHeight - window.visualViewport!.height));
    window.visualViewport.addEventListener('resize', onResize);
    return () => window.visualViewport!.removeEventListener('resize', onResize);
  }, []);

  return overlap;
}
