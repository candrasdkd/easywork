// src/theme/ThemeContext.tsx
import React, { createContext, useContext } from 'react';

const ThemeModeContext = createContext({
    toggleColorMode: () => { },
    mode: 'light' as 'light' | 'dark',
});

export const useThemeMode = () => useContext(ThemeModeContext);

export default function ThemeModeProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeModeContext.Provider value={{ toggleColorMode: () => { }, mode: 'light' }}>
            {children}
        </ThemeModeContext.Provider>
    );
}
