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
  Keyboard,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import apiClient from "../services/apiClient";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../services/firebaseConfig";

export default function LoginOTPScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { locale, setLocale } = useLanguage();
  const styles = getStyles(theme);

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  React.useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // @ts-ignore
  const recaptchaVerifier = React.useRef<FirebaseRecaptchaVerifierModal>(null);
  const isSinhala = locale === "si";

  const validatePhone = (num: string) => {
    // Sri Lankan mobile numbers without the leading 0: 7XXXXXXXX (9 digits)
    const cleaned = num.replace(/\s/g, "");
    return /^7[0-9]{8}$/.test(cleaned);
  };

  const sendOTP = async () => {
    const cleaned = phone.trim();
    const fullPhone = `+94${cleaned}`;

    if (!validatePhone(cleaned)) {
      setPhoneError(isSinhala ? "වලංගු නොවන දුරකථන අංකයකි" : "❌ Invalid phone number. Use format: 7XXXXXXXX");
      return;
    }

    setPhoneError("");
    setSendingOtp(true);

    try {
      const phoneProvider = new PhoneAuthProvider(auth);
      const vid = await phoneProvider.verifyPhoneNumber(
        fullPhone,
        recaptchaVerifier.current!
      );
      setVerificationId(vid);
      setSendingOtp(false);
      setStep("otp");
    } catch (err: any) {
      setSendingOtp(false);
      setPhoneError(err.message || "Failed to send OTP. Try again.");
      console.error("Firebase Login Error:", err);
    }
  };

  const verifyOTP = async (currentOtp?: string) => {
    const otpToVerify = typeof currentOtp === 'string' ? currentOtp : otp;
    if (otpToVerify.length < 6) {
      setOtpError("❌ Please enter the 6-digit OTP code.");
      return;
    }
    setOtpError("");
    setVerifying(true);

    try {
      // 1. Authenticate with Firebase on the device
      const credential = PhoneAuthProvider.credential(verificationId, otpToVerify);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      // 2. Get the Firebase ID Token
      const idToken = await firebaseUser.getIdToken();

      // 3. Send ID Token to our Spring Boot backend for verification/session creation
      const response = await apiClient.post("/auth/login", {
        idToken: idToken
      });

      const { token, role, userId, name } = response.data;

      // 4. Cache tokens for persistent sessions
      await AsyncStorage.setItem("firebaseIdToken", idToken);

      const sessionData = JSON.stringify({
        phone: phone.trim(),
        role: role,
        userId: userId,
        name: name,
        token: idToken, // Using Firebase ID Token as the primary bearer token now
        loginTime: new Date().toISOString()
      });
      await AsyncStorage.setItem("userToken", sessionData);

      setVerifying(false);

      // Route to home or profile setup
      const savedProfile = await AsyncStorage.getItem("userProfile");
      const profile = savedProfile ? JSON.parse(savedProfile) : null;
      if (profile?.setupComplete) {
        navigation.replace("Home");
      } else {
        navigation.replace("ProfileSetup");
      }
    } catch (e: any) {
      setVerifying(false);
      setOtpError(e.message || "Invalid OTP or registration failed.");
      console.warn("Firebase Verification Blocked:", e);
    }
  };

  const setLanguage = (lang: "en" | "si") => {
    setLocale(lang);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        {/* Branding Icon */}
        <View style={styles.logoContainer}>
          <Ionicons name="shield-checkmark" size={48} color={theme.colors.headerText} />
        </View>
        <Text style={styles.headerTitle}>{i18n.t("loginTitle")}</Text>
        <Text style={styles.headerSubtitle}>{i18n.t("loginSubtitle")}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardVisible ? 150 : 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Language Selection Row */}
        <View style={styles.languageRow}>
          <TouchableOpacity
            style={[styles.langBtn, !isSinhala && styles.langBtnActive]}
            onPress={() => setLanguage("en")}
            activeOpacity={0.8}
          >
            <Text style={[styles.langBtnText, !isSinhala && styles.langBtnTextActive]}>
              English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, isSinhala && styles.langBtnActive]}
            onPress={() => setLanguage("si")}
            activeOpacity={0.8}
          >
            <Text style={[styles.langBtnText, isSinhala && styles.langBtnTextActive]}>
              සිංහල
            </Text>
          </TouchableOpacity>
        </View>

        {step === "phone" ? (
          <View style={styles.card}>
            {/* @ts-ignore - Prop type mismatch between Firebase SDK v11 and Expo types */}
            <FirebaseRecaptchaVerifierModal
              ref={recaptchaVerifier}
              firebaseConfig={auth.app.options}
              attemptInvisibleVerification={true}
            />
            <View style={styles.inputHeader}>
              <Ionicons name="call-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>{i18n.t("phoneNumber")}</Text>
            </View>
            <Text style={styles.cardDesc}>
              {isSinhala ? "ඔබේ දුරකථන අංකය ඇතුළත් කරන්න" : "Please enter your mobile number to receive an OTP"}
            </Text>

            {/* Country Code + Phone Input Row */}
            <View style={[styles.phoneRow, phoneError ? styles.inputErrorOutline : {}]}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.flagText}>🇱🇰</Text>
                <Text style={styles.countryCode}>+94</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="7XXXXXXXX"
                placeholderTextColor={theme.colors.textMuted}
                value={phone}
                onChangeText={(t) => { 
                  let val = t.replace(/\s/g, "");
                  if (val.startsWith("0")) {
                    val = val.substring(1);
                  }
                  setPhone(val); 
                  setPhoneError(""); 
                }}
                keyboardType="phone-pad"
                maxLength={9}
              />
            </View>

            {/* Validation Error */}
            {phoneError ? (
              <View style={styles.errorBox}>
                <Ionicons name="close-circle" size={14} color={theme.colors.error} />
                <Text style={styles.errorText}>{phoneError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, (phone.trim().length !== 9 || sendingOtp) && styles.primaryBtnDisabled]}
              onPress={sendOTP}
              disabled={phone.trim().length !== 9 || sendingOtp}
            >
              {sendingOtp ? (
                <>
                  <ActivityIndicator size="small" color={theme.colors.buttonText} />
                  <Text style={styles.primaryBtnText}>
                    {isSinhala ? "OTP එවමින්..." : "Sending OTP..."}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>{i18n.t("sendOtp")}</Text>
                  <Ionicons name="arrow-forward" size={20} color={theme.colors.buttonText} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.inputHeader}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>{i18n.t("enterOtp")}</Text>
            </View>
            <Text style={styles.cardDesc}>
              {i18n.t("otpSentTo")} <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>+94 {phone}</Text>
            </Text>
            <TextInput
              style={[styles.input, otpError ? styles.inputErrorBorder : {}]}
              placeholder="0 0 0 0 0 0"
              placeholderTextColor={theme.colors.textMuted}
              value={otp}
              onChangeText={(t) => { 
                setOtp(t); 
                setOtpError(""); 
                if (t.length === 6) {
                  verifyOTP(t);
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              onSubmitEditing={() => verifyOTP()}
              returnKeyType="done"
            />

            {/* OTP Error */}
            {otpError ? (
              <View style={styles.errorBox}>
                <Ionicons name="close-circle" size={14} color={theme.colors.error} />
                <Text style={styles.errorText}>{otpError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, (otp.length < 6 || verifying) && styles.primaryBtnDisabled]}
              onPress={() => verifyOTP()}
              disabled={otp.length < 6 || verifying}
            >
              {verifying ? (
                <>
                  <ActivityIndicator size="small" color={theme.colors.buttonText} />
                  <Text style={styles.primaryBtnText}>
                    {isSinhala ? "තහවුරු කරමින්..." : "Verifying..."}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>{i18n.t("verify")}</Text>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.buttonText} />
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.backToPhone} onPress={() => setStep("phone")}>
              <Text style={styles.backToPhoneText}>{i18n.t("changeNumber")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    backgroundColor: theme.colors.headerBg,
    paddingTop: Platform.OS === "android" ? 64 : 72,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.headerText,
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 22,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 32 },
  languageRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  langBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  langBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  langBtnTextActive: {
    color: theme.colors.buttonText,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: theme.colors.primary },
  cardDesc: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 20, lineHeight: 20 },

  // Country code row
  phoneRow: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: theme.colors.inputBg ?? (theme.isDark ? "#0c1021" : "#f8fafc"),
  },
  inputErrorOutline: {
    borderColor: theme.colors.error,
  },
  countryCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    gap: 6,
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
  },
  flagText: { fontSize: 18 },
  countryCode: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: "500",
  },

  // OTP input
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 18,
    backgroundColor: theme.colors.inputBg ?? (theme.isDark ? "#0c1021" : "#f8fafc"),
    color: theme.colors.text,
    marginBottom: 8,
    fontWeight: "500",
  },
  inputErrorBorder: {
    borderColor: theme.colors.error,
  },

  // Error box
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.isDark ? "rgba(229,57,53,0.1)" : "#fef2f2",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.isDark ? "rgba(229,57,53,0.3)" : "#fecaca",
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.error,
    flex: 1,
  },

  primaryBtn: {
    backgroundColor: theme.colors.buttonBg,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: theme.colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: { color: theme.colors.buttonText, fontSize: 16, fontWeight: "bold", letterSpacing: 0.5 },
  backToPhone: { alignSelf: "center", marginTop: 20, padding: 8 },
  backToPhoneText: { color: theme.colors.primary, fontSize: 15, fontWeight: "600" },
});
