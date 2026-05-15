import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import apiClient from "../services/apiClient";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = [
  { value: "Male", labelKey: "genderMale" },
  { value: "Female", labelKey: "genderFemale" },
  { value: "Other", labelKey: "genderOther" },
];

export default function ProfileScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const styles = getStyles(theme);

  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");

  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<"gender" | "blood">("gender");

  const [phone, setPhone] = useState("");

  useEffect(() => {
    const loadData = async () => {
      let apiFetched = false;
      const session = await AsyncStorage.getItem("userToken");
      if (session) {
        const userData = JSON.parse(session);
        setPhone(userData.phone || "");

        try {
           const medRes = await apiClient.get(`/medical-profiles/citizen/${userData.userId}`);
           if (medRes.data) {
              setBloodGroup(medRes.data.bloodGroup || "");
              setAllergies(medRes.data.allergies || "");
              setChronicConditions(medRes.data.chronicConditions || "");
              setMedications(medRes.data.currentMedications || "");
              setSpecialNotes(medRes.data.specialNotes || "");
              apiFetched = true;
           }
        } catch(e) {
           console.log("No medical profile on backend yet.");
        }
      }

      const saved = await AsyncStorage.getItem("userProfile");
      if (saved) {
        const p = JSON.parse(saved);
        if (p.fullName)         setFullName(p.fullName);
        if (p.age)              setAge(p.age);
        if (p.gender)           setGender(p.gender);
        // Only load medical offline details if API didn't have them
        if (!apiFetched) {
           if (p.bloodGroup)       setBloodGroup(p.bloodGroup);
           if (p.allergies)        setAllergies(p.allergies);
           if (p.chronicConditions) setChronicConditions(p.chronicConditions);
           if (p.medications)      setMedications(p.medications);
           if (p.specialNotes)     setSpecialNotes(p.specialNotes);
        }
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    // 1. Sync to Backend
    try {
        const session = await AsyncStorage.getItem("userToken");
        if (session) {
            const userData = JSON.parse(session);
            await apiClient.post(`/medical-profiles`, {
                citizen: { citizenId: userData.userId, name: fullName },
                bloodGroup,
                allergies,
                chronicConditions,
                currentMedications: medications,
                specialNotes
            });
        }
    } catch(e) {
        console.warn("Failed to sync profile offline, proceeding to save locally.");
    }

    // 2. Save locally
    const existing = await AsyncStorage.getItem("userProfile");
    const base = existing ? JSON.parse(existing) : {};
    await AsyncStorage.setItem("userProfile", JSON.stringify({
      ...base,
      fullName,
      age,
      gender,
      bloodGroup,
      allergies,
      chronicConditions,
      medications,
      specialNotes,
      setupComplete: true,
    }));
    navigation.goBack();
  };

  const openPicker = (type: "gender" | "blood") => {
    setPickerType(type);
    setPickerVisible(true);
  };

  const selectOption = (item: string) => {
    if (pickerType === "gender") setGender(item);
    else setBloodGroup(item);
    setPickerVisible(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.headerText} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>{i18n.t("myProfile", { locale })}</Text>
          <Text style={styles.headerSubtitle}>{i18n.t("medicalEmergencyInfo", { locale })}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Basic Information Section */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>{i18n.t("basicInformation", { locale })}</Text>
          </View>

          <Text style={styles.inputLabel}>{i18n.t("fullName", { locale })} <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder={i18n.t("fullNamePlaceholder", { locale })}
            placeholderTextColor={theme.colors.textMuted}
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.inputLabel}>{i18n.t("age", { locale })} <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder={i18n.t("agePlaceholder", { locale })}
            placeholderTextColor={theme.colors.textMuted}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
          />

          <Text style={styles.inputLabel}>{i18n.t("gender", { locale })} <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => openPicker("gender")}>
            <Text style={gender ? styles.selectorText : styles.selectorPlaceholder}>
              {gender ? i18n.t(GENDERS.find(g => g.value === gender)?.labelKey || gender, { locale }) : i18n.t("genderPlaceholder", { locale })}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.inputLabel}>{i18n.t("bloodGroup", { locale })} <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => openPicker("blood")}>
            <Text style={bloodGroup ? styles.selectorText : styles.selectorPlaceholder}>{bloodGroup || i18n.t("bloodGroupPlaceholder", { locale })}</Text>
            <Ionicons name="chevron-down" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Text style={styles.inputLabel}>{i18n.t("phoneLabel", { locale })}</Text>
            <Ionicons name="lock-closed" size={13} color={theme.colors.textMuted} />
          </View>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={phone}
            editable={false}
          />
          <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: -8, marginBottom: 8, opacity: 0.7 }}>
            {i18n.t("phoneReadOnlyHint", { locale })}
          </Text>
        </View>



        {/* Medical Information Section */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.error }]}>
              <Ionicons name="medical" size={20} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>{i18n.t("medicalInformation", { locale })}</Text>
          </View>

          <Text style={styles.inputLabel}>{i18n.t("allergies", { locale })}</Text>
          <TextInput
            style={styles.input}
            placeholder={i18n.t("allergiesPlaceholder", { locale })}
            placeholderTextColor={theme.colors.textMuted}
            value={allergies}
            onChangeText={setAllergies}
          />

          <Text style={styles.inputLabel}>{i18n.t("chronicConditions", { locale })}</Text>
          <TextInput
            style={styles.input}
            placeholder={i18n.t("chronicConditionsPlaceholder", { locale })}
            placeholderTextColor={theme.colors.textMuted}
            value={chronicConditions}
            onChangeText={setChronicConditions}
          />

          <Text style={styles.inputLabel}>{i18n.t("currentMedications", { locale })}</Text>
          <TextInput
            style={styles.input}
            placeholder={i18n.t("currentMedicationsPlaceholder", { locale })}
            placeholderTextColor={theme.colors.textMuted}
            value={medications}
            onChangeText={setMedications}
          />

          <Text style={styles.inputLabel}>{i18n.t("specialMedicalNotes", { locale })}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={i18n.t("specialMedicalNotesPlaceholder", { locale })}
            placeholderTextColor={theme.colors.textMuted}
            value={specialNotes}
            onChangeText={setSpecialNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={16} color={theme.colors.success} />
          <Text style={styles.securityText}>{i18n.t("securityNote", { locale })}</Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Ionicons name="save-outline" size={20} color={theme.colors.buttonText} style={{ marginRight: 8 }} />
          <Text style={styles.saveBtnText}>{i18n.t("saveChanges", { locale })}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Picker Modal */}
      <Modal visible={pickerVisible} animationType="fade" transparent={true} onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerType === "gender" ? i18n.t("gender") : i18n.t("bloodGroup")}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerType === "gender" ? GENDERS.map(g => g.value) : BLOOD_GROUPS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => selectOption(item)}
                >
                  <Text style={[
                      styles.pickerItemText,
                      (pickerType === "gender" ? gender === item : bloodGroup === item) && styles.pickerItemTextActive
                  ]}>
                    {pickerType === "gender"
                      ? i18n.t(GENDERS.find((g) => g.value === item)?.labelKey || item)
                      : item}
                  </Text>
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
    backgroundColor: theme.colors.headerBg,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 48 : 56,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: { marginRight: 16 },
  headerTitleBox: {},
  headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.colors.headerText, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: "500" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: theme.colors.text },
  inputLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 8 },
  required: { color: theme.colors.error },
  input: {
    backgroundColor: theme.colors.inputBg ?? (theme.isDark ? "#0c1021" : "#f8fafc"),
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 20,
    color: theme.colors.text,
  },
  disabledInput: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
    color: theme.colors.textMuted,
  },
  contactBrief: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 12,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  contactRelation: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  contactPhone: { fontSize: 14, color: theme.colors.text, fontWeight: '500' },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  manageBtnText: { color: theme.colors.primary, fontSize: 14, fontWeight: '600' },
  selectorBtn: {
    backgroundColor: theme.colors.inputBg ?? (theme.isDark ? "#0c1021" : "#f8fafc"),
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  selectorText: { fontSize: 15, color: theme.colors.text },
  selectorPlaceholder: { fontSize: 15, color: theme.colors.textMuted },
  textArea: { minHeight: 80, paddingTop: 14 },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.isDark ? "rgba(76, 175, 80, 0.1)" : "#e8f5e9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  securityText: { flex: 1, color: theme.isDark ? "#81c784" : "#2e7d32", fontSize: 13, fontWeight: "500", lineHeight: 18 },
  saveBtn: {
    backgroundColor: theme.colors.buttonBg,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { color: theme.colors.buttonText, fontSize: 16, fontWeight: "bold" },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerContainer: { backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
  pickerItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  pickerItemText: { fontSize: 16, color: theme.colors.text, textAlign: 'center' },
  pickerItemTextActive: { color: theme.colors.primary, fontWeight: 'bold' },
});