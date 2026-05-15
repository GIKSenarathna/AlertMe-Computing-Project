import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, SafeAreaView, StyleSheet, Text, View, Alert } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import { notifyEmergencyContacts } from "../utils/contactNotifier";

export default function SOSProgressScreen({ route, navigation }: any) {
    const { theme } = useTheme();
    const { locale } = useLanguage();
    const styles = getStyles(theme);

    const [progress, setProgress] = useState(0);

    const stepKeys = ["sosStep1", "sosStep2", "sosStep3", "sosStep4"];

    useEffect(() => {
        // Animate through the steps
        let currentStep = 0;
        const interval = setInterval(() => {
            currentStep += 1;
            setProgress(currentStep);
            
            // Step 3 is "Emergency contacts notified" (index 2)
            if (currentStep === 2) {
                const { location, address } = route?.params || {};
                if (location) {
                    // Debug Alert to verify coordinates
                    Alert.alert("Location Debug", `Sending coordinates:\nLat: ${location.latitude}\nLng: ${location.longitude}`);
                    notifyEmergencyContacts(location, address);
                }
            }

            if (currentStep >= stepKeys.length) {
                clearInterval(interval);
                // Wait a short moment before navigating to the success screen
                setTimeout(() => {
                    const incidentId = route?.params?.incidentId;
                    navigation.replace("SOSSuccess", { incidentId });
                }, 1000);
            }
        }, 1200);

        return () => clearInterval(interval);
    }, [navigation]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.title}>{i18n.t("sendingAlert", { locale })}</Text>

                <View style={styles.stagesContainer}>
                    {stepKeys.map((key: string, index: number) => {
                        const isCompleted = progress > index;
                        return (
                            <View
                                key={index}
                                style={[
                                    styles.stageCard,
                                    isCompleted ? styles.stageCardCompleted : styles.stageCardPending
                                ]}
                            >
                                <View style={[styles.iconCircle, isCompleted ? styles.iconCircleCompleted : styles.iconCirclePending]}>
                                    {isCompleted && <Ionicons name="checkmark" size={18} color="#fff" />}
                                    {!isCompleted && <Ionicons name="refresh" size={18} color="#fff" />}
                                </View>
                                <Text style={styles.stageText}>{i18n.t(key, { locale })}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        </SafeAreaView>
    );
}

const getStyles = (theme: any) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.colors.error,
        paddingTop: Platform.OS === "android" ? 40 : 20,
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: "center",
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#ffffff",
        marginTop: 60,
        marginBottom: 40,
        textAlign: "center",
    },
    stagesContainer: {
        width: "100%",
        gap: 16,
    },
    stageCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 12,
        gap: 16,
    },
    stageCardCompleted: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    stageCardPending: {
        backgroundColor: "rgba(0, 0, 0, 0.15)",
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    iconCircleCompleted: {
        backgroundColor: theme.colors.success,
    },
    iconCirclePending: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    stageText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
});
