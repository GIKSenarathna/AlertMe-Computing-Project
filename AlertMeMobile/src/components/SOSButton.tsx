import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { useLanguage } from "../context/LanguageContext";
import i18n from "../i18n/i18n";

const ALERT_SOUND_URL = "https://www.soundjay.com/buttons/beep-07.mp3";

export default function SOSButton({ onActivate }: any) {
  const { locale } = useLanguage();
  const scale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    // Continuous idle pulse animation
    Animated.loop(
      Animated.parallel([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Preload sound
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: ALERT_SOUND_URL });
        soundRef.current = sound;
      } catch (e) {
        console.log("Error loading sound", e);
      }
    };
    loadSound();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const playSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
      }
    } catch (e) {
      console.log("Error playing sound", e);
    }
  };

  const startHold = () => {
    // Tactile click feel
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.timing(scale, {
      toValue: 1.25, // Stronger scale to simulate pressure
      duration: 3000,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        // Heavy vibration and audio on activation
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        playSound();
        onActivate();
      }
    });
  };

  const cancelHold = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.buttonWrapper}>
      {/* Background Pulse Rings */}
      <Animated.View 
        style={[
          styles.pulseRing, 
          { 
            transform: [{ scale: pulseAnim }], 
            opacity: pulseOpacity 
          }
        ]} 
      />
      
      <Pressable onPressIn={startHold} onPressOut={cancelHold}>
        <Animated.View style={[styles.outerCircle, { transform: [{ scale }] }]}>
          <View style={styles.innerCircle}>
            <Ionicons name="alert-circle" size={68} color="#fff" />
            <Text style={styles.sosText}>{i18n.t("sos", { locale })}</Text>
            <Text style={styles.pressText}>{i18n.t("sosSubLabel", { locale })}</Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 300,
    height: 300,
  },
  pulseRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#d32f2f",
    zIndex: -1,
  },
  outerCircle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#b71c1c", // Shaded dark red for depth
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 20,
  },
  innerCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#d32f2f", // Vibrant emergency red
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  sosText: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "800",
    marginTop: -4,
  },
  pressText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.5,
    opacity: 0.8,
    textTransform: "uppercase",
  },
});