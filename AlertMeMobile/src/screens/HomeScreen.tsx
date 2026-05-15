import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import SOSButton from "../components/SOSButton";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import { syncAlertsIfOnline } from "../utils/syncService";

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const styles = getStyles(theme);

  const [gpsReady, setGpsReady] = useState(false);

  useEffect(() => {
    syncAlertsIfOnline();
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setGpsReady(status === "granted");
    })();
  }, []);

  const menuItems = [
    { key: "Report", icon: "document-text" as const, color: "#c62828", labelKey: "report", subtitleKey: "reportSubtitle", screen: "Report" },
    { key: "Tracking", icon: "navigate" as const, color: "#0d47a1", labelKey: "trackEmergency", subtitleKey: "trackEmergencySubtitle", screen: "Tracking" },
    { key: "Contacts", icon: "people" as const, color: "#1b5e20", labelKey: "contacts", subtitleKey: "contactsSubtitle", screen: "Contacts" },
    { key: "History", icon: "time" as const, color: "#f57c00", labelKey: "incidentHistory", subtitleKey: "historySubtitle", screen: "History" },
    { key: "Profile", icon: "person-circle" as const, color: "#4a148c", labelKey: "profile", subtitleKey: "profileSubtitle", screen: "Profile" },
    { key: "Settings", icon: "settings" as const, color: "#263238", labelKey: "settings", subtitleKey: "settingsSubtitle", screen: "Settings" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{i18n.t("appName", { locale })}</Text>
        <Text style={styles.headerSubtitle}>{i18n.t("appTagline", { locale })}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.gpsCard}>
          <View style={styles.gpsIconCircle}>
            <Ionicons name="location-outline" size={20} color={theme.colors.success} />
          </View>
          <View style={styles.gpsTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.gpsTitle}>{i18n.t("gpsStatus", { locale })}</Text>
              {gpsReady && <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.success} />}
            </View>
            <Text style={styles.gpsDesc}>{gpsReady ? i18n.t("gpsDetected", { locale }) : i18n.t("gpsUnknown", { locale })}</Text>
          </View>
        </View>

        <View style={styles.sosSection}>
          <SOSButton onActivate={() => navigation.navigate("SOS")} />
          <Text style={styles.sosHelperText}>{i18n.t("sosHoldHint", { locale })}</Text>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.menuCard}
              onPress={() => navigation.navigate(item.screen, item.screen === 'Tracking' ? { source: 'home' } : undefined)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon} size={20} color="#fff" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuLabel}>{i18n.t(item.labelKey, { locale })}</Text>
                <Text style={styles.menuSubtitle}>{i18n.t(item.subtitleKey, { locale })}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.emergencyNote}>{i18n.t("emergencyNote", { locale })}</Text>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    backgroundColor: theme.colors.headerBg,
    paddingTop: Platform.OS === "android" ? 48 : 56,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.headerText,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.headerText,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  gpsCard: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    width: "85%",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  gpsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.isDark ? "rgba(46, 125, 50, 0.2)" : "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
  },
  gpsTextContainer: { flex: 1 },
  gpsTitle: { fontSize: 15, fontWeight: "bold", color: theme.colors.text },
  gpsDesc: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  sosSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  sosHelperText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 20,
    textAlign: "center",
  },
  emergencyNote: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 32,
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  menuSection: { gap: 12 },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  menuTextContainer: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: "bold", color: theme.colors.text }, // Using default text instead of primary blue
  menuSubtitle: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
});
