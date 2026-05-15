import AsyncStorage from "@react-native-async-storage/async-storage";

export const saveOfflineAlert = async (data: any) => {
  const existing = await AsyncStorage.getItem("offlineAlerts");
  const alerts = existing ? JSON.parse(existing) : [];
  alerts.push(data);
  await AsyncStorage.setItem("offlineAlerts", JSON.stringify(alerts));
};