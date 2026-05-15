import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import { syncAlertsIfOnline } from "../utils/syncService";

export default function OfflinePendingAlertsScreen({ navigation }: any) {
    const { theme } = useTheme();
    const styles = getStyles(theme);

    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const loadAlerts = async () => {
        setLoading(true);
        try {
            const data = await AsyncStorage.getItem("offlineAlerts");
            if (data) {
                setAlerts(JSON.parse(data));
            } else {
                setAlerts([]);
            }
        } catch (e) {
            console.error("Failed to load offline alerts", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlerts();
    }, []);

    const handleManualSync = async () => {
        setSyncing(true);
        await syncAlertsIfOnline();
        await loadAlerts();
        setSyncing(false);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={16} color={theme.colors.headerText} />
                    <Text style={styles.backText}>{i18n.t("back")}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{i18n.t("offlineAlertsTitle")}</Text>
                <Text style={styles.headerSubtitle}>{i18n.t("offlineAlertsSubtitle")}</Text>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
                
                {loading ? (
                    <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
                ) : alerts.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="checkmark-circle-outline" size={48} color={theme.colors.success} />
                        <Text style={styles.emptyText}>All caught up! No offline alerts pending.</Text>
                    </View>
                ) : (
                    alerts.map((alert, index) => (
                        <View key={index} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.statusRow}>
                                    <View style={styles.pendingBadge}>
                                        <Text style={styles.badgeText}>{i18n.t("pending")}</Text>
                                    </View>
                                    <Text style={styles.categoryText}>{alert.category || "General Incident"}</Text>
                                </View>
                                <Ionicons name="wifi-outline" size={20} color={theme.colors.error} style={styles.offlineIcon} />
                            </View>

                            <Text style={styles.alertTitle}>Reported Alert</Text>
                            {alert.description ? (
                                <Text style={styles.alertDesc} numberOfLines={2}>{alert.description}</Text>
                            ) : null}
                            
                            {/* Display actual photo if attached */}
                            {alert.photoUri && (
                                <Image 
                                    source={{ uri: alert.photoUri }} 
                                    style={{ width: "100%", height: 160, borderRadius: 12, marginBottom: 12, marginTop: 4, backgroundColor: theme.colors.cardHighlight }} 
                                    resizeMode="cover"
                                />
                            )}
                            
                            {/* Evidence indicators */}
                            {(alert.videoUri || alert.audioUri) && (
                                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                                    {alert.videoUri && (
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                            <Ionicons name="videocam" size={16} color={theme.colors.primary} />
                                            <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>Video</Text>
                                        </View>
                                    )}
                                    {alert.audioUri && (
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                            <Ionicons name="mic" size={16} color={theme.colors.primary} />
                                            <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>Audio</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                            
                            <View style={styles.timeRow}>
                                <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                                <Text style={styles.timeText}>Saved Locally</Text>
                            </View>

                            <TouchableOpacity 
                                style={[styles.retryBtn, syncing && { opacity: 0.5 }]} 
                                onPress={handleManualSync}
                                disabled={syncing}
                            >
                                {syncing ? (
                                    <ActivityIndicator size="small" color={theme.colors.text} />
                                ) : (
                                    <Ionicons name="sync" size={16} color={theme.colors.text} />
                                )}
                                <Text style={styles.retryBtnText}>{syncing ? "Syncing..." : i18n.t("retrySync")}</Text>
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Info Footer */}
            <View style={styles.footerInfo}>
                <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} style={{ marginTop: 2 }} />
                <Text style={styles.footerText}>
                    {i18n.t("offlineSyncFooter1")} {i18n.t("offlineSyncFooter2")}
                </Text>
            </View>
        </SafeAreaView>
    );
}

const getStyles = (theme: any) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    header: {
        backgroundColor: theme.colors.headerBg,
        paddingTop: Platform.OS === "android" ? 40 : 56,
        paddingBottom: 24,
        paddingHorizontal: 20,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 6 },
    backText: { color: theme.colors.headerText, fontSize: 14, fontWeight: '500' },
    headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.colors.headerText, marginBottom: 6 },
    headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: "500" },
    container: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, padding: 20 },
    emptyText: { fontSize: 16, color: theme.colors.textMuted, marginTop: 12, textAlign: 'center', fontWeight: '500' },
    card: {
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pendingBadge: { backgroundColor: theme.colors.error, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    categoryText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500' },
    offlineIcon: { opacity: 0.8 },
    alertTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 6 },
    alertDesc: { fontSize: 14, color: theme.colors.text, marginBottom: 10 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    timeText: { fontSize: 12, color: theme.colors.textMuted },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 10,
        paddingVertical: 12,
        marginTop: 8,
        gap: 8,
    },
    retryBtnText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
    footerInfo: {
        flexDirection: 'row',
        backgroundColor: theme.colors.cardHighlight,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        alignItems: 'flex-start',
        gap: 12,
    },
    footerText: { flex: 1, fontSize: 13, color: theme.colors.primary, lineHeight: 20 },
});
