import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, Search, Plus, Filter, Activity, Zap, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useGoogleMaps, defaultCenter, darkMapStyle, MapFallback, buildMarkerIcons, mapContainerStyle } from '../services/googleMapsConfig';
import apiClient from '../services/apiClient';
import './AmbulanceManagement.css';

const safeJSONParse = (key, fallback) => {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : fallback;
    } catch (e) {
        return fallback;
    }
};

// Module-level position cache — survives navigation (component unmount/remount)
// vehicleId -> { lat, lng }
const _posCache = {};

// Vehicles that have arrived at destination (incident scene) — never reset to TRANSPORTING from backend
// Seeded from localStorage so a page refresh doesn't reset arrived status
const _arrivedCache = new Set(safeJSONParse('fleet_arrived_cache_v2', []));

// Vehicles that have completed TRANSPORTING and arrived at hospital.
// Persisted in localStorage so page refresh doesn't restart the transit from scratch.
// Cleared only when the backend returns AVAILABLE for the vehicle.
const _arrivedHospitalSet = new Set(safeJSONParse('fleet_hospital_arrived_v1', []));

// Cache of assigned incidents so the View Incident button works even after the active log is dropped
// vehicleId -> incidentId
let _incidentCache = safeJSONParse('fleet_incident_cache_v1', {});

// Time-based transit tracker: records when each vehicle first entered TRANSPORTING state.
// Position is computed as: lerp(incident, hospital, elapsed_time * speed / total_distance)
// vehicleId -> { startMs, fromLat, fromLng, toLat, toLng, totalDistKm }
const _transitMap = {};

export default function AmbulanceManagement() {
    const navigate = useNavigate();
    const { isLoaded, loadError } = useGoogleMaps();
    const markerIcons = useMemo(() => isLoaded ? buildMarkerIcons() : {}, [isLoaded]);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState('All');
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Form State
    const [formData, setFormData] = useState({
        vehicleNumber: '',
        type: 'Basic',
        driverName: '',
        driverPhone: '',
        station: 'Colombo Central'
    });

    // Format seconds into a readable ETA string
    const formatEtaSeconds = (seconds) => {
        if (!seconds || seconds <= 0) return '--';
        const totalMinutes = Math.round(seconds / 60);
        if (totalMinutes >= 60) {
            const hrs = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
        }
        return `${Math.max(2, totalMinutes)} min`;
    };

    // vehicleId -> { incLat, incLng, staticEta } from active dispatch logs
    const [etaMap, setEtaMap] = useState({});

    // Fetch real incident coordinates from active dispatch logs
    useEffect(() => {
        const fetchEtaMap = async () => {
            try {
                const res = await apiClient.get('/dispatch-logs/active');
                const map = {};
                (res.data || []).forEach(log => {
                    if (log.ambulance?.vehicleId && log.incident?.location) {
                        map[log.ambulance.vehicleId] = {
                            // Target for movement: hospital when transporting, incident when en route
                            // Fallback to a generic 5.5km distance if the hospital lacks GPS coordinates
                            incLat: log.status === 'TRANSPORTING' ? (log.destinationHospitalLat || log.incident.location.latitude + 0.05) : log.incident.location.latitude,
                            incLng: log.status === 'TRANSPORTING' ? (log.destinationHospitalLng || log.incident.location.longitude + 0.05) : log.incident.location.longitude,
                            // Seed: where the ambulance starts (incident scene) for TRANSPORTING
                            seedIncLat: log.incident.location.latitude,
                            seedIncLng: log.incident.location.longitude,
                            // Backend timestamp of when TRANSPORTING started — used as startMs so
                            // page refreshes resume at the correct progress (not restart from scratch)
                            transportingStartMs: log.status === 'TRANSPORTING' && log.updatedAt
                                ? new Date(log.updatedAt).getTime()
                                : null,
                            eta: log.status === 'ARRIVED' ? '0 min' : formatEtaSeconds(log.estimatedEtaSeconds),
                            incidentId: log.incident.incidentId
                        };
                        // Cache the incident ID so the View Incident button survives log completion
                        _incidentCache[log.ambulance.vehicleId] = log.incident.incidentId;
                    }
                });
                try { localStorage.setItem('fleet_incident_cache_v1', JSON.stringify(_incidentCache)); } catch(e) {}
                setEtaMap(map);
            } catch (err) {
                // /dispatch-logs/active not available — ETAs will show '--'
                console.warn('Could not fetch dispatch ETAs:', err.message);
            }
        };
        fetchEtaMap();
        const id = setInterval(fetchEtaMap, 8000);
        return () => clearInterval(id);
    }, []);

    // Auto-movement simulation state
    const [fleetData, setFleetData] = useState([]);

    const haversineKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLon / 2) ** 2;
        // Road-corrected: Sri Lankan roads avg 30% longer than straight-line
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3;
    };

    const getDynamicEta = (vehicleId, ambLat, ambLng) => {
        const dispatchInfo = etaMap[vehicleId];
        if (!dispatchInfo) return '--';
        if (dispatchInfo.incLat && dispatchInfo.incLng && ambLat && ambLng) {
            const dist = haversineKm(ambLat, ambLng, dispatchInfo.incLat, dispatchInfo.incLng);
            if (dist < 1.5) return '0 min'; // arrived
            const totalSeconds = Math.round((dist / 45) * 3600); // 45 km/h realistic speed
            return formatEtaSeconds(Math.max(120, totalSeconds));
        }
        return formatEtaSeconds(dispatchInfo.staticEta);
    };

    // Live API fetch
    useEffect(() => {
        const fetchFleet = async () => {
            try {
                const res = await apiClient.get('/ambulances');
                setFleetData(res.data.map((a, i) => {
                    const raw = (a.currentStatus || a.status || '').toUpperCase();
                    
                    // Clear arrived cache whenever the ambulance leaves the scene (TRANSPORTING) or finishes the job (AVAILABLE).
                    // Do NOT clear it on EN_ROUTE/DISPATCHED, because the visual simulation might reach the scene while the backend is still EN_ROUTE.
                    if (raw === 'AVAILABLE' || raw === 'TRANSPORTING') {
                        if (_arrivedCache.has(a.vehicleId)) {
                            _arrivedCache.delete(a.vehicleId);
                            try { localStorage.setItem('fleet_arrived_cache_v2', JSON.stringify([..._arrivedCache])); } catch(e) {}
                        }
                    }
                    if (raw === 'AVAILABLE' || raw === 'EN_ROUTE' || raw === 'DISPATCHED') {
                        let changed = false;
                        if (_arrivedHospitalSet.has(a.vehicleId)) {
                            _arrivedHospitalSet.delete(a.vehicleId);
                            try { localStorage.setItem('fleet_hospital_arrived_v1', JSON.stringify([..._arrivedHospitalSet])); } catch(e) {}
                        }
                        if (_incidentCache[a.vehicleId] && raw === 'AVAILABLE') {
                            delete _incidentCache[a.vehicleId];
                            try { localStorage.setItem('fleet_incident_cache_v1', JSON.stringify(_incidentCache)); } catch(e) {}
                        }
                    }

                    // If this vehicle has locally arrived (and hasn't departed yet), keep it in the arrived state
                    const status = _arrivedHospitalSet.has(a.vehicleId)
                        ? 'Arrived at Hospital'
                        : _arrivedCache.has(a.vehicleId)
                        ? 'On Scene'
                        : raw === 'AVAILABLE'    ? 'Available'
                        : raw === 'EN_ROUTE'     ? 'En Route'
                        : raw === 'ON_SCENE'     ? 'On Scene'
                        : raw === 'TRANSPORTING' ? 'Transporting'
                        : raw === 'DISPATCHED'   ? 'En Route'
                        : 'Offline';

                    const isMoving = status === 'En Route' || status === 'Transporting';
                    const isOnScene = status === 'On Scene';
                    const apiLat = a.currentLocation?.latitude;
                    const apiLng = a.currentLocation?.longitude;
                    const dispatchSeed = etaMap[a.vehicleId];
                    const seedLat = status === 'Transporting' && dispatchSeed?.seedIncLat ? dispatchSeed.seedIncLat : apiLat;
                    const seedLng = status === 'Transporting' && dispatchSeed?.seedIncLng ? dispatchSeed.seedIncLng : apiLng;
                    
                    const incLat = dispatchSeed?.incLat;
                    const incLng = dispatchSeed?.incLng;

                    // ── TRANSPORTING: time-based position interpolation ───────────────
                    // When TRANSPORTING is first detected, record start time + from/to coords.
                    // Position = lerp(incident, hospital, elapsed_time * 45kmh / total_dist)
                    // This is immune to cache race conditions between fetchFleet and the interval.
                    if (status === 'Transporting' && dispatchSeed?.seedIncLat && dispatchSeed?.incLat) {
                        if (!_transitMap[a.vehicleId]) {
                            // First detection — record start of transit
                            const fromLat = dispatchSeed.seedIncLat;
                            const fromLng = dispatchSeed.seedIncLng;
                            const toLat   = dispatchSeed.incLat;  // hospital
                            const toLng   = dispatchSeed.incLng;
                            const totalDistKm = haversineKm(fromLat, fromLng, toLat, toLng);
                            
                            // Only start transit if we actually have a distinct destination (hospital).
                            // If the dispatch log is slightly delayed, toLat might still be the incident scene.
                            if (totalDistKm > 0.01) {
                                // Use the backend's transporting start time if available, otherwise fallback to Date.now()
                                const startMs = dispatchSeed.transportingStartMs || Date.now();
                                _transitMap[a.vehicleId] = { startMs, fromLat, fromLng, toLat, toLng, totalDistKm };
                            }
                        }
                    } else if (status !== 'Transporting' && status !== 'Arrived at Hospital') {
                        // Clear transit tracking when ambulance is no longer transporting or arrived
                        delete _transitMap[a.vehicleId];
                    }

                    // Read from module-level cache (survives navigation) — used only for EN_ROUTE
                    let cachedLat = _posCache[a.vehicleId]?.lat;
                    let cachedLng = _posCache[a.vehicleId]?.lng;

                    // Discard stale position cache if the ambulance has teleported (e.g. reset to station)
                    // ONLY do this if the ambulance is NOT currently driving, otherwise it rubber-bands back to start.
                    if (apiLat && cachedLat && !isMoving && !isOnScene) {
                        const latDiff = Math.abs(cachedLat - apiLat);
                        const lngDiff = Math.abs(cachedLng - apiLng);
                        if (latDiff > 0.02 || lngDiff > 0.02) {
                            delete _posCache[a.vehicleId];
                            cachedLat = undefined;
                            cachedLng = undefined;
                        }
                    }

                    let newLat, newLng;
                    if (status === 'Arrived at Hospital') {
                        // Hold position securely at the hospital
                        newLat = _transitMap[a.vehicleId]?.toLat || incLat || cachedLat || 6.9271;
                        newLng = _transitMap[a.vehicleId]?.toLng || incLng || cachedLng || 79.8612;
                    } else if (status === 'Transporting' && _transitMap[a.vehicleId]) {
                        // Time-based interpolation for TRANSPORTING phase
                        const t = _transitMap[a.vehicleId];
                        const elapsedSec = (Date.now() - t.startMs) / 1000;
                        // Match mobile app speed: 0.008° per 8s ≈ 0.111 km/s (400 km/h simulation)
                        const speedKmPerSec = 0.111;
                        const progress = t.totalDistKm > 0.001
                            ? Math.min(1, (elapsedSec * speedKmPerSec) / t.totalDistKm)
                            : 1;
                        newLat = t.fromLat + (t.toLat - t.fromLat) * progress;
                        newLng = t.fromLng + (t.toLng - t.fromLng) * progress;
                    } else if (isOnScene && incLat && incLng) {
                        // Ambulance is ON_SCENE: place it at incident location (etaMap has this)
                        newLat = incLat;
                        newLng = incLng;
                    } else if (isOnScene && cachedLat) {
                        // etaMap not loaded yet (first 8s after page refresh) — use cached pos
                        newLat = cachedLat;
                        newLng = cachedLng;
                    } else if (isMoving) {
                        newLat = cachedLat || seedLat || 6.9271;
                        newLng = cachedLng || seedLng || 79.8612;
                    } else {
                        newLat = apiLat || cachedLat || 6.9271;
                        newLng = apiLng || cachedLng || 79.8612;
                    }

                    // Persist to module cache so remounts restore EN_ROUTE position
                    if (isMoving && status !== 'Transporting') _posCache[a.vehicleId] = { lat: newLat, lng: newLng };
                    if (isOnScene) _posCache[a.vehicleId] = { lat: newLat, lng: newLng };

                    return {
                        id: a.vehicleId,
                        crew: a.crewName || 'Assigned Crew',
                        location: a.stationName || 'Unknown Station',
                        status,
                        eta: (status === 'En Route' || status === 'Transporting') ? getDynamicEta(a.vehicleId, newLat, newLng) : (status === 'On Scene' || status === 'Arrived at Hospital' ? '0 min' : '--'),
                        lastUpdate: 'Now',
                        assignedIncident: (status === 'En Route' || status === 'On Scene' || status === 'Transporting' || status === 'Arrived at Hospital') ? (etaMap[a.vehicleId]?.incidentId || _incidentCache[a.vehicleId]) : null,
                        capabilityType: a.capabilityType || 'Basic',
                        verificationStatus: 'Approved',
                        lat: newLat,
                        lng: newLng,
                    };
                }));
            } catch (err) {
                console.error('Failed to fetch fleet:', err);
            }
        };
        fetchFleet();
        const id = setInterval(fetchFleet, 8000);
        return () => clearInterval(id);
    }, [etaMap]);

    // Fake GPS auto-movement interval
    useEffect(() => {
        const interval = setInterval(() => {
            setFleetData(prev => prev.map(amb => {
                // Guard: skip if position is invalid
                if (!amb.lat || !amb.lng || isNaN(amb.lat) || isNaN(amb.lng)) return amb;

                // Only move active ambulances (Arrived at Hospital is kept to allow fetchFleet to eventually clear it)
                if (amb.status !== 'En Route' && amb.status !== 'Transporting' && amb.status !== 'Arrived at Hospital') return amb;

                const dispatchInfo = etaMap[amb.id];

                if (amb.status === 'Arrived at Hospital') {
                    // Do nothing, securely hold position at the hospital
                    return amb;
                }

                // ── TRANSPORTING: time-based interpolation (no cache) ──────────
                if (amb.status === 'Transporting') {
                    _arrivedCache.delete(amb.id);

                    const transit = _transitMap[amb.id];
                    if (!transit) return amb; // wait for fetchFleet to register transit

                    const elapsedSec = (Date.now() - transit.startMs) / 1000;
                    // Match mobile app speed: 0.008° per 8s ≈ 0.888 km per 8s ≈ 0.111 km/s (400 km/h simulation)
                    const speedKmPerSec = 0.111;
                    const progress = transit.totalDistKm > 0.001
                        ? Math.min(1, (elapsedSec * speedKmPerSec) / transit.totalDistKm)
                        : 1;

                    const curLat = transit.fromLat + (transit.toLat - transit.fromLat) * progress;
                    const curLng = transit.fromLng + (transit.toLng - transit.fromLng) * progress;

                    if (progress >= 1) {
                        // Ambulance has reached the hospital — flip to local 'Arrived at Hospital' status
                        // This persists until fetchFleet gets AVAILABLE from the backend and clears _arrivedHospitalSet
                        if (!_arrivedHospitalSet.has(amb.id)) {
                            _arrivedHospitalSet.add(amb.id);
                            try { localStorage.setItem('fleet_hospital_arrived_v1', JSON.stringify([..._arrivedHospitalSet])); } catch(e) {}
                        }
                        return { ...amb, lat: transit.toLat, lng: transit.toLng, eta: '0 min', status: 'Arrived at Hospital' };
                    }
                    return { ...amb, lat: curLat, lng: curLng, eta: getDynamicEta(amb.id, curLat, curLng) };
                }

                // ── EN_ROUTE: move from station → incident ──────────────────────
                if (dispatchInfo && dispatchInfo.seedIncLat && dispatchInfo.seedIncLng) {
                    const targetLat = dispatchInfo.seedIncLat;
                    const targetLng = dispatchInfo.seedIncLng;
                    const latDiff = Math.abs(targetLat - amb.lat);
                    const lngDiff = Math.abs(targetLng - amb.lng);
                    const nearScene = latDiff < 0.012 && lngDiff < 0.012;

                    if (nearScene) {
                        _arrivedCache.add(amb.id);
                        try { localStorage.setItem('fleet_arrived_cache_v2', JSON.stringify([..._arrivedCache])); } catch(e) {}
                        _posCache[amb.id] = { lat: targetLat, lng: targetLng };
                        return { ...amb, lat: targetLat, lng: targetLng, status: 'On Scene', eta: '0 min' };
                    }

                    const newLat = amb.lat + (targetLat > amb.lat ? 0.008 : -0.008) + (Math.random() - 0.5) * 0.0002;
                    const newLng = amb.lng + (targetLng > amb.lng ? 0.008 : -0.008) + (Math.random() - 0.5) * 0.0002;
                    _posCache[amb.id] = { lat: newLat, lng: newLng };
                    return { ...amb, lat: newLat, lng: newLng, eta: getDynamicEta(amb.id, newLat, newLng) };
                }

                return amb;
            }));
        }, 3000);
        return () => clearInterval(interval);
    }, [etaMap]);


    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const newId = `AMB-${formData.vehicleNumber.replace(/\s/g, '').toUpperCase()}`;
            await apiClient.post('/ambulances/register', {
                vehicleId: newId,
                crewName: formData.driverName,
                capabilityType: formData.type.toUpperCase(),
                stationName: formData.station,
                driverPhone: formData.driverPhone,
                licensePlate: formData.vehicleNumber,
                currentStatus: 'AVAILABLE',
                active: true
            });

            setRegistrationSuccess(true);

            // Refresh fleet from API to show new unit
            const res = await apiClient.get('/ambulances');
            setFleetData(prev => {
                const posMap = {};
                prev.forEach(a => { posMap[a.id] = { lat: a.lat, lng: a.lng }; });
                return res.data.map((a, i) => {
                    const raw = (a.currentStatus || '').toUpperCase();
                    const status = raw === 'AVAILABLE' ? 'Available'
                                 : raw === 'EN_ROUTE'  ? 'En Route'
                                 : raw === 'ON_SCENE'  ? 'On Scene'
                                 : 'Offline';
                    return {
                        id: a.vehicleId,
                        crew: a.crewName || 'Assigned Crew',
                        location: a.stationName || 'Unknown Station',
                        status,
                        eta: status === 'En Route' ? formatEtaSeconds(etaMap[a.vehicleId]) : '--',
                        lastUpdate: 'Now',
                        assignedIncident: null,
                        capabilityType: a.capabilityType || 'Basic',
                        verificationStatus: 'Approved',
                        lat: posMap[a.vehicleId]?.lat || (6.9271 + (Math.random() - 0.5) * 0.08),
                        lng: posMap[a.vehicleId]?.lng || (79.8612 + (Math.random() - 0.5) * 0.08),
                    };
                });
            });

            setTimeout(() => {
                setShowRegisterModal(false);
                setRegistrationSuccess(false);
                setIsSubmitting(false);
                setFormData({ vehicleNumber: '', type: 'Basic', driverName: '', driverPhone: '', station: 'Colombo Central' });
            }, 1500);

        } catch (err) {
            console.error('Registration failed:', err);
            showToast(`Registration failed: ${err?.response?.data?.message || err.message}`, 'error');
            setIsSubmitting(false);
        }
    };

    const handleApprove = (id) => {
        setFleetData(prev => prev.map(amb =>
            amb.id === id ? { ...amb, verificationStatus: 'Approved', status: 'Available' } : amb
        ));
    };

    const handleToggleOffline = async (id, currentStatus) => {
        const newStatus = currentStatus === 'Offline' ? 'AVAILABLE' : 'OFFLINE';
        try {
            await apiClient.patch(`/ambulances/${id}/status`, { status: newStatus });
            // Optimistic UI update
            setFleetData(prev => prev.map(amb => 
                amb.id === id ? { ...amb, status: newStatus === 'AVAILABLE' ? 'Available' : 'Offline' } : amb
            ));
        } catch (e) {
            console.error('Failed to toggle status', e);
            showToast('Failed to update ambulance status. Please try again.', 'error');
        }
    };

    // 'Arrived at Hospital' is a local-only status; show it under the Transporting filter tab
    const filteredFleet = filter === 'All' ? fleetData
        : filter === 'Transporting' ? fleetData.filter(a => a.status === 'Transporting' || a.status === 'Arrived at Hospital')
        : fleetData.filter(a => a.status === filter);

    const statusClass = (s) => {
        if (s === 'Available') return 'status-available';
        if (s === 'En Route') return 'status-enroute';
        if (s === 'On Scene') return 'status-onscene';
        if (s === 'Transporting') return 'status-transporting';
        if (s === 'Arrived at Hospital') return 'status-available'; // blue/green — mission complete
        return '';
    };

    return (
        <div className="ambulance-page">
            {/* ── Inline Toast (Recommendation 1) ── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
                    background: toast.type === 'error' ? '#7f1d1d' : '#14532d',
                    border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#22c55e'}`,
                    color: '#fff', padding: '12px 20px', borderRadius: '10px',
                    fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center',
                    gap: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                }}>
                    {toast.type === 'error' ? '⚠️' : '✅'} {toast.msg}
                </div>
            )}
            <div className="page-header">
                <div>
                    <h1>Ambulance Fleet</h1>
                    <p>Live tracking and dispatch control</p>
                </div>
                <div className="header-actions">
                    <button className="register-btn" onClick={() => setShowRegisterModal(true)}>
                        <Truck size={18} /> Register Ambulance
                    </button>
                    <div className="system-status live-gps-container">
                        <span className="status-dot green-pulse"></span>
                        <span>Live GPS Tracking Active</span>
                    </div>
                </div>
            </div>

            <div className="amb-stats">
                <div className="amb-stat-card">
                    <div className="stat-icon-wrap bg-success"><Truck size={24} /></div>
                    <div className="stat-info">
                        <h3>{fleetData.filter(a => a.status === 'Available').length}</h3>
                        <p>Available</p>
                    </div>
                </div>
                <div className="amb-stat-card">
                    <div className="stat-icon-wrap bg-primary"><Zap size={24} /></div>
                    <div className="stat-info">
                        <h3>{fleetData.filter(a => a.status === 'En Route').length}</h3>
                        <p>En Route</p>
                    </div>
                </div>
                <div className="amb-stat-card">
                    <div className="stat-icon-wrap bg-danger"><Activity size={24} /></div>
                    <div className="stat-info">
                        <h3>{fleetData.filter(a => a.status === 'On Scene').length}</h3>
                        <p>On Scene</p>
                    </div>
                </div>
                <div className="amb-stat-card">
                    <div className="stat-icon-wrap bg-warning" style={{ backgroundColor: '#f59e0b', color: '#fff' }}><Truck size={24} /></div>
                    <div className="stat-info">
                        <h3>{fleetData.filter(a => a.status === 'Transporting' || a.status === 'Arrived at Hospital').length}</h3>
                        <p>Transporting</p>
                    </div>
                </div>
                <div className="amb-stat-card">
                    <div className="stat-icon-wrap bg-muted"><Activity size={24} /></div>
                    <div className="stat-info">
                        <h3>{fleetData.length}</h3>
                        <p>Total Fleet</p>
                    </div>
                </div>
            </div>

            <div className="amb-layout">
                {/* Map Section */}
                <div className="amb-map-card card">
                    <div className="card-header">
                        <h3>Live GPS Map</h3>
                        <div className="live-indicator">
                            <span className="dot red-pulse"></span> Tracking
                        </div>
                    </div>
                    <div style={{ height: '500px', width: '100%', borderRadius: '0 0 12px 12px', overflow: 'hidden', position: 'relative' }}>
                        {!isLoaded || loadError ? (
                            <MapFallback error={loadError} />
                        ) : (
                            <GoogleMap 
                                center={defaultCenter} 
                                zoom={12} 
                                mapContainerStyle={mapContainerStyle}
                                options={{ styles: darkMapStyle, disableDefaultUI: true, zoomControl: true }}
                            >
                                {fleetData.map(amb => (
                                    <MarkerF 
                                        key={`map-${amb.id}`}
                                        position={{ lat: amb.lat, lng: amb.lng }} 
                                        icon={markerIcons.ambulanceByStatus ? markerIcons.ambulanceByStatus(amb.status) : undefined}
                                        onClick={() => setSelected(selected === amb.id ? null : amb.id)}
                                    >
                                        {selected === amb.id && (
                                            <InfoWindowF onCloseClick={() => setSelected(null)}>
                                                <div style={{ minWidth: '140px', color: '#1e293b' }}>
                                                    <strong style={{ fontSize: '14px' }}>🚑 {amb.id}</strong><br/>
                                                    <strong>Status:</strong> <span className={`status-pill ${amb.status === 'Available' ? 'status-pill-resolved' : amb.status === 'En Route' ? 'status-pill-active' : 'status-pill-dispatched'}`} style={{ padding: '2px 8px', fontSize: '10px' }}>{amb.status}</span><br/>
                                                    <strong>Crew:</strong> {amb.crew}
                                                </div>
                                            </InfoWindowF>
                                        )}
                                    </MarkerF>
                                ))}
                            </GoogleMap>
                        )}

                        {/* Map Legend purely floating over leaflet map */}
                        <div className="map-legend" style={{ zIndex: 1000 }}>
                            <div className="legend-row">
                                <span className="legend-dot bg-success"></span>
                                <span>Available</span>
                            </div>
                            <div className="legend-row">
                                <span className="legend-dot bg-warning"></span>
                                <span>En Route</span>
                            </div>
                            <div className="legend-row">
                                <span className="legend-dot bg-danger"></span>
                                <span>On Scene</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* List Section */}
                <div className="amb-list-card card">
                    <div className="card-header wrapper-list-header">
                        <h3>Fleet Status</h3>
                        <div className="amb-quick-filters">
                            {['All', 'Available', 'En Route', 'On Scene', 'Transporting'].map(f => (
                                <button
                                    key={f}
                                    className={`amb-filter-chip ${filter === f ? 'active' : ''}`}
                                    onClick={() => setFilter(f)}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="amb-list">
                        {filteredFleet.map(a => (
                            <div
                                key={a.id}
                                className={`amb-item ${selected === a.id ? 'selected' : ''} ${a.status === 'On Scene' ? 'amb-onscene-glow' : ''}`}
                                onClick={() => setSelected(a.id)}
                            >
                                <div className="amb-icon-wrap"><Truck size={20} /></div>
                                <div className="amb-info">
                                    <div className="amb-row">
                                        <div className="amb-id-block">
                                            <strong className="amb-id-text">{a.id}</strong>
                                            {a.verificationStatus === 'Pending' && <span className="pending-badge">Verification Pending</span>}
                                        </div>
                                        <span className={`amb-badge ${statusClass(a.status)}`}>
                                            {a.status}
                                        </span>
                                    </div>
                                    <p className="amb-crew">{a.crew}</p>
                                    <div className="amb-location"><MapPin size={13} className="text-muted mr-1" /> {a.location}</div>

                                    {typeof a.assignedIncident === 'string' && (
                                        <div className="amb-assigned mt-1">
                                            <span className="assigned-label">Assigned:</span> <span className="assigned-val">{a.assignedIncident.length > 15 ? a.assignedIncident.substring(0, 8) : a.assignedIncident}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="amb-action-area">
                                    {a.verificationStatus === 'Pending' ? (
                                        <button className="approve-btn" onClick={(e) => { e.stopPropagation(); handleApprove(a.id); }}>
                                            Approve & Activate
                                        </button>
                                    ) : (a.status === 'En Route' || a.status === 'On Scene' || a.status === 'Transporting' || a.status === 'Arrived at Hospital') ? (
                                        <div className="amb-eta-strong" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <div>
                                                <span className="eta-label">⏱ ETA:</span>
                                                <span className="eta-value">{a.eta}</span>
                                            </div>
                                            {typeof a.assignedIncident === 'string' && (
                                                <button 
                                                    style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: '1px solid #3b82f6', backgroundColor: 'transparent', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/incident/${a.assignedIncident}`); }}
                                                >
                                                    <ExternalLink size={10} /> View Incident
                                                </button>
                                            )}
                                        </div>
                                    ) : (a.status === 'Available' || a.status === 'Offline') ? (
                                        <button 
                                            style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: a.status === 'Offline' ? '#22c55e' : '#f59e0b', color: '#fff' }}
                                            onClick={(e) => { e.stopPropagation(); handleToggleOffline(a.id, a.status); }}
                                        >
                                            {a.status === 'Offline' ? 'Set Available' : 'Set Offline'}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {filteredFleet.length === 0 && (
                            <div className="no-amb-results">No units found for this status.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Registration Modal */}
            {showRegisterModal && (
                <div className="registration-overlay">
                    <div className="registration-modal">
                        <div className="modal-header">
                            <div>
                                <h2>Register New Ambulance</h2>
                                <p>Authorized Authority Unit Registration</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowRegisterModal(false)}>×</button>
                        </div>

                        <form onSubmit={handleRegisterSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Vehicle Plate Number</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. WP ABC-1234"
                                        required
                                        value={formData.vehicleNumber}
                                        onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Ambulance Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="Basic">Basic Life Support (BLS)</option>
                                        <option value="Advanced">Advanced Life Support (ALS)</option>
                                        <option value="ICU">Mobile ICU / Critical Care</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Driver Name</label>
                                    <input
                                        type="text"
                                        placeholder="Full Name"
                                        required
                                        value={formData.driverName}
                                        onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Driver Contact</label>
                                    <input
                                        type="tel"
                                        placeholder="+94 7X XXX XXXX"
                                        required
                                        value={formData.driverPhone}
                                        onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                                    />
                                </div>
                                <div className="form-group full-width">
                                    <label>Base Station / Depot</label>
                                    <input
                                        type="text"
                                        placeholder="Assigned Station Name"
                                        required
                                        value={formData.station}
                                        onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-footer">
                                <button type="button" className="cancel-btn" onClick={() => setShowRegisterModal(false)}>Cancel</button>
                                <button type="submit" className={`submit-btn ${registrationSuccess ? 'success' : ''}`} disabled={isSubmitting}>
                                    {isSubmitting ? 'Verifying...' : registrationSuccess ? '✓ Unit Registered' : 'Register & Send for Verification'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
