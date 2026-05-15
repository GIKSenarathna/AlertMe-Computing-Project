import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";

export default function SettingsScreen({ navigation }: any) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { locale, setLocale } = useLanguage();
  const styles = getStyles(theme);

  const isSinhala = locale === "si";
  const [emergencyAlerts, setEmergencyAlerts] = useState(false);
  const [alwaysLocation, setAlwaysLocation] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("offlineAlerts").then(data => {
        if (data) {
          const parsed = JSON.parse(data);
          setOfflineCount(parsed.length);
        } else {
          setOfflineCount(0);
        }
      }).catch(() => setOfflineCount(0));
    }, [])
  );

  React.useEffect(() => {
    const loadSettings = async () => {
      const autoSyncVal = await AsyncStorage.getItem("settings_autoSync");
      if (autoSyncVal !== null) setAutoSync(autoSyncVal === "true");

      const locationVal = await AsyncStorage.getItem("settings_alwaysLocation");
      if (locationVal !== null) setAlwaysLocation(locationVal === "true");

      const alertsVal = await AsyncStorage.getItem("settings_emergencyAlerts");
      if (alertsVal !== null) setEmergencyAlerts(alertsVal === "true");
    };
    loadSettings();
  }, []);

  const handleAutoSyncChange = async (val: boolean) => {
    setAutoSync(val);
    await AsyncStorage.setItem("settings_autoSync", String(val));
  };

  const handleLocationChange = async (val: boolean) => {
    setAlwaysLocation(val);
    await AsyncStorage.setItem("settings_alwaysLocation", String(val));
  };

  const handleAlertsChange = async (val: boolean) => {
    setEmergencyAlerts(val);
    await AsyncStorage.setItem("settings_emergencyAlerts", String(val));
  };

  const switchLanguage = () => {
    setLocale(isSinhala ? "en" : "si");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.headerText} />
          <Text style={styles.backText}>{i18n.t("back", { locale })}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{i18n.t("settings", { locale })}</Text>
        <Text style={styles.headerSubtitle}>{i18n.t("managePreferences", { locale })}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.card}>
          <Ionicons name="globe-outline" size={22} color={theme.colors.primary} />
          <View style={styles.cardBody}>
            <Text style={styles.sectionTitle}>{i18n.t("language", { locale })}</Text>
            <Text style={styles.cardDesc}>
              {isSinhala ? "සිංහල / English" : "English / සිංහල"}
            </Text>
            <Text style={styles.currentText}>
              {i18n.t("current", { locale })}: {isSinhala ? "සිංහල" : "English"}
            </Text>
          </View>
          <TouchableOpacity style={styles.switchLangBtn} onPress={switchLanguage}>
            <Text style={styles.switchLangBtnText}>
              {isSinhala ? "Switch to English" : "Switch to සිංහල"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Ionicons name="notifications-outline" size={22} color={theme.colors.primary} />
          <View style={styles.cardBody}>
            <Text style={styles.sectionTitle}>{i18n.t("notifications", { locale })}</Text>
            <Text style={styles.cardTitle}>{i18n.t("emergencyAlerts", { locale })}</Text>
            <Text style={styles.cardDesc}>{i18n.t("emergencyAlertsDesc", { locale })}</Text>
          </View>
          <Switch
            value={emergencyAlerts}
            onValueChange={handleAlertsChange}
            trackColor={{ false: "#ccc", true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.card}>
          <Ionicons name="locate-outline" size={22} color={theme.colors.primary} />
          <View style={styles.cardBody}>
            <Text style={styles.sectionTitle}>{i18n.t("location", { locale })}</Text>
            <Text style={styles.cardTitle}>{i18n.t("alwaysAllowLocation", { locale })}</Text>
            <Text style={styles.cardDesc}>{i18n.t("alwaysAllowLocationDesc", { locale })}</Text>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.infoBoxText}>{i18n.t("locationAutoCaptured", { locale })}</Text>
            </View>
          </View>
          <Switch
            value={alwaysLocation}
            onValueChange={handleLocationChange}
            trackColor={{ false: "#ccc", true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.cardColumn}>
          <View style={styles.cardRow}>
            <Ionicons name="server-outline" size={22} color={theme.colors.primary} />
            <View style={styles.cardBody}>
              <Text style={styles.sectionTitle}>{i18n.t("dataStorage", { locale })}</Text>
              <Text style={styles.cardTitle}>{i18n.t("autoSync", { locale })}</Text>
              <Text style={styles.cardDesc}>{i18n.t("autoSyncDesc", { locale })}</Text>
            </View>
            <Switch
              value={autoSync}
              onValueChange={handleAutoSyncChange}
              trackColor={{ false: "#ccc", true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <TouchableOpacity style={styles.viewOfflineBtn} onPress={() => navigation.navigate("OfflineAlerts")}>
            <Text style={styles.viewOfflineBtnText}>{i18n.t("viewOfflineAlerts", { locale })}</Text>
            {offlineCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{offlineCount}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Ionicons name="sunny-outline" size={22} color={theme.colors.primary} />
          <View style={styles.cardBody}>
            <Text style={styles.sectionTitle}>{i18n.t("appearance", { locale })}</Text>
            <Text style={styles.cardTitle}>{i18n.t("darkMode", { locale })}</Text>
            <Text style={styles.cardDesc}>{i18n.t("darkModeDesc", { locale })}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: "#ccc", true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.card}>
          <Ionicons name="information-circle-outline" size={22} color={theme.colors.primary} />
          <View style={styles.cardBody}>
            <Text style={styles.sectionTitle}>{i18n.t("appInfo", { locale })}</Text>
            <Text style={styles.cardDesc}>{i18n.t("version", { locale })}: 1.0.0</Text>
            <Text style={styles.cardDesc}>{i18n.t("build", { locale })}: 2026.02.18</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => navigation.navigate("Contacts")}
        >
          <Ionicons name="people" size={24} color={theme.colors.primary} />
          <View style={styles.linkCardText}>
            <Text style={styles.linkCardTitle}>{i18n.t("contacts", { locale })}</Text>
            <Text style={styles.linkCardDesc}>{i18n.t("manageContacts", { locale })}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person" size={24} color={theme.colors.primary} />
          <View style={styles.linkCardText}>
            <Text style={styles.linkCardTitle}>{i18n.t("profile", { locale })}</Text>
            <Text style={styles.linkCardDesc}>{i18n.t("medicalEmergencyInfo", { locale })}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            try {
              // Clear ALL user-specific data so a new login starts fresh
              await AsyncStorage.multiRemove([
                "userToken",
                "userProfile",
                "firebaseIdToken",
                "emergencyContacts",
                "offlineAlerts",
              ]);
              navigation.replace("Login");
            } catch (e) {
              console.error("Logout error:", e);
              navigation.replace("Login");
            }
          }}
        >
          <Ionicons name="log-out-outline" size={22} color="#fff" />
          <Text style={styles.logoutBtnText}>{i18n.t("logout", { locale })}</Text>
        </TouchableOpacity>
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
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 4 },
  backText: { color: theme.colors.headerText, fontSize: 16 },
  headerTitle: { fontSize: 26, fontWeight: "bold", color: theme.colors.headerText, marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.9)" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  cardBody: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.primary, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: theme.colors.text },
  cardDesc: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  currentText: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  switchLangBtn: {
    backgroundColor: theme.colors.cardHighlight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  switchLangBtnText: { color: theme.colors.primary, fontWeight: "600", fontSize: 13 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.cardHighlight,
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  infoBoxText: { flex: 1, fontSize: 13, color: theme.colors.primary },
  cardColumn: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  viewOfflineBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.cardHighlight,
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  viewOfflineBtnText: { fontSize: 14, color: theme.colors.primary, fontWeight: "500" },
  badge: {
    backgroundColor: theme.colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    gap: 14,
  },
  linkCardText: { flex: 1 },
  linkCardTitle: { fontSize: 16, fontWeight: "600", color: theme.colors.text },
  linkCardDesc: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.error,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  logoutBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
