import { useJsApiLoader } from '@react-google-maps/api';
import { useEffect } from 'react';

// ─── Stable constants (defined OUTSIDE components to avoid re-renders) ────────
const LIBRARIES = ['places'];

export const defaultCenter = { lat: 6.9271, lng: 79.8612 }; // Colombo, Sri Lanka

export const mapContainerStyle = { width: '100%', height: '100%' };

// AlertMe dark map theme
export const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1d3461' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a192f' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
    { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
];

// ─── Shared API loader hook (one script load for entire app) ──────────────────
export function useGoogleMaps() {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    
    // Debug: Is the key being loaded by Vite?
    useEffect(() => {
        console.log("Google Maps API Key Loaded:", apiKey ? `Key starts with ${apiKey.substring(0, 5)}...` : "NO KEY FOUND IN .ENV");
    }, [apiKey]);

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: apiKey,
        libraries: LIBRARIES,
    });
    return { isLoaded, loadError };
}

// ─── Loading / error fallback UI ──────────────────────────────────────────────
export function MapFallback({ error, height = '100%' }) {
    const base = {
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        borderRadius: '12px',
    };
    if (error) {
        return (
            <div style={{ ...base, color: '#ef4444', gap: '8px', fontSize: '13px' }}>
                <span style={{ fontSize: '22px' }}>⚠️</span>
                Map failed to load. Check your API key.
            </div>
        );
    }
    return (
        <div style={{ ...base, color: '#64748b', gap: '10px' }}>
            <div style={{
                width: '28px', height: '28px',
                border: '3px solid #334155',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: '12px' }}>Loading map...</span>
        </div>
    );
}

// ─── Marker icon factory (call after isLoaded = true) ─────────────────────────
export function buildMarkerIcons() {
    const make = (color, size) => ({
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
            `<circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="2.5"/>` +
            `</svg>`
        )}`,
        scaledSize: new window.google.maps.Size(size, size),
        anchor: new window.google.maps.Point(size / 2, size / 2),
    });
    return {
        incident:        make('#ef4444', 22),   // red   — active emergency
        ambulance:       make('#22c55e', 18),   // green — available unit
        activeAmbulance: make('#f97316', 20),   // orange — responding unit
        ambulanceByStatus: (status) => {
            if (status === 'En Route' || status === 'DISPATCHED' || status === 'Transporting' || status === 'TRANSPORTING') return make('#f97316', 20);
            if (status === 'On Scene' || status === 'ON_SCENE')    return make('#ef4444', 20);
            return make('#22c55e', 18); // Available
        },
    };
}
