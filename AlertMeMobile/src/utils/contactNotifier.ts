import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Alert, ToastAndroid } from "react-native";
import apiClient from "../services/apiClient";

const CONTACTS_KEY = "emergencyContacts";

/**
 * Utility to notify emergency contacts via SMS
 * @param location The current location coordinates { latitude, longitude }
 * @param address Optional address string
 */
export const notifyEmergencyContacts = async (location: { latitude: number, longitude: number }, address?: string) => {
    try {
        console.log("Starting emergency contact notification...", { location, address });
        let saved = await AsyncStorage.getItem(CONTACTS_KEY);
        let contacts = saved ? JSON.parse(saved) : [];

        // Fallback: If no contacts in main list, check for the primary contact from setup
        if (contacts.length === 0) {
            const primary = await AsyncStorage.getItem("primaryEmergencyContact");
            if (primary) {
                const c = JSON.parse(primary);
                contacts = [{
                    id: "primary",
                    name: c.name,
                    phone: c.phone,
                    notifications: true
                }];
                console.log("Using primary emergency contact from setup as fallback.");
            }
        }

        if (contacts.length === 0) {
            console.warn("No emergency contacts found in storage.");
            return;
        }

        const notifyList = contacts.filter((c: any) => c.notifications && c.phone);

        console.log(`Found ${notifyList.length} contacts to notify.`);

        if (notifyList.length === 0) {
            console.warn("No contacts have notifications enabled.");
            return;
        }

        const phoneNumbers = notifyList.map((c: any) => c.phone);
        
        // Ensure we have valid numbers
        const lat = location?.latitude || 6.9271;
        const lng = location?.longitude || 79.8612;
        
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        
        const now = new Date();
        const timeString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        const message = `SOS Alert!\nLocation: ${mapsUrl}\nTime: ${timeString}\nAddress: ${address || "GPS Location"}`;

        console.log("Sending silent SMS via backend...");

        // Call the backend to dispatch the SMS silently
        await apiClient.post("/sms/send", {
            toNumbers: phoneNumbers,
            message: message
        });

        console.log("SMS dispatch request successful.");
        
        if (Platform.OS === 'android') {
            ToastAndroid.show("Emergency contacts notified successfully", ToastAndroid.LONG);
        } else {
            // Unintrusive success feedback for iOS
            setTimeout(() => {
                Alert.alert("Success", "Emergency contacts notified successfully");
            }, 500);
        }

    } catch (error) {
        console.error("Failed to notify emergency contacts via backend:", error);
        Alert.alert("Notification Error", "Failed to send emergency messages automatically.");
    }
};
