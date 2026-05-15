import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import MapView, { Marker } from 'react-native-maps';
import {
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import { saveOfflineAlert } from "../utils/offlineStorage";
import { startRecording, stopRecording } from "../utils/voiceRecorder";
import apiClient from "../services/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../services/firebaseConfig";
import { notifyEmergencyContacts } from "../utils/contactNotifier";

type Step = 1 | 2 | 3 | 4;

export default function ReportAccidentScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const isSinhala = locale === "si";
  const styles = getStyles(theme);

  const [step, setStep] = useState<Step>(1);
  const [reportingFor, setReportingFor] = useState<"myself" | "someone_else" | null>(null);

  const [locationName, setLocationName] = useState(i18n.t("gpsUnknown"));
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);

  const [accidentType, setAccidentType] = useState<string | null>(null);
  const [accidentDescription, setAccidentDescription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [severityScore, setSeverityScore] = useState<number>(3);

  useEffect(() => {
    if (step === 2) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
             setLocationName(i18n.t("gpsUnknown", { locale }));
             setCoords({ lat: 6.9271, lng: 79.8612 }); // Colombo Fallback
             return;
          }

          const loc = await Location.getCurrentPositionAsync({});
          setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          const [address] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (address) {
            setLocationName(`${address.city || address.region || i18n.t("gpsUnknown", { locale })}, Sri Lanka`);
          } else {
            setLocationName(i18n.t("gpsReady", { locale }));
          }
        } catch (e) {
          setLocationName(i18n.t("gpsDetected", { locale }));
          setCoords(prev => prev || { lat: 6.9271, lng: 79.8612 }); // Prevent map crash if location totally fails
        }
      })();
    }
  }, [step]);

  const handleNext = () => {
    if (step < 4) setStep((prev) => (prev + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as Step);
    else navigation.goBack();
  };

  const toggleRecording = async () => {
    if (isRecording) {
      const uri = await stopRecording();
      setAudioUri(uri);
      setIsRecording(false);
    } else {
      await startRecording();
      setIsRecording(true);
    }
  };

  const wrapTakeImage = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!res.canceled) setPhotoUri(res.assets[0].uri);
  };

  const wrapTakeVideo = async () => {
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.5,
      allowsEditing: true,
      videoMaxDuration: 30,
    });
    if (!res.canceled) setVideoUri(res.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const sessionString = await AsyncStorage.getItem("userToken");
      let reporterId = "ANONYMOUS";
      
      if (sessionString) {
        const session = JSON.parse(sessionString);
        reporterId = session.userId || "ANONYMOUS";
      }

      // Live payload injection directly mapping the DB specifications
      const incidentPayload = {
        reporterId: reporterId,
        type: accidentType ? accidentType.toUpperCase() : "OTHER",
        severityScore: severityScore,
        latitude: coords ? coords.lat : 6.9271,
        longitude: coords ? coords.lng : 79.8612,
        approximateAddress: locationName
      };
      
      let newIncidentId = null;
      let isOffline = false;

      try {
        const response = await apiClient.post("/incidents", incidentPayload);
        newIncidentId = response.data.incidentId;
      } catch (e: any) {
        console.warn("Failed to push Incident to API Firehose, switching to offline mode", e);
        isOffline = true;
      }

      if (!isOffline && newIncidentId) {
        // Helper to upload a file as multipart/form-data using fetch to avoid Axios boundary issues
        const uploadFile = async (uri: string, mediaType: string) => {
          const filename = uri.split('/').pop() || `evidence_${Date.now()}`;
          const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
          const mimeMap: Record<string, string> = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
            mp4: 'video/mp4', mov: 'video/quicktime',
            m4a: 'audio/m4a', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav'
          };
          const mime = mimeMap[ext] || 'application/octet-stream';

          const formData = new FormData();
          const normalizedUri = Platform.OS === 'android' && uri.startsWith('/') ? `file://${uri}` : uri;
          formData.append('file', { uri: normalizedUri, name: filename, type: mime } as any);
          formData.append('incidentId', newIncidentId);
          formData.append('mediaType', mediaType);

          // Get latest token
          let tokenToUse = null;
          if (auth && auth.currentUser) {
            try {
              tokenToUse = await auth.currentUser.getIdToken(true);
            } catch(e) {
              console.warn("Token refresh failed in uploadFile", e);
            }
          }
          if (!tokenToUse) {
            const sessionStr = await AsyncStorage.getItem('userToken');
            if (sessionStr) {
               tokenToUse = JSON.parse(sessionStr).token;
            }
          }

          const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.101:8080/api';
          const response = await fetch(`${API_BASE_URL}/evidence/upload/file`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenToUse}`
            },
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
          }
          return response.json();
        };

        // Automatically push Evidences parallelly
        const uploadPromises = [];

        // Text description: stored as plain JSON (no binary)
        if (accidentDescription && accidentDescription.trim().length > 0) {
          uploadPromises.push(apiClient.post("/evidence/upload", {
            incident: { incidentId: newIncidentId },
            mediaType: "TEXT",
            storageUrl: accidentDescription,
            tacticalLiveFeed: false
          }));
        }

        // Binary files: uploaded as multipart
        if (photoUri) {
          uploadPromises.push(uploadFile(photoUri, 'PHOTO'));
        }
        if (videoUri) {
          uploadPromises.push(uploadFile(videoUri, 'VIDEO'));
        }
        if (audioUri) {
          uploadPromises.push(uploadFile(audioUri, 'AUDIO'));
        }
        
        // Execute uploads
        const uploadResults = await Promise.allSettled(uploadPromises);
        const failedUploads = uploadResults.filter(r => r.status === 'rejected');
        if (failedUploads.length > 0) {
          console.error("Failed uploads:", failedUploads);
          const firstError = (failedUploads[0] as PromiseRejectedResult).reason;
          Alert.alert("Evidence Upload Failed", String(firstError?.message || firstError));
        }
      } else {
        // We are offline! Save the full payload so syncService can do it later.
        await saveOfflineAlert({
          isAccidentReport: true, // flag for syncService
          incidentPayload,
          accidentDescription,
          photoUri,
          videoUri,
          audioUri,
          time: new Date().toISOString(),
          category: accidentType || "Other Emergency",
          description: accidentDescription || "No details provided"
        });
      }
      
      // Notify Emergency Contacts
      if (coords) {
        notifyEmergencyContacts({ latitude: coords.lat, longitude: coords.lng }, locationName);
      }
      
      setStep(4);
    } catch (e: any) {
      console.error("Critical error in handleSubmit:", e);
      Alert.alert(
        "Application Error", 
        "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.headerText} />
        </TouchableOpacity>
            <Text style={styles.headerTitle}>{i18n.t("report", { locale })}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
          ))}
        </View>

        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>{i18n.t("whoIsInvolved", { locale })}</Text>
            <TouchableOpacity
              style={[styles.optionCard, reportingFor === "myself" && styles.optionCardActive]}
              onPress={() => setReportingFor("myself")}
            >
              <Ionicons name="person" size={32} color={reportingFor === "myself" ? theme.colors.primary : theme.colors.textMuted} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, reportingFor === "myself" && styles.optionTitleActive]}>{i18n.t("myself", { locale })}</Text>
                <Text style={styles.optionDesc}>{i18n.t("myselfDesc", { locale })}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, reportingFor === "someone_else" && styles.optionCardActive]}
              onPress={() => setReportingFor("someone_else")}
            >
              <Ionicons name="people" size={32} color={reportingFor === "someone_else" ? theme.colors.primary : theme.colors.textMuted} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, reportingFor === "someone_else" && styles.optionTitleActive]}>{i18n.t("someoneElse", { locale })}</Text>
                <Text style={styles.optionDesc}>{i18n.t("someoneElseDesc", { locale })}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, !reportingFor && styles.primaryBtnDisabled]}
              onPress={handleNext}
              disabled={!reportingFor}
            >
              <Text style={styles.primaryBtnText}>{i18n.t("continue", { locale })}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>{i18n.t("locationConfirmation", { locale })}</Text>
            <View style={styles.ruleCard}>
              <Ionicons name="information-circle" size={24} color={theme.colors.primary} />
              <Text style={styles.ruleText}>{i18n.t("locationRule", { locale })}</Text>
            </View>

            <View style={styles.mapContainer}>
              {coords ? (
                <MapView
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={{
                    latitude: coords.lat,
                    longitude: coords.lng,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  userInterfaceStyle={theme.isDark ? "dark" : "light"}
                >
                  <Marker coordinate={{ latitude: coords.lat, longitude: coords.lng }}>
                    <View style={styles.alertMarker}>
                      <Ionicons name="location" size={24} color="#fff" />
                    </View>
                  </Marker>
                </MapView>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
              )}
              
              <View style={styles.mapOverlayBlock}>
                 <Text style={styles.mapOverlayText} numberOfLines={1}>{locationName}</Text>
                 <Text style={{ fontSize: 11, color: theme.colors.textMuted, textAlign: "center", marginTop: 2 }}>{i18n.t("autoDetectedGps", { locale })}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
              <Text style={styles.primaryBtnText}>{i18n.t("confirmLocation", { locale })}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>{i18n.t("addDetails", { locale })}</Text>

            <Text style={styles.fieldLabel}>{i18n.t("accidentType", { locale })}</Text>
            <View style={styles.typesGrid}>
              {[
                { type: "Vehicle Accident", label: i18n.t("accidentTypeVehicle", { locale }) },
                { type: "Medical Emergency", label: i18n.t("accidentTypeMedical", { locale }) },
                { type: "Fire Hazard", label: i18n.t("accidentTypeFire", { locale }) },
                { type: "Crime/Assault", label: i18n.t("accidentTypeCrime", { locale }) },
                { type: "Natural Disaster", label: i18n.t("accidentTypeDisaster", { locale }) },
                { type: "Unknown / Other", label: i18n.t("accidentTypeOther", { locale }) }
              ].map(({ type, label }) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBadge, accidentType === type && styles.typeBadgeActive]}
                  onPress={() => setAccidentType(type)}
                >
                  <Text style={[styles.typeText, accidentType === type && styles.typeTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Severity Selector ─────────────────────────── */}
            <Text style={styles.fieldLabel}>{i18n.t("incidentSeverity", { locale })}</Text>
            <View style={styles.severityRow}>
              {[
                { level: 1, label: i18n.t('severityLow',      { locale }), color: '#22c55e' },
                { level: 2, label: i18n.t('severityMinor',    { locale }), color: '#84cc16' },
                { level: 3, label: i18n.t('severityModerate', { locale }), color: '#f59e0b' },
                { level: 4, label: i18n.t('severitySerious',  { locale }), color: '#f97316' },
                { level: 5, label: i18n.t('severityCritical', { locale }), color: '#ef4444' },
              ].map(({ level, label, color }) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.severityChip,
                    severityScore === level && { backgroundColor: color, borderColor: color },
                  ]}
                  onPress={() => setSeverityScore(level)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.severityChipNum,
                    severityScore === level && styles.severityChipTextActive,
                  ]}>
                    {level}
                  </Text>
                  <Text style={[
                    styles.severityChipLabel,
                    severityScore === level && styles.severityChipTextActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{i18n.t("description", { locale })}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={i18n.t("descriptionPlaceholder", { locale })}
              value={accidentDescription}
              onChangeText={setAccidentDescription}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>{i18n.t("voiceNote", { locale })}</Text>
            <TouchableOpacity style={[styles.mediaBtn, isRecording && styles.recordingBtn]} onPress={toggleRecording}>
              <Ionicons name={isRecording ? "stop" : "mic"} size={24} color={isRecording ? theme.colors.buttonText : theme.colors.primary} />
              <Text style={[styles.mediaBtnText, isRecording && styles.recordingBtnText]}>
                {isRecording ? i18n.t("stopRecording", { locale }) : audioUri ? i18n.t("reRecordAudio", { locale }) : i18n.t("holdToRecord", { locale })}
              </Text>
            </TouchableOpacity>
            {audioUri && !isRecording && <Text style={styles.mediaSuccess}>{i18n.t("audioRecorded", { locale })}</Text>}

            <Text style={styles.fieldLabel}>{i18n.t("addPhoto", { locale })}</Text>
            <TouchableOpacity style={styles.mediaBtn} onPress={wrapTakeImage}>
              <Ionicons name="camera" size={24} color={theme.colors.primary} />
              <Text style={styles.mediaBtnText}>{photoUri ? i18n.t("retakePhoto", { locale }) : i18n.t("takePhoto", { locale })}</Text>
            </TouchableOpacity>
            {photoUri && (
              <Image source={{ uri: photoUri }} style={styles.previewImage} />
            )}

            <Text style={styles.fieldLabel}>{i18n.t("addVideoEvidence", { locale })} <Text style={{ fontWeight: 'bold', opacity: 0.6 }}>{i18n.t("optional", { locale })}</Text></Text>
            <TouchableOpacity style={styles.mediaBtn} onPress={wrapTakeVideo}>
              <Ionicons name="videocam" size={24} color={theme.colors.primary} />
              <Text style={styles.mediaBtnText}>
                {videoUri ? i18n.t("retakeVideo", { locale }) : i18n.t("captureVideo", { locale })}
              </Text>
            </TouchableOpacity>
            {videoUri && (
              <View style={styles.videoSuccessBox}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <Text style={styles.videoSuccessText}>{i18n.t("videoSuccess", { locale })}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color={theme.colors.background} />
              ) : (
                <Text style={styles.primaryBtnText}>{i18n.t("submitReport")}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainerCentered}>
            <Ionicons name="checkmark-circle" size={80} color={theme.colors.success} />
            <Text style={styles.title}>{i18n.t("reportSubmitted")}</Text>
            <Text style={styles.descCentered}>{i18n.t("reportSubmittedDesc")}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("Home")}>
              <Text style={styles.primaryBtnText}>{i18n.t("returnToHome")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.primary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 48 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.headerBg,
  },
  backBtn: { marginRight: 16, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: theme.colors.headerText },
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, paddingBottom: 40 },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  stepDot: { width: 40, height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
  stepDotActive: { backgroundColor: theme.colors.primary },
  stepContainer: { flex: 1 },
  stepContainerCentered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", color: theme.colors.primary, marginBottom: 24 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    gap: 16,
  },
  optionCardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.cardHighlight },
  optionTextContainer: { flex: 1 },
  optionTitle: { fontSize: 18, fontWeight: "bold", color: theme.colors.text, marginBottom: 4 },
  optionTitleActive: { color: theme.colors.primary },
  optionDesc: { fontSize: 14, color: theme.colors.textMuted },
  primaryBtn: {
    backgroundColor: theme.colors.buttonBg,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    width: "100%",
  },
  primaryBtnDisabled: { backgroundColor: theme.colors.border },
  primaryBtnText: { color: theme.colors.buttonText, fontSize: 18, fontWeight: "bold" },
  ruleCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.cardHighlight,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  ruleText: { flex: 1, color: theme.colors.primary, fontSize: 14, fontWeight: "500", lineHeight: 20 },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
    backgroundColor: theme.colors.card,      
  },
  alertMarker: {
    backgroundColor: theme.colors.error,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mapOverlayBlock: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: theme.isDark ? "rgba(12, 16, 33, 0.85)" : "rgba(255, 255, 255, 0.9)",
    padding: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  mapOverlayText: {  
    fontSize: 14, 
    fontWeight: "bold", 
    color: theme.colors.text,
    textAlign: "center"
  },
  fieldLabel: { fontSize: 16, fontWeight: "600", color: theme.colors.text, marginBottom: 8, marginTop: 16 },
  typesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  typeBadge: {
    backgroundColor: theme.colors.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeBadgeActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  typeText: { fontSize: 15, color: theme.colors.text, fontWeight: "500" },
  typeTextActive: { color: theme.colors.buttonText },
  mediaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  recordingBtn: { backgroundColor: theme.colors.error, borderColor: theme.colors.error, borderStyle: "solid" },
  mediaBtnText: { fontSize: 16, fontWeight: "600", color: theme.colors.primary },
  recordingBtnText: { color: theme.colors.buttonText },
  mediaSuccess: { color: theme.colors.success, fontSize: 14, marginTop: 8, textAlign: "center", fontWeight: "500" },
  previewImage: { width: "100%", height: 200, borderRadius: 12, marginTop: 16 },
  descCentered: { fontSize: 16, color: theme.colors.text, textAlign: "center", marginBottom: 32, lineHeight: 24 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: theme.colors.inputBg ?? (theme.isDark ? "#0c1021" : "#f8fafc"),
    color: theme.colors.text,
  },
  textArea: {
    minHeight: 100,
    backgroundColor: theme.colors.card,
  },
  videoSuccessBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    backgroundColor: theme.isDark ? "rgba(16, 185, 129, 0.1)" : "#ecfdf5",
    padding: 10,
    borderRadius: 8,
  },
  videoSuccessText: {
    fontSize: 13,
    color: theme.colors.success,
    fontWeight: "500",
  },
  severityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 20,
    marginTop: 4,
  },
  severityChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    gap: 2,
  },
  severityChipNum: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.textMuted,
  },
  severityChipLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  severityChipTextActive: {
    color: "#ffffff",
  },
});