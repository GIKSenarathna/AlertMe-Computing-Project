import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../services/apiClient"; // Assuming apiClient handles the base URL and auth tokens
import { auth } from '../services/firebaseConfig';
import { Platform } from 'react-native';

export const syncAlertsIfOnline = async () => {
  try {
    const state = await Network.getNetworkStateAsync();
    if (!state.isConnected) return;

    // Check if user has enabled Auto Sync
    const autoSyncSetting = await AsyncStorage.getItem("settings_autoSync");
    if (autoSyncSetting !== "true") return;

    const data = await AsyncStorage.getItem("offlineAlerts");
    if (!data) return;

    const alerts: any[] = JSON.parse(data);
    if (alerts.length === 0) return;

    const failedAlerts: any[] = [];
    let hasSuccess = false;

    for (const alert of alerts) {
      try {
        if (alert.isSOS) {
          await apiClient.post("/incidents", alert.incidentPayload);
          hasSuccess = true;
        } else if (alert.isAccidentReport) {
          // 1. Create incident ONLY IF not already created
          let newIncidentId = alert.syncedIncidentId;
          if (!newIncidentId) {
            const response = await apiClient.post("/incidents", alert.incidentPayload);
            newIncidentId = response.data.incidentId;
            alert.syncedIncidentId = newIncidentId; // Save it to avoid duplicate creation if media fails!
          }

          // 2. Upload media using fetch to avoid Axios boundary bugs
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

            let tokenToUse = null;
            if (auth && auth.currentUser) {
              try {
                tokenToUse = await auth.currentUser.getIdToken(true);
              } catch(e) {
                console.warn("syncService token refresh failed", e);
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

          const uploadPromises = [];
          if (alert.accidentDescription && alert.accidentDescription.trim().length > 0) {
            uploadPromises.push(apiClient.post("/evidence/upload", {
              incident: { incidentId: newIncidentId },
              mediaType: "TEXT",
              storageUrl: alert.accidentDescription,
              tacticalLiveFeed: false
            }));
          }
          if (alert.photoUri) uploadPromises.push(uploadFile(alert.photoUri, 'PHOTO'));
          if (alert.videoUri) uploadPromises.push(uploadFile(alert.videoUri, 'VIDEO'));
          if (alert.audioUri) uploadPromises.push(uploadFile(alert.audioUri, 'AUDIO'));

          const uploadResults = await Promise.allSettled(uploadPromises);
          const failedUploads = uploadResults.filter(r => r.status === 'rejected');
          if (failedUploads.length > 0) {
            console.error("Background sync failed uploads:", failedUploads);
            const firstError = (failedUploads[0] as PromiseRejectedResult).reason;
            import('react-native').then(({ Alert }) => {
                Alert.alert("Sync Upload Failed", String(firstError?.message || firstError));
            });
            throw new Error("Media sync failed"); // Force it to catch block so it doesn't delete the offline alert!
          }
          hasSuccess = true;
        } else {
          // legacy or unknown structure
          await apiClient.post("/incidents", alert);
          hasSuccess = true;
        }
      } catch (error) {
        console.warn("Failed to sync an offline alert", error);
        failedAlerts.push(alert);
      }
    }

    // Update local storage with any remaining failed alerts
    if (hasSuccess || failedAlerts.length !== alerts.length) {
      if (failedAlerts.length > 0) {
        await AsyncStorage.setItem("offlineAlerts", JSON.stringify(failedAlerts));
      } else {
        await AsyncStorage.removeItem("offlineAlerts");
      }
    }
  } catch (err) {
    console.error("Error during auto sync:", err);
  }
};