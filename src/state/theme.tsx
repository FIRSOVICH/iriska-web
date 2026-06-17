import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useStore } from '../state/store';

export const ACCENTS: Record<string, { name: string; c: string; c2: string }> = {
  iriska:   { name: 'Ириска',   c: '#D99A4E', c2: '#B87530' },
  konfetka: { name: 'Конфетка', c: '#E86A9B', c2: '#C44C7C' },
  myata:    { name: 'Мята',     c: '#46C2A0', c2: '#2E9C7E' },
  karamel:  { name: 'Карамель', c: '#E0913C', c2: '#BE7220' },
  chernika: { name: 'Черника',  c: '#8278E6', c2: '#5F54C4' },
  vishnya:  { name: 'Вишня',    c: '#E25670', c2: '#BE3A52' },
};

export const FONTS = ['Inter', 'Segoe UI', 'SF Pro', 'Roboto'];

const ThemeContext = createContext({ accent: ACCENTS.iriska });
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { mode, accent, font } = useStore((s) => s.theme);
  const accentObj = ACCENTS[accent] || ACCENTS.iriska;
  const fontFamily = font === 'SF Pro' ? `-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif` : `'${font}', system-ui, sans-serif`;

  useEffect(() => {
    document.body.classList.toggle('light', mode === 'light');
    const root = document.documentElement;
    root.style.setProperty('--accent', accentObj.c);
    root.style.setProperty('--accent2', accentObj.c2);
    root.style.setProperty('--font', fontFamily);
    root.style.setProperty('--bubble-out', accentObj.c);
  }, [mode, accent, font, accentObj, fontFamily]);

  return (
    <ThemeContext.Provider value={{ accent: accentObj }}>
      {children}
    </ThemeContext.Provider>
  );
}
