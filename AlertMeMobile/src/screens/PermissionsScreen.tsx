import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";

export default function PermissionsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [locationGranted, setLocationGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [smsNoted, setSmsNoted] = useState(false);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationGranted(status === "granted");
  };

  const requestCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    setCameraGranted(status === "granted");
  };

  const requestMic = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setMicGranted(status === "granted");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{i18n.t("permissionsTitle")}</Text>
        <Text style={styles.headerSubtitle}>{i18n.t("permissionsSubtitle")}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="locate" size={24} color={theme.colors.primary} />
            <Text style={styles.cardTitle}>{i18n.t("permissionLocation")}</Text>
          </View>
          <Text style={styles.cardDesc}>{i18n.t("permissionLocationWhy")}</Text>
          <TouchableOpacity
            style={[styles.permBtn, locationGranted && styles.permBtnDone]}
            onPress={requestLocation}
            disabled={locationGranted}
          >
            <Text style={[styles.permBtnText, locationGranted && styles.permBtnTextDone]}>
              {locationGranted ? i18n.t("granted") : i18n.t("allow")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbubble" size={24} color={theme.colors.primary} />
            <Text style={styles.cardTitle}>{i18n.t("permissionSms")}</Text>
          </View>
          <Text style={styles.cardDesc}>{i18n.t("permissionSmsWhy")}</Text>
          <TouchableOpacity
            style={[styles.permBtn, smsNoted && styles.permBtnDone]}
            onPress={() => setSmsNoted(true)}
          >
            <Text style={[styles.permBtnText, smsNoted && styles.permBtnTextDone]}>
              {smsNoted ? i18n.t("noted") : i18n.t("ok")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="camera" size={24} color={theme.colors.primary} />
            <Text style={styles.cardTitle}>{i18n.t("permissionCamera")}</Text>
          </View>
          <Text style={styles.cardDesc}>{i18n.t("permissionCameraWhy")}</Text>
          <TouchableOpacity
            style={[styles.permBtn, cameraGranted && styles.permBtnDone]}
            onPress={requestCamera}
            disabled={cameraGranted}
          >
            <Text style={[styles.permBtnText, cameraGranted && styles.permBtnTextDone]}>
              {cameraGranted ? i18n.t("granted") : i18n.t("allow")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="mic" size={24} color={theme.colors.primary} />
            <Text style={styles.cardTitle}>{i18n.t("permissionMic")}</Text>
          </View>
          <Text style={styles.cardDesc}>{i18n.t("permissionMicWhy")}</Text>
          <TouchableOpacity
            style={[styles.permBtn, micGranted && styles.permBtnDone]}
            onPress={requestMic}
            disabled={micGranted}
          >
            <Text style={[styles.permBtnText, micGranted && styles.permBtnTextDone]}>
              {micGranted ? i18n.t("granted") : i18n.t("allow")}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, !locationGranted && styles.continueBtnDisabled]}
          onPress={() => navigation.replace("Login")}
          disabled={!locationGranted}
        >
          <Text style={styles.continueBtnText}>{i18n.t("continue")}</Text>
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
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: theme.colors.headerText,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: theme.colors.primary },
  cardDesc: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 16, lineHeight: 20 },
  permBtn: {
    backgroundColor: theme.colors.cardHighlight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  permBtnDone: { backgroundColor: theme.isDark ? "rgba(76, 175, 80, 0.2)" : "#e8f5e9" },
  permBtnText: { color: theme.colors.primary, fontWeight: "bold", fontSize: 14, letterSpacing: 0.5 },
  permBtnTextDone: { color: theme.colors.success },
  continueBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: "auto",
  },
  continueBtnDisabled: { backgroundColor: theme.colors.textMuted },
  continueBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
