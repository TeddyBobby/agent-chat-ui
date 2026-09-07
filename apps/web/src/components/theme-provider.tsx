'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { resolveDark, THEME_STORAGE_KEY } from './theme-state';

interface ThemeContextType {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ dark: false, toggle: () => {} });

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const isDark = resolveDark(stored, systemPrefersDark());
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
    setHydrated(true);

    // 用户从未手动切换过主题时，实时跟随系统深色模式的变化。
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (event: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      setDark(event.matches);
      document.documentElement.classList.toggle('dark', event.matches);
    };
    media.addEventListener('change', onSystemChange);
    return () => media.removeEventListener('change', onSystemChange);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  };

  if (!hydrated) {
    // Prevent flash: render nothing until theme is loaded.
    // 注意 dark: 前缀 —— 首帧前 <head> 里的内联脚本已经给 <html> 挂上 .dark，
    // 深色用户这里也应是深色背景，避免白屏闪烁。
    return <div className="min-h-screen bg-[#f7f7f5] dark:bg-zinc-950" />;
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
