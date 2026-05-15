import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";

export default function SOSSuccessScreen({ route, navigation }: any) {
    const { theme } = useTheme();
    const { locale } = useLanguage();
    const styles = getStyles(theme);

    const { incidentId } = route?.params || {};
    const displayId = incidentId && incidentId !== "OFFLINE" ? `EMG-${incidentId.split('-')[0].toUpperCase()}` : 'EMG-PENDING';

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Top Header */}
                <View style={styles.headerBox}>
                    <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={48} color={theme.colors.success} />
                    </View>
                    <Text style={styles.headerTitle}>{i18n.t("alertSentTitle", { locale })}</Text>
                    <Text style={styles.headerSubtitle}>{i18n.t("alertSentSubtitle", { locale })}</Text>
                </View>

                <View style={styles.contentBody}>

                    {/* What happens next Card */}
                    <View style={styles.infoCard}>
                        <Text style={styles.infoCardTitle}>{i18n.t("whatHappensNext", { locale })}</Text>

                        <View style={styles.infoItem}>
                            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.primary} />
                            <Text style={styles.infoItemText}>{i18n.t("nextStep1", { locale })}</Text>
                        </View>

                        <View style={styles.infoItem}>
                            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.primary} />
                            <Text style={styles.infoItemText}>{i18n.t("nextStep2", { locale })}</Text>
                        </View>

                        <View style={styles.infoItem}>
                            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.primary} />
                            <Text style={styles.infoItemText}>{i18n.t("nextStep3", { locale })}</Text>
                        </View>

                        <View style={styles.infoItem}>
                            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.primary} />
                            <Text style={styles.infoItemText}>{i18n.t("nextStep4", { locale })}</Text>
                        </View>
                    </View>

                    {/* Emergency ID Card */}
                    <View style={styles.idCard}>
                        <Text style={styles.idCardTitle}>{i18n.t("emergencyId", { locale })}</Text>
                        <Text style={styles.idText}>{displayId}</Text>
                        <Text style={styles.idCardDesc}>{i18n.t("emergencyIdDesc", { locale })}</Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionsBox}>
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => navigation.navigate("EmergencyActive")}
                        >
                            <Ionicons name="navigate-outline" size={20} color={theme.colors.buttonText} />
                            <Text style={styles.primaryBtnText}>{i18n.t("trackAmbulance", { locale })}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={() => navigation.navigate("Home")}
                        >
                            <Text style={styles.secondaryBtnText}>{i18n.t("backToHome", { locale })}</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = (theme: any) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { flexGrow: 1, paddingBottom: 40 },
    headerBox: {
        backgroundColor: theme.colors.success,
        alignItems: "center",
        paddingTop: Platform.OS === "android" ? 60 : 60,
        paddingBottom: 40,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    checkCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 6,
        borderColor: "rgba(255, 255, 255, 0.2)",
        marginBottom: 20,
    },
    headerTitle: {
        color: "#fff",
        fontSize: 26,
        fontWeight: "bold",
        marginBottom: 8,
        textAlign: "center",
    },
    headerSubtitle: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 16,
        fontWeight: "500",
    },
    contentBody: {
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    infoCard: {
        backgroundColor: theme.colors.cardHighlight,
        borderWidth: 1,
        borderColor: theme.isDark ? "transparent" : "#fecaca",
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    infoCardTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: theme.colors.primary,
        marginBottom: 16,
    },
    infoItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 12,
        gap: 12,
    },
    infoItemText: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.primary,
        lineHeight: 20,
    },
    idCard: {
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    idCardTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: theme.colors.text,
        marginBottom: 8,
    },
    idText: {
        fontSize: 22,
        fontWeight: "bold",
        color: theme.colors.error,
        marginBottom: 12,
    },
    idCardDesc: {
        fontSize: 13,
        color: theme.colors.textMuted,
        lineHeight: 18,
    },
    actionsBox: {
        gap: 12,
    },
    primaryBtn: {
        backgroundColor: theme.colors.buttonBg,
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    primaryBtnText: {
        color: theme.colors.buttonText,
        fontSize: 16,
        fontWeight: "700",
    },
    secondaryBtn: {
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    secondaryBtnText: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: "600",
    },
});
