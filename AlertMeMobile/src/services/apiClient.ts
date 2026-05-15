import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebaseConfig';

// Modern versions of Expo automatically inject EXPO_PUBLIC_ environment variables
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.214.42.73:8080/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept outgoing HTTP requests to inject the `Authorization: Bearer <token>`
apiClient.interceptors.request.use(
  async (config) => {
    try {
      let tokenToUse = null;

      // Try to get a fresh token from Firebase first
      if (auth && auth.currentUser) {
        try {
          tokenToUse = await auth.currentUser.getIdToken(true); // Force refresh to guarantee valid token
        } catch (e) {
          console.warn("Failed to get fresh Firebase token", e);
        }
      } else {
        console.log("Firebase auth or currentUser is null, falling back to AsyncStorage");
      }

      // Fallback to AsyncStorage if Firebase isn't initialized or user is null
      if (!tokenToUse) {
        const sessionStr = await AsyncStorage.getItem('userToken');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          tokenToUse = session.token;
          console.log("Using AsyncStorage fallback token");
        }
      }

      if (tokenToUse && config.headers) {
        config.headers.Authorization = `Bearer ${tokenToUse}`;
      } else {
         console.warn("No token available for request to", config.url);
      }
    } catch (error) {
      console.warn('Failed to inject token', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercept incoming HTTP responses globally (if Token expires, bounce them out)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn('HTTP 401/403: Security Filter blocked the payload.');
      // Future feature: Dispatch Redux Logout Action here to kick user to LoginScreen
    }
    return Promise.reject(error);
  }
);

export default apiClient;
