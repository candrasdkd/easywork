// src/theme/ThemeContext.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

const ThemeModeContext = createContext({
    toggleColorMode: () => { },
    mode: 'light' as 'light' | 'dark',
});

export const useThemeMode = () => useContext(ThemeModeContext);

export default function ThemeModeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<'light' | 'dark'>('light');

    const toggleColorMode = () => {
        setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                },
            }),
        [mode]
    );

    return (
        <ThemeModeContext.Provider value={{ toggleColorMode, mode }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    );
}
