import React from 'react';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Syncs the device system color scheme with NativeWind's dark mode.
 * Wrap this around the app root so `dark:` classes respond to system preference.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const { setColorScheme } = useNativeWindColorScheme();

  React.useEffect(() => {
    // Force light mode — dark mode is not fully supported in this version
    setColorScheme('light');
  }, [setColorScheme]);

  return <>{children}</>;
}
