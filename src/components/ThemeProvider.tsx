'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'sunny';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: 'light', setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('valet-theme') as Theme | null;
    if (saved) apply(saved);
  }, []);

  function apply(t: Theme) {
    setThemeState(t);
    const el = document.documentElement;
    el.classList.remove('dark', 'sunny');
    if (t === 'dark') el.classList.add('dark');
    if (t === 'sunny') el.classList.add('sunny');
    localStorage.setItem('valet-theme', t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: apply }}>
      {children}
    </ThemeContext.Provider>
  );
}
