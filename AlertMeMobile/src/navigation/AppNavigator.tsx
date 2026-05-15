import { createStackNavigator } from "@react-navigation/stack";
import React from "react";
import AmbulanceTrackingScreen from "../screens/AmbulanceTrackingScreen";
import EmergencyActiveScreen from "../screens/EmergencyActiveScreen";
import EmergencyContactsScreen from "../screens/EmergencyContactsScreen";
import HomeScreen from "../screens/HomeScreen";
import IncidentHistoryScreen from "../screens/IncidentHistoryScreen";
import LoginOTPScreen from "../screens/LoginOTPScreen";
import EmergencyProfileSetupScreen from "../screens/EmergencyProfileSetupScreen";
import OfflinePendingAlertsScreen from "../screens/OfflinePendingAlertsScreen";
import PermissionsScreen from "../screens/PermissionsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ReportAccidentScreen from "../screens/ReportAccidentScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SOSProgressScreen from "../screens/SOSProgressScreen";
import SOSScreen from "../screens/SOSScreen";
import SOSSuccessScreen from "../screens/SOSSuccessScreen";
import SplashScreen from "../screens/SplashScreen";

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="Login" component={LoginOTPScreen} />
      <Stack.Screen name="ProfileSetup" component={EmergencyProfileSetupScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="SOS" component={SOSScreen} />
      <Stack.Screen name="Report" component={ReportAccidentScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Contacts" component={EmergencyContactsScreen} />
      <Stack.Screen name="Tracking" component={AmbulanceTrackingScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="OfflineAlerts" component={OfflinePendingAlertsScreen} />
      <Stack.Screen name="SOSProgress" component={SOSProgressScreen} />
      <Stack.Screen name="SOSSuccess" component={SOSSuccessScreen} />
      <Stack.Screen name="EmergencyActive" component={EmergencyActiveScreen} />
      <Stack.Screen name="History" component={IncidentHistoryScreen} />
    </Stack.Navigator>
  );
}
