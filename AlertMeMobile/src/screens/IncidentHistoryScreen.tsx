import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import apiClient from "../services/apiClient";

export default function IncidentHistoryScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const styles = getStyles(theme);

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const session = await AsyncStorage.getItem("userToken");
        if (!session) {
          setLoading(false);
          return;
        }
        const userData = JSON.parse(session);
        const userId = userData.userId;

        const response = await apiClient.get(`/incidents/reporter/${userId}`);
        
        // Map backend DTO to UI elements
        const mappedHistory = response.data.map((item: any) => {
          let typeKey = "vehicleAccident";
          let icon = "alert-circle-outline";
          if (item.type === "MEDICAL") { typeKey = "medicalEmergency"; icon = "medical-outline"; }
          else if (item.type === "FIRE") { typeKey = "fireAlert"; icon = "flame-outline"; }
          else if (item.type === "ACCIDENT") { typeKey = "vehicleAccident"; icon = "car-outline"; }
          else if (item.type === "SOS") { typeKey = "otherEmergency"; icon = "warning-outline"; }

          let statusKey = "active";
          if (item.status === "RESOLVED") statusKey = "resolved";

          const dateStr = item.reportedAt 
            ? new Date(item.reportedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
            : "Unknown Date";

          return {
            id: item.incidentId,
            typeKey,
            date: dateStr,
            location: item.approximateAddress || "Unknown location",
            statusKey,
            icon,
          };
        });

        // Sort by newest first
        mappedHistory.reverse();

        setHistory(mappedHistory);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const renderItem = ({ item }: any) => (
    <View style={styles.historyCard}>
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + "20" }]}>
        <Ionicons name={item.icon} size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.incidentType}>{i18n.t(item.typeKey, { locale })}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{i18n.t(item.statusKey, { locale })}</Text>
          </View>
        </View>
        <Text style={styles.incidentDate}>{item.date}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.headerText}>{i18n.t("back")}</Text>
      </View>
      
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{i18n.t("incidentHistory")}</Text>
        <Text style={styles.subtitle}>{i18n.t("historySubtitle")}</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.emptyText}>Loading history...</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={64} color={theme.colors.textMuted} />
                <Text style={styles.emptyText}>{i18n.t("noHistory")}</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.headerBg, paddingTop: Platform.OS === "android" ? 40 : 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: theme.colors.headerBg,
  },
  backBtn: { marginRight: 8 },
  headerText: { color: theme.colors.headerText, fontSize: 16, fontWeight: "500" },
  titleContainer: { paddingHorizontal: 20, paddingBottom: 20, backgroundColor: theme.colors.headerBg },
  title: { fontSize: 28, fontWeight: "bold", color: theme.colors.headerText, marginBottom: 4 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  content: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  listContent: { padding: 16 },
  historyCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardInfo: { flex: 1 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  incidentType: { fontSize: 16, fontWeight: "bold", color: theme.colors.text },
  statusBadge: {
    backgroundColor: theme.isDark ? "rgba(76, 175, 80, 0.2)" : "#e8f5e9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: "bold", color: "#2e7d32", textTransform: "uppercase" },
  incidentDate: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 12, color: theme.colors.textMuted, flex: 1 },
  emptyState: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 16, color: theme.colors.textMuted, marginTop: 16 },
});
