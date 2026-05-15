import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";

const SPLASH_DURATION = 2500;

export default function SplashScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const styles = getStyles(theme);

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const checkSessionAndNavigate = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");

        // Brief delay to show splash animation branding
        setTimeout(() => {
          if (token) {
            navigation.replace("Home");
          } else {
            navigation.replace("Permissions");
          }
        }, SPLASH_DURATION);
      } catch (e) {
        // Fallback to normal flow
        setTimeout(() => {
          navigation.replace("Permissions");
        }, SPLASH_DURATION);
      }
    };

    checkSessionAndNavigate();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fade, transform: [{ scale }] }]}>
        <View style={styles.logoCircle}>
          <Ionicons name="shield-checkmark" size={64} color={theme.colors.buttonText} />
        </View>
        <Text style={styles.title}>{i18n.t("appName", { locale })}</Text>
        <Text style={styles.tagline}>{i18n.t("appTaglineLong", { locale })}</Text>
        <View style={styles.indicators}>
          <View style={styles.badge}>
            <Ionicons name="lock-closed" size={18} color={theme.colors.primary} />
            <Text style={styles.badgeText}>{i18n.t("secureBadge", { locale })}</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="locate" size={18} color={theme.colors.primary} />
            <Text style={styles.badgeText}>{i18n.t("gpsBadge", { locale })}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: theme.colors.buttonText,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 32,
  },
  indicators: {
    flexDirection: "row",
    gap: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.buttonText,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.primary,
  },
});
