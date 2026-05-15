import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState, useRef } from "react";
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import { getCurrentLocation } from "../utils/location";
import { saveOfflineAlert } from "../utils/offlineStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../services/apiClient";

export default function SOSScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<any>(null);
  const isCanceledRef = useRef(false);
  const locationCacheRef = useRef<any>(null);

  useEffect(() => {
    // Pre-fetch location DURING the countdown so we don't stall at 0!
    getCurrentLocation().then(loc => {
        locationCacheRef.current = loc;
    }).catch(e => console.log("Pre-fetch GPS failed", e));

    // Start countdown
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (!isCanceledRef.current) {
            triggerSOS();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const triggerSOS = async () => {
    try {
      const location = locationCacheRef.current || await getCurrentLocation();
      const sessionString = await AsyncStorage.getItem("userToken");
      let reporterId = "EMERGENCY_SOS";
      if (sessionString) {
          const session = JSON.parse(sessionString);
          reporterId = session.userId || "EMERGENCY_SOS";
      }

      const lat = location?.latitude || 6.9271;
      const lng = location?.longitude || 79.8612;
      const gpsAddress = `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;

      const incidentPayload = {
        reporterId: reporterId,
        type: "MEDICAL",
        severityScore: 5,
        latitude: lat,
        longitude: lng,
        approximateAddress: gpsAddress
      };

      try {
        const response = await apiClient.post("/incidents", incidentPayload);
        // Backend returns 'incidentId' (UUID field) — not 'id'
        const newIncidentId = response.data?.incidentId || response.data?.id;
        navigation.replace("SOSProgress", { 
          incidentId: newIncidentId,
          location: { latitude: lat, longitude: lng },
          address: gpsAddress
        });
      } catch (e: any) {
        console.warn("SOS Live Ping failed over network, saving for offline sync", e);
        // Save for offline sync since network failed
        await saveOfflineAlert({
          isSOS: true,
          incidentPayload: incidentPayload,
          category: "SOS Emergency",
          time: new Date().toISOString(),
        });
        navigation.replace("SOSProgress", { 
          incidentId: "OFFLINE",
          location: { latitude: lat, longitude: lng },
          address: `${gpsAddress} (Offline)`
        });
      }
    } catch (error: any) {
      console.log("Failed to send SOS", error);
      Alert.alert("GPS Error", "Could not get location. Ensure GPS is given permission.");
    }
  };

  const handleCancel = () => {
    isCanceledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.countdownNumber}>{countdown}</Text>
          </View>

          <Text style={styles.title}>{i18n.t("sosActivatedTitle")}</Text>
          <Text style={styles.subtitle}>
            {countdown > 0 
              ? `Sending in ${countdown} seconds...` 
              : "Connecting with rescue services..."}
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>{i18n.t("sosInfoNotified")}</Text>
            <Text style={styles.infoText}>{i18n.t("sosInfoAlerted")}</Text>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.8}>
            <Text style={styles.cancelButtonText}>{i18n.t("cancelAlert")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.error,
    paddingTop: Platform.OS === "android" ? 25 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.error,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    borderColor: "rgba(255, 255, 255, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  countdownNumber: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#ffffff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#ffffff",
    marginBottom: 40,
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    width: "100%",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  infoText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 8,
  },
  cancelButton: {
    backgroundColor: "#ffffff",
    width: "100%",
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 32,
  },
  cancelButtonText: {
    color: theme.colors.error,
    fontSize: 16,
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  dotActive: {
    backgroundColor: "#ffffff",
  },
});