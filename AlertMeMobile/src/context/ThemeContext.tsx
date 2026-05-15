import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

const THEME_KEY = "alertme_theme_preference";

export const lightTheme = {
    isDark: false,
    colors: {
        background: "#f1f5f9",
        card: "#ffffff",
        text: "#1e293b",
        textMuted: "#64748b",
        primary: "#D32F2F",
        border: "#e2e8f0",
        headerBg: "#D32F2F",
        headerText: "#ffffff",
        buttonBg: "#D32F2F",
        buttonText: "#ffffff",
        cardHighlight: "#fef2f2",
        error: "#D32F2F",
        success: "#2e7d32",
        inputBg: "#f8fafc",
    },
};

export const darkTheme = {
    isDark: true,
    colors: {
        background: "#0c1021",
        card: "#1a2236",
        text: "#e2e8f0",
        textMuted: "#64748b",
        primary: "#e53935",
        border: "rgba(255,255,255,0.07)",
        headerBg: "#111827",
        headerText: "#ffffff",
        buttonBg: "#e53935",
        buttonText: "#ffffff",
        cardHighlight: "#1e2d45",
        error: "#e53935",
        success: "#22c55e",
        inputBg: "rgba(0,0,0,0.25)",
    },
};

type Theme = typeof lightTheme;

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: lightTheme,
    toggleTheme: () => { },
    isDark: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Default to light mode; will be overridden once AsyncStorage loads
    const [isDark, setIsDark] = useState(false);

    // Load saved preference on app start
    useEffect(() => {
        AsyncStorage.getItem(THEME_KEY).then((saved) => {
            if (saved !== null) {
                setIsDark(saved === "dark");
            }
            // If no saved value, keep the default (light mode)
        });
    }, []);

    const theme = isDark ? darkTheme : lightTheme;

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        // Persist the new preference
        AsyncStorage.setItem(THEME_KEY, next ? "dark" : "light");
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
