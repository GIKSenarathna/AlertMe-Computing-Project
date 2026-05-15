import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import apiClient from "../services/apiClient";
import { db } from "../services/firebaseConfig";
import { ref, set, onDisconnect } from "firebase/database";

export default function EmergencyActiveScreen({ navigation }: any) {
    const { theme } = useTheme();
    const { locale } = useLanguage();
    const styles = getStyles(theme);
    const [isStreaming, setIsStreaming] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(new Date().toLocaleTimeString());

    // Live data state
    const [incidentId, setIncidentId] = React.useState<string | null>(null);
    const [dispatchStatus, setDispatchStatus] = React.useState<string>('PENDING');
    const [etaText, setEtaText] = React.useState<string>('--');
    const [gpsCoords, setGpsCoords] = React.useState<string>('Locating...');

    const toggleStream = async () => {
        const newState = !isStreaming;
        setIsStreaming(newState);
        
        if (incidentId) {
            try {
                const streamRef = ref(db, `tactical_streams/${incidentId}`);
                const payload = newState 
                    ? { active: true, timestamp: Date.now() }
                    : { active: false };
                await set(streamRef, payload);
                if (newState) {
                    onDisconnect(streamRef).set({ active: false });
                }
                console.log(`[STREAM] Firebase write SUCCESS → tactical_streams/${incidentId}`, payload);
            } catch (err: any) {
                console.error(`[STREAM] Firebase write FAILED → tactical_streams/${incidentId}:`, err?.message || err);
            }
        } else {
            console.warn("[STREAM] No incidentId available — cannot write to Firebase RTDB");
        }
    };

    // Clock
    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Simulation refs: track simulated ambulance GPS during EN_ROUTE and TRANSPORTING phases
    const simulatedAmbPosRef = React.useRef<{lat: number, lng: number} | null>(null);
    const simulatedEnRoutePosRef = React.useRef<{lat: number, lng: number} | null>(null);

    // Live data fetch
    React.useEffect(() => {
        // Unified ETA constants — must match AmbulanceManagement.jsx, IncidentDetail.jsx, AmbulanceTrackingScreen.tsx
        const ROAD_FACTOR = 1.3;
        const AVG_SPEED_KMH = 45;

        const roadDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2
                + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
                * Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * ROAD_FACTOR;
        };

        const minsFromKm = (km: number) => Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60));

        const fetchLiveData = async () => {
            try {
                const session = await AsyncStorage.getItem("userToken");
                if (!session) return;
                const userData = JSON.parse(session);

                // Get active incident
                const incidents = await apiClient.get(`/incidents/reporter/${userData.userId}`);
                const active = (incidents.data || []).find((i: any) => i.status !== 'RESOLVED');
                if (!active) return;

                setIncidentId(active.incidentId);

                // Show real GPS
                if (active.location?.latitude && active.location?.longitude) {
                    setGpsCoords(`${active.location.latitude.toFixed(4)}° N, ${active.location.longitude.toFixed(4)}° E`);
                }

                // Get dispatch log for this incident
                const dispatchRes = await apiClient.get(`/dispatch-logs/incident/${active.incidentId}`);
                const logs = dispatchRes.data || [];
                const dispatch = logs.find((l: any) =>
                    ['ASSIGNED', 'EN_ROUTE', 'DISPATCHED', 'ARRIVED', 'ON_SCENE', 'TRANSPORTING'].includes(l.status)
                );

                if (dispatch) {
                    // Check if already arrived at hospital (set by Tracking screen)
                    const arrivedKey = `arr_hospital_${active.incidentId}`;
                    const storedArrived = await AsyncStorage.getItem(arrivedKey);

                    if (storedArrived) {
                        setDispatchStatus('ARRIVED_AT_HOSPITAL');
                        setEtaText('0 min');
                    } else {
                        setDispatchStatus(dispatch.status);

                        const incLat = active.location?.latitude;
                        const incLng = active.location?.longitude;
                        const amb = dispatch.ambulance;
                        const ambLat = amb?.currentLocation?.latitude;
                        const ambLng = amb?.currentLocation?.longitude;

                        if (dispatch.status === 'ARRIVED' || dispatch.status === 'ON_SCENE') {
                            setEtaText('0 min');
                            // Reset EN_ROUTE simulation when arrived
                            simulatedEnRoutePosRef.current = null;
                        } else if (dispatch.status === 'TRANSPORTING' && dispatch.destinationHospitalLat) {
                            // ── Simulation: drive toward hospital from incident scene ──
                            const hospLat = dispatch.destinationHospitalLat;
                            const hospLng = dispatch.destinationHospitalLng;

                            // Seed simulated position at incident scene if not yet started
                            if (!simulatedAmbPosRef.current) {
                                simulatedAmbPosRef.current = {
                                    lat: incLat ?? ambLat ?? hospLat,
                                    lng: incLng ?? ambLng ?? hospLng,
                                };
                            }

                            let { lat: curLat, lng: curLng } = simulatedAmbPosRef.current;

                            // Step toward hospital (0.008 degrees ≈ 880m per tick — same as Tracking screen)
                            const latDiff = Math.abs(hospLat - curLat);
                            const lngDiff = Math.abs(hospLng - curLng);
                            const nearHospital = latDiff < 0.012 && lngDiff < 0.012;

                            if (!nearHospital) {
                                curLat += hospLat > curLat ? 0.008 : -0.008;
                                curLng += hospLng > curLng ? 0.008 : -0.008;
                                simulatedAmbPosRef.current = { lat: curLat, lng: curLng };
                            }

                            const dist = roadDistanceKm(curLat, curLng, hospLat, hospLng);
                            if (nearHospital || dist < 1.5) {
                                setEtaText('0 min');
                                setDispatchStatus('ARRIVED_AT_HOSPITAL');
                            } else {
                                setEtaText(`${minsFromKm(dist)} min`);
                            }
                        } else if (ambLat && incLat) {
                            // EN_ROUTE: simulate movement from station toward incident so ETA counts down
                            if (!simulatedEnRoutePosRef.current) {
                                simulatedEnRoutePosRef.current = { lat: ambLat, lng: ambLng };
                            }
                            let { lat: curLat, lng: curLng } = simulatedEnRoutePosRef.current;
                            const latDiff = Math.abs(incLat - curLat);
                            const lngDiff = Math.abs(incLng - curLng);
                            if (latDiff > 0.012 || lngDiff > 0.012) {
                                curLat += incLat > curLat ? 0.008 : -0.008;
                                curLng += incLng > curLng ? 0.008 : -0.008;
                                simulatedEnRoutePosRef.current = { lat: curLat, lng: curLng };
                            }
                            const dist = roadDistanceKm(curLat, curLng, incLat, incLng);
                            setEtaText(`${minsFromKm(dist)} min`);
                        } else if (dispatch.estimatedEtaSeconds && dispatch.estimatedEtaSeconds > 0) {
                            const mins = Math.max(1, Math.round(dispatch.estimatedEtaSeconds / 60));
                            setEtaText(`${mins} min`);
                        }
                    } // close else block for storedArrived
                } else {
                    // No ambulance dispatched yet — show honest status
                    setDispatchStatus('PENDING');
                    setEtaText('--');
                }
            } catch (e) {
                // Silently fail — keeps showing last known data
            }
        };

        fetchLiveData();
        const id = setInterval(fetchLiveData, 8000);
        return () => clearInterval(id);
    }, []);


    // Display-friendly status label
    const statusLabel = () => {
        if (dispatchStatus === 'PENDING') return 'Awaiting Dispatch';
        if (dispatchStatus === 'ASSIGNED' || dispatchStatus === 'DISPATCHED') return 'Dispatched';
        if (dispatchStatus === 'ARRIVED_AT_HOSPITAL') return 'Arrived at Hospital';
        if (dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE') return 'On Scene';
        if (dispatchStatus === 'TRANSPORTING') return 'Transporting Patient';
        return i18n.t('enRoute', { locale }); // EN_ROUTE
    };
    const statusColor = () => {
        if (dispatchStatus === 'PENDING') return '#64748b';
        if (dispatchStatus === 'ASSIGNED' || dispatchStatus === 'DISPATCHED') return '#f59e0b'; // amber
        if (dispatchStatus === 'ARRIVED_AT_HOSPITAL') return '#1565c0';
        if (dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE') return '#1565c0';
        if (dispatchStatus === 'TRANSPORTING') return '#e67e22';
        return theme.colors.error;
    };
    const [simulatingAction, setSimulatingAction] = React.useState<string | null>(null);
    const simulationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerSimulation = async (action: string) => {
        // Tapping the same button again cancels it
        if (simulatingAction === action) {
            setSimulatingAction(null);
            if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
            return;
        }
        // Cancel any running simulation first
        if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
        setSimulatingAction(action);

        // Sync with dashboard via Firebase
        if (incidentId) {
            try {
                const commsRef = ref(db, `tactical_comms/${incidentId}`);
                await set(commsRef, { active: true, action: action, timestamp: Date.now() });
                setTimeout(() => set(commsRef, { active: false, action: null }), 5000);
            } catch (err) {
                console.log("Failed to sync comms:", err);
            }
        }

        simulationTimerRef.current = setTimeout(() => {
            setSimulatingAction(null);
        }, 3000);
    };

    return (
        <SafeAreaView style={styles.safeArea}>

            {/* Top Banner - SOS ACTIVE */}
            <View style={styles.banner}>
                <View style={styles.bannerRow}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.bannerTitle}>{i18n.t("emergencyActive", { locale })}</Text>
                </View>
                <Text style={styles.bannerSubtitle}>{i18n.t("helpOnTheWay", { locale })}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* 📹 TACTICAL VIDEO FEED SECTION */}
                <View style={styles.videoCard}>
                    <View style={styles.videoHeader}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="videocam" size={20} color="#fff" />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.videoTitle}>{i18n.t("tacticalVideo", { locale })}</Text>
                            <Text style={styles.videoSubtitle}>{i18n.t("tacticalVideoDesc", { locale })}</Text>
                        </View>
                        <View style={styles.prototypeBadge}>
                            <Text style={styles.prototypeText}>PROTOTYPE MODE</Text>
                        </View>
                    </View>
                    <Text style={styles.prototypeDesc}>WebRTC Stream Simulation</Text>

                    <View style={styles.videoPreview}>
                        {isStreaming ? (
                            <View style={styles.streamingOverlay}>
                                <View style={styles.hudBrackets}>
                                    <View style={[styles.bracket, styles.topL]} />
                                    <View style={[styles.bracket, styles.topR]} />
                                    <View style={[styles.bracket, styles.botL]} />
                                    <View style={[styles.bracket, styles.botR]} />
                                </View>
                                <View style={styles.liveTag}>
                                    <View style={styles.redDotPulse} />
                                    <Text style={styles.liveTagText}>LIVE - HQ CONNECTED</Text>
                                </View>
                                <Text style={styles.hudClock}>{currentTime}</Text>
                                <Text style={styles.hudGps}>GPS: {gpsCoords}</Text>
                            </View>
                        ) : (
                            <View style={styles.videoPlaceholder}>
                                <Ionicons name="videocam-off-outline" size={48} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.placeholderText}>{i18n.t("cameraReady", { locale })}</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity 
                        style={[styles.streamBtn, isStreaming && styles.streamBtnActive]}
                        onPress={toggleStream}
                    >
                        <Ionicons 
                            name={isStreaming ? "square" : "radio-outline"} 
                            size={18} 
                            color="#fff" 
                        />
                        <Text style={styles.streamBtnText}>
                            {isStreaming ? i18n.t("stopTacticalStream", { locale }) : i18n.t("startTacticalStream", { locale })}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* 💬 QUICK COMMS SECTION */}
                <View style={styles.commsCard}>
                    <Text style={styles.sectionHeader}>{i18n.t("authorityComms", { locale })}</Text>
                    <View style={styles.commsGrid}>
                        <TouchableOpacity
                            style={[styles.commTile, simulatingAction === 'chat' && styles.commTileActive]}
                            onPress={() => triggerSimulation('chat')}
                        >
                            <View style={[styles.commIconWrap, {backgroundColor: '#1e293b'}]}>
                                {simulatingAction === 'chat'
                                    ? <ActivityIndicator size="small" color="#3b82f6" />
                                    : <Ionicons name="chatbubble-ellipses" size={24} color="#3b82f6" />}
                            </View>
                            <Text style={styles.commLabel}>
                                {simulatingAction === 'chat' ? 'Tap to Cancel' : i18n.t("startChat", { locale })}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.commTile, simulatingAction === 'call' && styles.commTileActive]}
                            onPress={() => triggerSimulation('call')}
                        >
                            <View style={[styles.commIconWrap, {backgroundColor: '#1e293b'}]}>
                                {simulatingAction === 'call'
                                    ? <ActivityIndicator size="small" color="#10b981" />
                                    : <Ionicons name="call" size={24} color="#10b981" />}
                            </View>
                            <Text style={styles.commLabel}>
                                {simulatingAction === 'call' ? 'Tap to Cancel' : i18n.t("callResponder", { locale })}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* STATUS & INFO SECTION — live data */}
                <View style={styles.statusBox}>
                    <Text style={styles.statusLabel}>{i18n.t("ambulanceStatus", { locale })}</Text>
                    <Text style={[styles.statusValueBlue, { color: statusColor() }]}>{statusLabel()}</Text>
                </View>

                <View style={styles.statusBox}>
                    <Text style={styles.statusLabel}>{i18n.t("estimatedArrival", { locale })}</Text>
                    <Text style={styles.statusValueDark}>{etaText}</Text>
                </View>

                <View style={styles.statusBox}>
                    <Text style={styles.statusLabel}>{i18n.t("emergencyId", { locale })}</Text>
                    <Text style={styles.statusValueRed}>
                        {incidentId ? `EMG-${incidentId.split('-')[0].toUpperCase()}` : 'Loading...'}
                    </Text>
                </View>

                {/* Stay Safe Card */}
                <View style={styles.warningCard}>
                    <View style={styles.warningHeader}>
                        <Ionicons name="alert-circle-outline" size={22} color="#e65100" />
                        <Text style={styles.warningTitle}>{i18n.t("staySafe", { locale })}</Text>
                    </View>
                    <Text style={styles.warningText}>
                        {i18n.t("staySafeDesc", { locale })}
                    </Text>
                </View>

                {/* Actions */}
                <View style={styles.actionsBox}>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("Tracking", { source: 'emergency' })}>
                        <Ionicons name="navigate-outline" size={20} color="#fff" />
                        <Text style={styles.primaryBtnText}>{i18n.t("trackAmbulanceLive", { locale })}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate("Home")}>
                        <Text style={styles.outlineBtnText}>{i18n.t("backToHome", { locale })}</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const getStyles = (theme: any) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    banner: {
        backgroundColor: theme.colors.error,
        paddingTop: Platform.OS === "android" ? 40 : 10,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    bannerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 4,
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#fff",
        opacity: 0.8,
    },
    bannerTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "bold",
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    bannerSubtitle: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 13,
        marginLeft: 22,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 60,
    },
    
    // 📹 VIDEO CARD STYLES
    videoCard: {
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
    },
    videoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.colors.error,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    videoSubtitle: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },
    videoPreview: {
        height: 180,
        backgroundColor: '#000',
        borderRadius: 12,
        marginBottom: 16,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    videoPlaceholder: {
        alignItems: 'center',
        gap: 8,
    },
    placeholderText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        fontWeight: '600',
    },
    streamingOverlay: {
        ...StyleSheet.absoluteFillObject,
        padding: 12,
        justifyContent: 'space-between',
    },
    hudBrackets: {
        ...StyleSheet.absoluteFillObject,
    },
    bracket: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    topL: { top: 10, left: 10, borderLeftWidth: 2, borderTopWidth: 2 },
    topR: { top: 10, right: 10, borderRightWidth: 2, borderTopWidth: 2 },
    botL: { bottom: 10, left: 10, borderLeftWidth: 2, borderBottomWidth: 2 },
    botR: { bottom: 10, right: 10, borderRightWidth: 2, borderBottomWidth: 2 },
    
    liveTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(211, 47, 47, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    liveTagText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    redDotPulse: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
    },
    simulationOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        zIndex: 1000,
        justifyContent: "center",
        alignItems: "center",
    },
    simulationText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "bold",
        marginTop: 16,
    },
    hudClock: {
        position: 'absolute',
        top: 12,
        right: 12,
        color: '#fff',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    hudGps: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        alignSelf: 'center',
    },
    streamBtn: {
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    streamBtnActive: {
        backgroundColor: theme.colors.error,
    },
    streamBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    prototypeBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.5)',
    },
    prototypeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#f59e0b',
    },
    prototypeDesc: {
        fontSize: 10,
        color: '#f59e0b',
        fontStyle: 'italic',
        marginTop: 4,
        marginLeft: 48,
    },

    // 💬 COMMS CARD STYLES
    commsCard: {
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    commsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    commTile: {
        flex: 1,
        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    commTileActive: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.isDark ? 'rgba(211,47,47,0.08)' : '#fff5f5',
    },
    commIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    commLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text,
    },

    statusBox: {
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    statusLabel: {
        fontSize: 13,
        color: theme.colors.textMuted,
        marginBottom: 4,
    },
    statusValueBlue: {
        fontSize: 18,
        fontWeight: "600",
        color: theme.colors.primary,
    },
    statusValueDark: {
        fontSize: 18,
        fontWeight: "600",
        color: theme.colors.text,
    },
    statusValueRed: {
        fontSize: 18,
        fontWeight: "600",
        color: theme.colors.error,
    },
    actionsBox: {
        marginTop: 12,
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
    outlineBtn: {
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    outlineBtnText: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: "600",
    },
    warningCard: {
        backgroundColor: theme.isDark ? "rgba(230, 81, 0, 0.1)" : "#fff8e1",
        borderWidth: 1,
        borderColor: theme.isDark ? "rgba(230, 81, 0, 0.3)" : "#ffe0b2",
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    warningHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
        gap: 10,
    },
    warningTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#e65100",
    },
    warningText: {
        fontSize: 14,
        color: "#e65100",
        lineHeight: 20,
        marginLeft: 32,
    },
});
