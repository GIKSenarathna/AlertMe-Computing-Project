import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Modal,
  Keyboard,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function EmergencyProfileSetupScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const styles = getStyles(theme);

  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  React.useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [pickerVisible, setPickerVisible] = useState(false);

  // Step 2
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [condition, setCondition] = useState("");

  const handleStep1Next = () => {
    if (!fullName.trim()) return;
    setStep(2);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Save profile locally with field names that match ProfileScreen
      const profile = {
        fullName: fullName.trim(),
        bloodGroup,
        allergies: allergies.trim(),
        chronicConditions: condition.trim(), // ProfileScreen uses "chronicConditions"
        medications: "",
        specialNotes: "",
        setupComplete: true,
      };
      await AsyncStorage.setItem("userProfile", JSON.stringify(profile));

      // Try to sync to backend
      try {
        const session = await AsyncStorage.getItem("userToken");
        if (session) {
          const { default: apiClient } = await import("../services/apiClient");
          const userData = JSON.parse(session);
          await apiClient.post("/medical-profiles", {
            citizen: { citizenId: userData.userId, name: fullName.trim() },
            bloodGroup,
            allergies: allergies.trim(),
            chronicConditions: condition.trim(),
            currentMedications: "",
            specialNotes: "",
          });
        }
      } catch (syncErr) {
        console.log("Backend sync skipped — will retry from Profile screen.");
      }

      // Save emergency contact locally
      if (contactName.trim() && contactPhone.trim()) {
        const contact = { name: contactName.trim(), phone: contactPhone.trim(), relationship: "Emergency Contact" };
        await AsyncStorage.setItem("primaryEmergencyContact", JSON.stringify(contact));
      }
    } catch (e) {
      console.warn("Profile save failed", e);
    } finally {
      setSaving(false);
      navigation.replace("Home");
    }
  };

  const handleSkip = () => {
    navigation.replace("Home");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.shieldRow}>
          <Ionicons name="shield-checkmark" size={36} color={theme.colors.headerText} />
        </View>
        <Text style={styles.headerTitle}>{i18n.t("setupTitle", { locale })}</Text>
        <Text style={styles.headerSubtitle}>{i18n.t("setupSubtitle", { locale })}</Text>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {[1, 2].map((s) => (
            <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: keyboardVisible ? 150 : 48 }]} keyboardShouldPersistTaps="handled">

        {/* ── Step 1: Name + Blood Group ── */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>{i18n.t("setupStep1Label", { locale })}</Text>

            <Text style={styles.fieldLabel}>
              {i18n.t("fullName", { locale })} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={i18n.t("fullNamePlaceholder", { locale })}
              placeholderTextColor={theme.colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoFocus
            />

            <Text style={styles.fieldLabel}>{i18n.t("bloodGroup", { locale })}</Text>
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setPickerVisible(true)}>
              <Text style={bloodGroup ? styles.selectorText : styles.selectorPlaceholder}>
                {bloodGroup || i18n.t("bloodGroupPlaceholder", { locale })}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>
              {i18n.t("allergies", { locale })}{" "}
              <Text style={styles.optional}>{i18n.t("optional", { locale })}</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={i18n.t("allergiesPlaceholder", { locale })}
              placeholderTextColor={theme.colors.textMuted}
              value={allergies}
              onChangeText={setAllergies}
            />

            <Text style={styles.fieldLabel}>
              {i18n.t("chronicConditions", { locale })}{" "}
              <Text style={styles.optional}>{i18n.t("optional", { locale })}</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={i18n.t("chronicConditionsPlaceholder", { locale })}
              placeholderTextColor={theme.colors.textMuted}
              value={condition}
              onChangeText={setCondition}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, !fullName.trim() && styles.primaryBtnDisabled]}
              onPress={handleStep1Next}
              disabled={!fullName.trim()}
            >
              <Text style={styles.primaryBtnText}>{i18n.t("continue", { locale })}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>{i18n.t("setupSkip", { locale })}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 2: Emergency Contact + Medical ── */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>{i18n.t("setupStep2Label", { locale })}</Text>

            <View style={styles.infoBox}>
              <Ionicons name="call" size={16} color={theme.colors.primary} />
              <Text style={styles.infoBoxText}>{i18n.t("setupContactHint", { locale })}</Text>
            </View>

            <Text style={styles.fieldLabel}>{i18n.t("nameLabel", { locale })}</Text>
            <TextInput
              style={styles.input}
              placeholder={i18n.t("namePlaceholder", { locale })}
              placeholderTextColor={theme.colors.textMuted}
              value={contactName}
              onChangeText={setContactName}
            />

            <Text style={styles.fieldLabel}>{i18n.t("phoneLabel", { locale })}</Text>
            <TextInput
              style={styles.input}
              placeholder="+94 71 234 5678"
              placeholderTextColor={theme.colors.textMuted}
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />



            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
              onPress={handleFinish}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{i18n.t("setupFinish", { locale })}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backRow} onPress={() => setStep(1)}>
              <Ionicons name="arrow-back" size={16} color={theme.colors.textMuted} />
              <Text style={styles.skipText}>{i18n.t("back", { locale })}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Blood Group Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setPickerVisible(false)} activeOpacity={1}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>{i18n.t("bloodGroup", { locale })}</Text>
            <FlatList
              data={BLOOD_GROUPS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, bloodGroup === item && styles.pickerItemActive]}
                  onPress={() => { setBloodGroup(item); setPickerVisible(false); }}
                >
                  <Text style={[styles.pickerItemText, bloodGroup === item && styles.pickerItemTextActive]}>
                    {item}
                  </Text>
                  {bloodGroup === item && <Ionicons name="checkmark" size={20} color={theme.colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: Platform.OS === "android" ? 48 : 60,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  shieldRow: { marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 6 },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 19 },
  stepRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  stepDot: { width: 32, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  stepDotActive: { backgroundColor: "#fff" },
  content: { padding: 20 },
  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 22, gap: 4 },
  stepLabel: { fontSize: 13, fontWeight: "700", color: theme.colors.primary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: theme.colors.text, marginTop: 12, marginBottom: 6 },
  required: { color: theme.colors.error },
  optional: { fontSize: 12, fontWeight: "400", color: theme.colors.textMuted },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: theme.colors.background,
  },
  selectorText: { fontSize: 15, color: theme.colors.text },
  selectorPlaceholder: { fontSize: 15, color: theme.colors.textMuted },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  skipBtn: { alignItems: "center", marginTop: 14 },
  skipText: { color: theme.colors.textMuted, fontSize: 13 },
  backRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: theme.colors.cardHighlight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
    marginTop: 4,
  },
  infoBoxText: { flex: 1, fontSize: 13, color: theme.colors.primary, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "60%",
  },
  pickerTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, textAlign: "center", marginBottom: 12, paddingHorizontal: 20 },
  pickerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 24 },
  pickerItemActive: { backgroundColor: theme.colors.cardHighlight },
  pickerItemText: { fontSize: 16, color: theme.colors.text },
  pickerItemTextActive: { color: theme.colors.primary, fontWeight: "700" },
});
