import * as Location from "expo-location";
import MapView, { Marker, Polyline } from 'react-native-maps';
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, ScrollView, Animated, PanResponder, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";
import apiClient from "../services/apiClient";

// Module-level cache — survives screen navigation (component unmount/remount)
let _cachedAmbPos: { lat: number; lng: number } | null = null;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_EXPANDED_Y = SCREEN_HEIGHT * 0.45;  // sheet top at 45% from top
const SHEET_COLLAPSED_Y = SCREEN_HEIGHT * 0.82; // sheet top at 82% (shows only handle + status)

export default function AmbulanceTrackingScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const styles = getStyles(theme);

  // source='emergency' means came from SOS → back to EmergencyActive
  // source='home' or undefined means came from Home menu → back to Home
  const source = route?.params?.source ?? 'home';
  const handleBack = () => {
    if (source === 'emergency') {
      navigation.navigate('EmergencyActive');
    } else {
      navigation.navigate('Home');
    }
  };

  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [ambulanceLocation, setAmbulanceLocation] = useState<{ lat: number, lng: number } | null>(_cachedAmbPos);
  const ambulanceLocationRef = useRef<{ lat: number, lng: number } | null>(_cachedAmbPos);
  const [incidentLocation, setIncidentLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [ambulanceCrew, setAmbulanceCrew] = useState<string>("Standby Crew");
  const [distanceText, setDistanceText] = useState<string>("-- km");
  const [dispatchStatus, setDispatchStatus] = useState<string>('EN_ROUTE');
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [transportingHospital, setTransportingHospital] = useState<{ name: string; address: string } | null>(null);
  const [arrivedAtHospital, setArrivedAtHospital] = useState<boolean>(false);

  // ── Draggable bottom sheet ────────────────────────────────────────────────
  const sheetY = useRef(new Animated.Value(SHEET_EXPANDED_Y)).current;
  const lastY = useRef(SHEET_EXPANDED_Y);
  const isExpanded = useRef(true);

  // snapSheet stored in a ref so PanResponder closure never goes stale
  const snapSheetRef = useRef((toExpanded: boolean) => {});
  snapSheetRef.current = (toExpanded: boolean) => {
    const toValue = toExpanded ? SHEET_EXPANDED_Y : SHEET_COLLAPSED_Y;
    isExpanded.current = toExpanded;
    lastY.current = toValue;
    Animated.spring(sheetY, { toValue, useNativeDriver: false, tension: 65, friction: 11 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        sheetY.setOffset(lastY.current);
        sheetY.setValue(0);
      },
      onPanResponderMove: (_, gs) => {
        const next = lastY.current + gs.dy;
        if (next >= SHEET_EXPANDED_Y && next <= SHEET_COLLAPSED_Y) {
          sheetY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        sheetY.flattenOffset();
        const released = lastY.current + gs.dy;
        const mid = (SHEET_EXPANDED_Y + SHEET_COLLAPSED_Y) / 2;
        snapSheetRef.current(released < mid);
      },
    })
  ).current;

  // Auto-expand when ambulance gets assigned
  const prevVehicleId = useRef<string | null>(null);
  useEffect(() => {
    if (vehicleId && !prevVehicleId.current) { snapSheetRef.current(true); }
    prevVehicleId.current = vehicleId;
  }, [vehicleId]);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let defaultLoc = { lat: 6.9271, lng: 79.8612 };
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          defaultLoc = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        } catch (e) { }
      }
      setUserLocation(defaultLoc);
    })();
  }, []);

  // Poll for ambulance data
  useEffect(() => {
    const arrivedOnSceneRef = { current: false }; // prevents repeated ON_SCENE patches
    let intervalId: ReturnType<typeof setInterval>;

    const fetchLiveTracking = async () => {
      try {
        const session = await AsyncStorage.getItem("userToken");
        if (!session) return;
        const userData = JSON.parse(session);

        // 1. Get active incident
        const incidents = await apiClient.get(`/incidents/reporter/${userData.userId}`);
        const activeIncident = incidents.data.find((i: any) => i.status !== "RESOLVED");

        if (!activeIncident) return; // No active emergency

        // 2. Get dispatch log for this incident
        const dispatches = await apiClient.get(`/dispatch-logs/incident/${activeIncident.incidentId}`);
        if (!dispatches.data || dispatches.data.length === 0) return; // Unassigned

        // Pick the dispatch whose ambulance is currently active (EN_ROUTE / ASSIGNED / ON_SCENE / TRANSPORTING).
        // NOTE: Java serializes LocalDateTime as a number array, so date-based sorting returns NaN and is unreliable.
        const ACTIVE_STATUSES = ['EN_ROUTE', 'ASSIGNED', 'ON_SCENE', 'TRANSPORTING', 'ARRIVED'];
        const activeDispatch =
          dispatches.data.find((d: any) =>
            d.ambulance?.currentStatus && ACTIVE_STATUSES.includes(d.ambulance.currentStatus)
          ) ||
          dispatches.data.find((d: any) =>
            d.status && ACTIVE_STATUSES.includes(d.status)
          ) ||
          dispatches.data[dispatches.data.length - 1]; // absolute fallback: last entry
        const assignedVehicleId = activeDispatch.ambulance?.vehicleId;
        if (!assignedVehicleId) return;
        setVehicleId(assignedVehicleId);

        // Update dispatch status from backend — but NOT if we've already arrived at hospital
        // (backend still says TRANSPORTING, which would cause status to oscillate)
        const backendStatus = activeDispatch.status || 'EN_ROUTE';

        // ── Reload-safe ON_SCENE state (persisted like hospital arrival) ─────
        const onSceneKey = `on_scene_${activeIncident.incidentId}`;
        const storedOnScene = await AsyncStorage.getItem(onSceneKey);
        // Do NOT force position to the scene if we are already TRANSPORTING to the hospital
        if (storedOnScene && !arrivedAtHospital && backendStatus !== 'TRANSPORTING') {
          const saved = JSON.parse(storedOnScene);
          if (saved.lat && saved.lng) {
            const pos = { lat: saved.lat, lng: saved.lng };
            setAmbulanceLocation(pos);
            ambulanceLocationRef.current = pos;
            _cachedAmbPos = pos;
          }
          setVehicleId(assignedVehicleId);
          setAmbulanceCrew(activeDispatch.ambulance?.crewName || 'Assigned Crew');
          setDistanceText('0.0 km');
          setEtaMinutes(0);
          arrivedOnSceneRef.current = true;
          setDispatchStatus('ON_SCENE');
        } else if (storedOnScene && backendStatus === 'TRANSPORTING') {
          // If we have a stored scene but the backend says we're transporting,
          // it means we've departed the scene. Ensure the local status flag is updated.
          arrivedOnSceneRef.current = true;
        }
        // ─────────────────────────────────────────────────────────────────────

        // ── Reload-safe DRIVING state (if app is reloaded mid-journey) ───────
        const drivingKey = `driving_pos_${activeIncident.incidentId}`;
        const storedDriving = await AsyncStorage.getItem(drivingKey);
        if (storedDriving && !storedOnScene && !arrivedAtHospital) {
          const saved = JSON.parse(storedDriving);
          if (saved.lat && saved.lng && !_cachedAmbPos) {
            const pos = { lat: saved.lat, lng: saved.lng };
            _cachedAmbPos = pos;
            ambulanceLocationRef.current = pos;
            // Prime the state so 'prev' in setAmbulanceLocation is correct
            setAmbulanceLocation(pos);
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        // ── Reload-safe arrived state: check AsyncStorage first ──────────────
        const arrivedKey = `arr_hospital_${activeIncident.incidentId}`;
        const storedArrived = await AsyncStorage.getItem(arrivedKey);
        if (storedArrived) {
          const saved = JSON.parse(storedArrived);
          // Restore hospital position so the map shows ambulance at hospital, not incident
          if (saved.lat && saved.lng) {
            const pos = { lat: saved.lat, lng: saved.lng };
            setAmbulanceLocation(pos);
            ambulanceLocationRef.current = pos;
            _cachedAmbPos = pos;
          }
          if (saved.hospitalName) {
            setTransportingHospital({ name: saved.hospitalName, address: saved.hospitalAddress || '' });
          }
          setVehicleId(assignedVehicleId);
          setAmbulanceCrew(activeDispatch.ambulance?.crewName || 'Assigned Crew');
          setDistanceText('0.0 km');
          setEtaMinutes(0);
          setArrivedAtHospital(true);
          setDispatchStatus('ARRIVED_AT_HOSPITAL');
          return; // Skip movement entirely
        }
        // ─────────────────────────────────────────────────────────────────────

        // Update dispatchStatus from backend — but don't overwrite a locally-confirmed
        // ON_SCENE/ARRIVED status, because the backend can lag 1-2 poll cycles behind.
        const TERMINAL_STATUSES = ['ON_SCENE', 'ARRIVED', 'ARRIVED_AT_HOSPITAL', 'TRANSPORTING'];
        if (!arrivedAtHospital && !TERMINAL_STATUSES.includes(dispatchStatus)) {
          setDispatchStatus(backendStatus);
        } else if (backendStatus === 'TRANSPORTING') {
          // Backend confirmed TRANSPORTING — always accept that upgrade
          setDispatchStatus('TRANSPORTING');
        } else if (TERMINAL_STATUSES.includes(backendStatus)) {
          // Backend confirmed a terminal status — accept it
          setDispatchStatus(backendStatus);
        }

        // Save hospital info if transporting
        if (backendStatus === 'TRANSPORTING' && activeDispatch.destinationHospitalName) {
          setTransportingHospital({
            name: activeDispatch.destinationHospitalName,
            address: activeDispatch.destinationHospitalAddress || '',
          });
        }

        // If already marked as arrived, stop updating position/ETA too
        if (arrivedAtHospital) return;

        // 3. Fetch Ambulance Location
        const amb = await apiClient.get(`/ambulances/${assignedVehicleId}`);
        if (amb.data) {
          setAmbulanceCrew(amb.data.crewName || "Assigned Crew");

          // Determine the correct starting position for the ambulance:
          // - EN_ROUTE: use ambulance's actual DB location (driving from station)
          // - TRANSPORTING: use INCIDENT location as seed (ambulance is already at the scene)
          //   The DB coords are the base station (Colombo), not where it actually is.
          const incidentLat = activeDispatch.incident?.location?.latitude;
          const incidentLng = activeDispatch.incident?.location?.longitude;

          // Store incident GPS so the patient marker is accurate
          if (incidentLat && incidentLng) {
            setIncidentLocation({ lat: incidentLat, lng: incidentLng });
          }

          let ambLat: number;
          let ambLng: number;

          if ((backendStatus === 'ON_SCENE' || backendStatus === 'ARRIVED' || backendStatus === 'TRANSPORTING') && incidentLat && incidentLng) {
            // Ambulance is at or past the scene — seed from incident coords, NOT from the DB's
            // currentLocation which still points to the base station (Kandy) because the backend
            // simulator is disabled and never updated it.
            ambLat = incidentLat;
            ambLng = incidentLng;
          } else if (amb.data.currentLocation && amb.data.currentLocation.latitude) {
            ambLat = amb.data.currentLocation.latitude;
            ambLng = amb.data.currentLocation.longitude;
          } else {
            ambLat = userLocation?.lat ? userLocation.lat + 0.005 : 6.9300;
            ambLng = userLocation?.lng ? userLocation.lng + 0.005 : 79.8650;
          }

          // Road correction constants — consistent across all screens
          const ROAD_FACTOR = 1.3;
          const AVG_SPEED_KMH = 45;

          // Accumulate fake movement locally so it visibly moves towards destination
          setAmbulanceLocation(prev => {
            let currentLat = prev ? prev.lat : ambLat;
            let currentLng = prev ? prev.lng : ambLng;

            // Discard stale cache ONLY when ambulance is NOT actively moving (i.e. a new dispatch from a different city).
            // If we do this while EN_ROUTE, the ambulance rubber-bands back to its station every ~10 seconds.
            const isMoving = backendStatus === 'EN_ROUTE' || backendStatus === 'ASSIGNED' || backendStatus === 'TRANSPORTING';
            if (prev && ambLat && !isMoving) {
              const latDiff = Math.abs(prev.lat - ambLat);
              const lngDiff = Math.abs(prev.lng - ambLng);
              if (latDiff > 0.05 || lngDiff > 0.05) {
                currentLat = ambLat;
                currentLng = ambLng;
              }
            }

            const targetLat = backendStatus === 'TRANSPORTING' && activeDispatch.destinationHospitalLat
              ? activeDispatch.destinationHospitalLat : (incidentLat || (userLocation ? userLocation.lat : currentLat));
            const targetLng = backendStatus === 'TRANSPORTING' && activeDispatch.destinationHospitalLng
              ? activeDispatch.destinationHospitalLng : (incidentLng || (userLocation ? userLocation.lng : currentLng));

            // nearTarget threshold MUST be larger than step size (0.008 deg) to prevent oscillation
            const latDiff = Math.abs(targetLat - currentLat);
            const lngDiff = Math.abs(targetLng - currentLng);
            const nearTarget = latDiff < 0.012 && lngDiff < 0.012; // ~1.3km threshold > 0.89km step

            if (!nearTarget && backendStatus !== 'ARRIVED' && backendStatus !== 'ON_SCENE') {
              currentLat += (targetLat > currentLat ? 0.008 : -0.008) + (Math.random() - 0.5) * 0.0002;
              currentLng += (targetLng > currentLng ? 0.008 : -0.008) + (Math.random() - 0.5) * 0.0002;
            } else if (nearTarget) {
              // Snap to destination — stops oscillating
              currentLat = targetLat;
              currentLng = targetLng;
            }

            const newPos = { lat: currentLat, lng: currentLng };
            ambulanceLocationRef.current = newPos;
            _cachedAmbPos = newPos; // persist across navigation
            if (!arrivedAtHospital && backendStatus !== 'ON_SCENE' && backendStatus !== 'ARRIVED') {
              AsyncStorage.setItem(`driving_pos_${activeIncident.incidentId}`, JSON.stringify(newPos)).catch(() => {});
            }
            return newPos;
          });

          // Calculate road-corrected distance/ETA
          const liveLat = ambulanceLocationRef.current?.lat ?? ambLat;
          const liveLng = ambulanceLocationRef.current?.lng ?? ambLng;
          const targetLat = backendStatus === 'TRANSPORTING' && activeDispatch.destinationHospitalLat
            ? activeDispatch.destinationHospitalLat : (incidentLat || liveLat);
          const targetLng = backendStatus === 'TRANSPORTING' && activeDispatch.destinationHospitalLng
            ? activeDispatch.destinationHospitalLng : (incidentLng || liveLng);

          const R = 6371;
          const tDLat = (liveLat - targetLat) * Math.PI / 180;
          const tDLon = (liveLng - targetLng) * Math.PI / 180;
          const tA = Math.sin(tDLat / 2) ** 2
            + Math.cos(targetLat * Math.PI / 180) * Math.cos(liveLat * Math.PI / 180)
            * Math.sin(tDLon / 2) ** 2;
          // Apply road correction factor to straight-line result
          const targetDistKm = R * 2 * Math.atan2(Math.sqrt(tA), Math.sqrt(1 - tA)) * ROAD_FACTOR;

          if (backendStatus === 'ARRIVED' || backendStatus === 'ON_SCENE' || targetDistKm < 1.5) {
            // Arrived at scene — snap display to zero
            setDistanceText('0.0 km');
            setEtaMinutes(0);

          // ONE-SHOT: tell backend ambulance is ON_SCENE and persist state to AsyncStorage
          if (!arrivedOnSceneRef.current && backendStatus !== 'ON_SCENE' && backendStatus !== 'TRANSPORTING' && activeDispatch.dispatchId) {
            arrivedOnSceneRef.current = true;
            // Set status IMMEDIATELY (not in .then()) so next poll tick doesn't overwrite it
            setDispatchStatus('ON_SCENE');
            // Persist to AsyncStorage so reload restores this state without re-driving from Kandy
            const onSceneKey = `on_scene_${activeIncident.incidentId}`;
            const scenePos = ambulanceLocationRef.current;
            AsyncStorage.setItem(onSceneKey, JSON.stringify({
              lat: scenePos?.lat ?? incidentLat,
              lng: scenePos?.lng ?? incidentLng,
            })).catch(() => {});
            // Fire the backend PATCH (best-effort — if it fails, AsyncStorage is still the truth)
            apiClient.patch(`/dispatch-logs/${activeDispatch.dispatchId}/status`, { status: 'ON_SCENE' })
              .catch(() => { arrivedOnSceneRef.current = false; }); // retry next tick if failed
          } else if (backendStatus === 'ON_SCENE') {
            arrivedOnSceneRef.current = true;
            setDispatchStatus('ON_SCENE');
          }

            // If we were TRANSPORTING, mark as arrived at hospital and persist to AsyncStorage
            if (backendStatus === 'TRANSPORTING' || dispatchStatus === 'TRANSPORTING') {
              setArrivedAtHospital(true);
              setDispatchStatus('ARRIVED_AT_HOSPITAL');
              // Persist so reload restores this state without re-simulating
              const arrivedKey = `arr_hospital_${activeIncident.incidentId}`;
              const hospitalPos = ambulanceLocationRef.current;
              AsyncStorage.setItem(arrivedKey, JSON.stringify({
                lat: hospitalPos?.lat ?? targetLat,
                lng: hospitalPos?.lng ?? targetLng,
                hospitalName: activeDispatch.destinationHospitalName || '',
                hospitalAddress: activeDispatch.destinationHospitalAddress || '',
              })).catch(() => {});
            }
          } else {
            setDistanceText(targetDistKm.toFixed(1) + ' km');
            setEtaMinutes(Math.round((targetDistKm / AVG_SPEED_KMH) * 60));
          }
        }
      } catch (error) {
        console.warn("Tracking fetch logic error:", error);
      }
    };

    fetchLiveTracking();
    intervalId = setInterval(fetchLiveTracking, 5000); // Poll every 5s

    return () => clearInterval(intervalId);
  }, [userLocation, arrivedAtHospital]);

  // Build polyline coords: ambulance → incident
  const polylineCoords = ambulanceLocation && incidentLocation ? [
    { latitude: ambulanceLocation.lat, longitude: ambulanceLocation.lng },
    { latitude: incidentLocation.lat, longitude: incidentLocation.lng },
  ] : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Full-screen map */}
      <View style={StyleSheet.absoluteFill}>
        {userLocation ? (
          <MapView
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: incidentLocation ? incidentLocation.lat : userLocation.lat,
              longitude: incidentLocation ? incidentLocation.lng : userLocation.lng,
              latitudeDelta: 0.8,
              longitudeDelta: 0.8,
            }}
            userInterfaceStyle={theme.isDark ? "dark" : "light"}
          >
            {incidentLocation && (
              <Marker coordinate={{ latitude: incidentLocation.lat, longitude: incidentLocation.lng }}>
                <View style={styles.userMarkerBlock}>
                  <Ionicons name="ellipse" size={16} color={theme.colors.primary} />
                </View>
              </Marker>
            )}
            {ambulanceLocation && (
              <Marker coordinate={{ latitude: ambulanceLocation.lat, longitude: ambulanceLocation.lng }}>
                <View style={styles.pulseIcon}>
                  <FontAwesome5 name="ambulance" size={20} color="#fff" />
                </View>
              </Marker>
            )}
            {/* Route polyline: ambulance → incident */}
            {polylineCoords.length === 2 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor="#e53935"
                strokeWidth={3}
                lineDashPattern={[8, 4]}
              />
            )}
          </MapView>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
            <Text style={{ color: theme.colors.textMuted }}>Loading Map...</Text>
          </View>
        )}

        {/* Floating header bar */}
        <View style={styles.floatingHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.floatingBackBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.floatingTitle}>{i18n.t('trackAmbulanceTitle', { locale })}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Glassmorphism ETA Badge */}
        <View style={styles.estimatedArrivalBadge}>
          <View style={styles.arrivalIconCircle}>
            <Ionicons name="time" size={18} color={theme.colors.error} />
          </View>
          <View style={{ justifyContent: 'center' }}>
            <Text style={styles.estimatedArrivalLabel}>{i18n.t('estimatedArrival', { locale })}</Text>
            <Text style={styles.estimatedArrivalText}>
              {!vehicleId ? '-- min' : (dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE') ? '0 min' : etaMinutes !== null ? `${etaMinutes} min` : '-- min'}
            </Text>
          </View>
        </View>
      </View>

      {/* Draggable bottom sheet */}
      <Animated.View style={[styles.detailsCard, { top: sheetY }]}>
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
          <View style={styles.dragHandle} />
        </View>

        <ScrollView
          contentContainerStyle={styles.detailsContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Box */}
          <View style={[
            styles.enRouteBox,
            (dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE') && {
              backgroundColor: theme.isDark ? 'rgba(21, 101, 192, 0.15)' : '#e3f2fd',
              borderColor: theme.isDark ? 'rgba(21, 101, 192, 0.4)' : '#90caf9',
            },
            dispatchStatus === 'TRANSPORTING' && {
              backgroundColor: theme.isDark ? 'rgba(230, 126, 34, 0.15)' : '#fff8e1',
              borderColor: theme.isDark ? 'rgba(230, 126, 34, 0.4)' : '#ffe082',
            },
            dispatchStatus === 'ARRIVED_AT_HOSPITAL' && {
              backgroundColor: theme.isDark ? 'rgba(21, 101, 192, 0.15)' : '#e3f2fd',
              borderColor: theme.isDark ? 'rgba(21, 101, 192, 0.4)' : '#90caf9',
            },
          ]}>
            <Ionicons
              name={(dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE' || dispatchStatus === 'ARRIVED_AT_HOSPITAL') ? 'checkmark-circle' : dispatchStatus === 'TRANSPORTING' ? 'car-sport' : 'ellipse'}
              size={12}
              color={(dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE' || dispatchStatus === 'ARRIVED_AT_HOSPITAL') ? '#1565c0' : dispatchStatus === 'TRANSPORTING' ? '#e67e22' : theme.colors.success}
              style={{ marginTop: 4 }}
            />
            <View style={styles.enRouteTextContainer}>
              <Text style={[
                styles.enRouteTitle,
                (dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE') && { color: theme.isDark ? '#90caf9' : '#0d47a1' },
                dispatchStatus === 'ARRIVED_AT_HOSPITAL' && { color: theme.isDark ? '#90caf9' : '#0d47a1' },
                dispatchStatus === 'TRANSPORTING' && { color: theme.isDark ? '#ffcc80' : '#e65100' },
              ]}>
                {!vehicleId
                  ? 'Searching for nearest available emergency unit...'
                  : dispatchStatus === 'ARRIVED_AT_HOSPITAL'
                    ? `🏥 Arrived at ${transportingHospital?.name || 'Hospital'}`
                    : (dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE')
                      ? '🏥 Ambulance On Scene'
                      : dispatchStatus === 'TRANSPORTING'
                        ? `🚑 Transporting to ${transportingHospital?.name || 'Hospital'}`
                        : i18n.t('ambulanceEnRoute', { locale })}
              </Text>
              <Text style={[
                styles.enRouteDesc,
                (dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE') && { color: theme.isDark ? '#64b5f6' : '#1565c0' },
                dispatchStatus === 'ARRIVED_AT_HOSPITAL' && { color: theme.isDark ? '#64b5f6' : '#1565c0' },
                dispatchStatus === 'TRANSPORTING' && { color: theme.isDark ? '#ffb74d' : '#bf360c' },
              ]}>
                {!vehicleId
                  ? 'An emergency unit will be dispatched to your location shortly.'
                  : dispatchStatus === 'ARRIVED_AT_HOSPITAL'
                    ? `Patient delivered to ${transportingHospital?.address || 'the hospital'}.`
                    : (dispatchStatus === 'ARRIVED' || dispatchStatus === 'ON_SCENE')
                      ? 'Emergency unit has arrived at your location.'
                      : dispatchStatus === 'TRANSPORTING'
                        ? transportingHospital?.address || 'Patient is being transported to hospital.'
                        : i18n.t('ambulanceEnRouteDesc', { locale })}
              </Text>
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={styles.infoBox}>
              <Text style={styles.label}>{i18n.t('vehicleId', { locale })}</Text>
              <Text style={styles.value}>{vehicleId || 'Unassigned'}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.label}>{i18n.t('distance', { locale })}</Text>
              <Text style={styles.value}>{vehicleId ? distanceText : '--'}</Text>
            </View>
          </View>

          <View style={styles.infoBoxFull}>
            <View style={styles.hospitalRow}>
              <Ionicons name="medical-outline" size={20} color={theme.colors.textMuted} />
              <View style={styles.textStack}>
                <Text style={styles.label}>Crew Team</Text>
                <Text style={styles.valueHospital}>{ambulanceCrew}</Text>
                <Text style={styles.labelAddress}>Emergency Response Unit</Text>
              </View>
            </View>
          </View>

          <View style={styles.liveTrackingBox}>
            <Text style={styles.liveTrackingText}>
              <Text style={styles.liveTrackingBold}>{i18n.t('liveTracking')}</Text>{' '}{i18n.t('liveTrackingDesc')}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  // Floating transparent header overlay
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 36 : 52,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  floatingBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pulseIcon: {
    backgroundColor: theme.colors.error,
    borderRadius: 30,
    padding: 12,
    shadowColor: '#e53935',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Glassmorphism ETA badge
  estimatedArrivalBadge: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 96 : 112,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    gap: 12,
  },
  arrivalIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(211, 47, 47, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  estimatedArrivalLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  estimatedArrivalText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginTop: -2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userMarkerBlock: {
    backgroundColor: theme.colors.card,
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  // Draggable bottom sheet
  detailsCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT,  // tall enough to scroll
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandleArea: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
  },
  detailsContent: {
    padding: 24,
    paddingBottom: 40,
  },
  enRouteBox: {
    backgroundColor: theme.isDark ? "rgba(46, 125, 50, 0.1)" : '#ebfdf2',
    borderColor: theme.isDark ? "rgba(46, 125, 50, 0.3)" : '#b2f2bb',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  enRouteTextContainer: { flex: 1 },
  enRouteTitle: { fontSize: 16, fontWeight: 'bold', color: theme.isDark ? "#81c784" : '#0f5132', marginBottom: 4 },
  enRouteDesc: { fontSize: 13, color: theme.isDark ? "#a5d6a7" : '#138151' },
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  infoBox: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  infoBoxFull: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, borderRadius: 12, padding: 16, marginBottom: 20 },
  hospitalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  textStack: { flex: 1 },
  label: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: "bold", color: theme.colors.text },
  valueHospital: { fontSize: 16, fontWeight: "bold", color: theme.colors.primary, marginBottom: 4 },
  labelAddress: { fontSize: 13, color: theme.colors.textMuted },
  liveTrackingBox: {
    backgroundColor: theme.isDark ? "rgba(211, 47, 47, 0.15)" : "#fef2f2",
    borderColor: theme.isDark ? "rgba(211, 47, 47, 0.35)" : "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  liveTrackingText: { fontSize: 13, color: theme.isDark ? "#ff8a80" : "#c62828", lineHeight: 20 },
  liveTrackingBold: { fontWeight: 'bold' },
  callBtn: {
    flexDirection: "row",
    backgroundColor: theme.colors.buttonBg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  callBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});