import "react-native-get-random-values";
import { NavigationContainer } from "@react-navigation/native";
import React, { useEffect } from "react";
import { AppState } from "react-native";
import { LanguageProvider } from "./src/context/LanguageContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { syncAlertsIfOnline } from "./src/utils/syncService";

export default function App() {
  useEffect(() => {
    // Initial sync on app load
    syncAlertsIfOnline();

    // Sync when app comes to foreground
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        syncAlertsIfOnline();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </LanguageProvider>
    </ThemeProvider>
  );
}