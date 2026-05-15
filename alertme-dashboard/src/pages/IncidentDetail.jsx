import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, User, Play, Lock, AlertTriangle, Ambulance, X, CheckCircle, CheckSquare, Activity, Clock, Shield, Smartphone, Wifi, Eye, RadioIcon } from 'lucide-react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { useGoogleMaps, defaultCenter, darkMapStyle, MapFallback, buildMarkerIcons } from '../services/googleMapsConfig';
import apiClient from '../services/apiClient';
import SecureCommsModal from '../components/SecureCommsModal';
import { db } from '../services/firebaseClient';
import { ref, onValue, off } from 'firebase/database';
import './IncidentDetail.css';

export default function IncidentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const userRole = localStorage.getItem('userRole') || 'ADMIN';
    const canDispatch = ['ADMIN', 'MEDICAL'].includes(userRole);
    const canResolve = ['ADMIN', 'MEDICAL'].includes(userRole);
    const canUpdateFire = ['ADMIN', 'FIRE'].includes(userRole);
    const canUpdatePolice = ['ADMIN', 'POLICE'].includes(userRole);
    const { isLoaded, loadError } = useGoogleMaps();
    const markerIcons = useMemo(() => isLoaded ? buildMarkerIcons() : {}, [isLoaded]);

    const incidentData = {
        id: id || 'EMG-847291',
        type: 'Vehicle Accident',
        status: 'Active',
        severity: 'Critical',
        location: { address: 'Galle Road, Colombo 03', coords: '6.9034° N, 79.8515° E' },
        reporter: { name: 'Kamal Perera', phone: '+94 77 123 4567', type: 'Myself' },
        evidence: { hasPhoto: true, hasAudio: true, hasRecordedVideo: true, hasVideo: true },
        medicalData: {
            bloodGroup: 'O Negative (O-)',
            allergies: 'Penicillin, Peanuts',
            conditions: 'Hypertension',
            medications: 'Amlodipine 5mg',
            notes: 'Patient carries an EpiPen in left pocket.'
        }
    };

    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [selectedAmb, setSelectedAmb] = useState(null);
    const [dispatched, setDispatched] = useState(false);
    const [dispatchedUnit, setDispatchedUnit] = useState(null);
    const [incidentStatus, setIncidentStatus] = useState(incidentData.status);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showOutcomeModal, setShowOutcomeModal] = useState(false);
    const [showCommsModal, setShowCommsModal] = useState(false);
    const [incomingAction, setIncomingAction] = useState(null);
    const [showTransportModal, setShowTransportModal] = useState(false);
    const [hospitals, setHospitals] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState(null);
    const [hospitalSearch, setHospitalSearch] = useState('');
    const [selectedOutcome, setSelectedOutcome] = useState('');
    const [incidentOutcome, setIncidentOutcome] = useState(null);
    const [incidentSeverity, setIncidentSeverity] = useState(incidentData.severity);
    const [mapZoom, setMapZoom] = useState(1);
    const [availableAmbulances, setAvailableAmbulances] = useState([]);

    const [authResponses, setAuthResponses] = useState([]);
    const [realIncident, setRealIncident] = useState(null);
    const [evidences, setEvidences] = useState([]);
    const [activePhoto, setActivePhoto] = useState("/accident_scene.png");
    const [medicalProfile, setMedicalProfile] = useState(null);
    
    // Tactical Stream State
    const [tacticalStream, setTacticalStream] = useState({ active: false, timestamp: null });
    const [showStreamDelay, setShowStreamDelay] = useState(false);
    const [streamCurrentTime, setStreamCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: true }));

    const [reporterHistory, setReporterHistory] = useState([]);
    const [simulatedAmbLocation, setSimulatedAmbLocation] = useState(null);
    const simulatedAmbLocationRef = useRef(null); // sync ref so ETA calc avoids stale state

    // Manage dynamic select types
    const [incidentType, setIncidentType] = useState('OTHER');

    // Initial Live Incident Data Fetch
    useEffect(() => {
        const fetchIncidentAndFormatTimes = async () => {
            try {
                const res = await apiClient.get(`/incidents/${id}`);
                setRealIncident(res.data);
                setIncidentType(res.data.type || 'OTHER');

                if (res.data.status === 'REPORTED') {
                    setIncidentStatus('Active');
                } else {
                    setIncidentStatus(res.data.status.charAt(0).toUpperCase() + res.data.status.slice(1).toLowerCase());
                }

                // Map Severity
                if (res.data.severityScore === 5) setIncidentSeverity('Critical');
                else if (res.data.severityScore === 4) setIncidentSeverity('High');
                else if (res.data.severityScore === 3) setIncidentSeverity('Moderate');
                else if (res.data.severityScore === 2) setIncidentSeverity('Minor');
                else setIncidentSeverity('Low');

                // Fetch Medical Profile for the Reporter
                const cId = res.data.reporter?.citizenId || res.data.reporterId;
                if (cId) {
                    try {
                        const medRes = await apiClient.get(`/medical-profiles/citizen/${cId}`);
                        setMedicalProfile(medRes.data);
                    } catch (e) {
                        console.error("No medical data found for citizen", e);
                    }

                    try {
                        const histRes = await apiClient.get(`/incidents/reporter/${cId}`);
                        setReporterHistory(histRes.data.filter(i => i.incidentId !== id));
                    } catch (e) {
                        console.error("No reporter history found", e);
                    }
                }

                try {
                    const evRes = await apiClient.get(`/evidence/incident/${id}`);
                    console.log('Evidence API response:', evRes.data);
                    setEvidences(evRes.data || []);
                } catch (e) {
                    console.error("Evidence fetch failed:", e.response?.status, e.response?.data || e.message);
                }
            } catch (err) {
                console.error("Failed to load real incident info:", err);
            }
        };
        if (id) {
            fetchIncidentAndFormatTimes();
        }
    }, [id]);

    // Tactical Stream Firebase Listener & Clock
    useEffect(() => {
        if (!id) return;
        
        // RTDB Listener
        const streamRef = ref(db, `tactical_streams/${id}`);
        const unsubscribe = onValue(streamRef, (snapshot) => {
            const data = snapshot.val();
            if (data?.active) {
                // Simulate WebRTC connection delay (0.8s - 1.2s)
                setShowStreamDelay(true);
                setTimeout(() => {
                    setShowStreamDelay(false);
                    setTacticalStream({ active: true, timestamp: data.timestamp });
                }, 800 + Math.random() * 400); 
            } else {
                setTacticalStream({ active: false, timestamp: null });
            }
        });

        // Real-time HUD Clock
        const timer = setInterval(() => {
            setStreamCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: true }));
        }, 1000);

        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    }, [id]);

    // Tactical Comms Listener (Chat/Call sync)
    useEffect(() => {
        if (!id) return;
        
        const commsRef = ref(db, `tactical_comms/${id}`);
        const unsubscribe = onValue(commsRef, (snapshot) => {
            const data = snapshot.val();
            if (data?.active) {
                setIncomingAction(data.action);
                setShowCommsModal(true);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [id]);

    // Haversine formula — returns straight-line km, then corrected by road factor
    const ROAD_FACTOR = 1.3;   // Sri Lankan roads avg 30% longer than straight line
    const AVG_SPEED_KMH = 45;  // Realistic emergency vehicle speed on winding roads

    const haversineKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLon / 2) ** 2;
        // Multiply by ROAD_FACTOR to convert straight-line to road distance
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * ROAD_FACTOR;
    };

    const formatEta = (distanceKm) => {
        const totalMinutes = Math.round((distanceKm / AVG_SPEED_KMH) * 60);
        if (totalMinutes >= 60) {
            const hrs = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
        }
        return `${Math.max(2, totalMinutes)} min`;
    };

    // Converts backend estimatedEtaSeconds into a human-readable string
    const formatEtaSeconds = (seconds) => {
        if (!seconds || seconds <= 0) return 'N/A';
        const totalMinutes = Math.round(seconds / 60);
        if (totalMinutes >= 60) {
            const hrs = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
        }
        return `${Math.max(2, totalMinutes)} min`;
    };

    useEffect(() => {
        const fetchAmbulances = async () => {
            try {
                const res = await apiClient.get('/ambulances');
                const incLat = realIncident?.latitude;
                const incLng = realIncident?.longitude;

                // Filter only available ambulances that have a known location
                const availableRaw = res.data.filter(a =>
                    (a.currentStatus || '').toUpperCase() === 'AVAILABLE' &&
                    a.currentLocation?.latitude &&
                    a.currentLocation?.longitude
                );

                if (availableRaw.length === 0) {
                    setAvailableAmbulances([]);
                    return;
                }

                // Helper to format driving duration in minutes
                const formatDrivingTime = (seconds) => {
                    const mins = Math.round(seconds / 60);
                    if (mins >= 60) {
                        const hrs = Math.floor(mins / 60);
                        const rem = mins % 60;
                        return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
                    }
                    return `${Math.max(2, mins)} min`;
                };

                // Try Google Maps Distance Matrix API (real road distances + actual travel time)
                const mapsReady = window.google?.maps?.DistanceMatrixService && incLat && incLng;

                if (mapsReady) {
                    const service = new window.google.maps.DistanceMatrixService();
                    const origins = availableRaw.map(a => ({
                        lat: a.currentLocation.latitude,
                        lng: a.currentLocation.longitude
                    }));

                    service.getDistanceMatrix({
                        origins,
                        destinations: [{ lat: incLat, lng: incLng }],
                        travelMode: window.google.maps.TravelMode.DRIVING,
                        unitSystem: window.google.maps.UnitSystem.METRIC,
                    }, (response, status) => {
                        const processed = availableRaw.map((a, i) => {
                            const element = response?.rows?.[i]?.elements?.[0];
                            let distanceKm = null;
                            let etaStr = 'N/A';
                            let distanceStr = 'N/A';

                            if (status === 'OK' && element?.status === 'OK') {
                                // Real road distance from Google Maps
                                distanceKm = element.distance.value / 1000;
                                // Real driving time from Google Maps (not calculated)
                                etaStr = formatDrivingTime(element.duration.value);
                                distanceStr = distanceKm.toFixed(1) + ' km';
                            } else {
                                // Fallback: road-corrected Haversine
                                const ambLat = a.currentLocation.latitude;
                                const ambLng = a.currentLocation.longitude;
                                distanceKm = haversineKm(ambLat, ambLng, incLat, incLng);
                                etaStr = formatEta(distanceKm);
                                distanceStr = distanceKm.toFixed(1) + ' km*'; // * = estimated
                            }

                            return {
                                id: a.vehicleId,
                                crew: a.crewName || 'Assigned Driver',
                                location: a.stationName || 'Central Hub',
                                eta: etaStr,
                                status: 'Available',
                                distance: distanceStr,
                                distanceKm: distanceKm ?? 9999,
                                type: a.capabilityType || 'BASIC'
                            };
                        });
                        setAvailableAmbulances(processed);
                    });
                } else {
                    // Maps API not ready — use road-corrected Haversine as fallback
                    const avail = availableRaw.map(a => {
                        const ambLat = a.currentLocation.latitude;
                        const ambLng = a.currentLocation.longitude;
                        let distanceKm = null, etaStr = 'N/A', distanceStr = 'N/A';
                        if (incLat && incLng) {
                            distanceKm = haversineKm(ambLat, ambLng, incLat, incLng);
                            etaStr = formatEta(distanceKm);
                            distanceStr = distanceKm.toFixed(1) + ' km*';
                        }
                        return {
                            id: a.vehicleId,
                            crew: a.crewName || 'Assigned Driver',
                            location: a.stationName || 'Central Hub',
                            eta: etaStr,
                            status: 'Available',
                            distance: distanceStr,
                            distanceKm: distanceKm ?? 9999,
                            type: a.capabilityType || 'BASIC'
                        };
                    });
                    setAvailableAmbulances(avail);
                }
            } catch (err) {
                console.error("Failed to fetch ambulances", err);
            }
        };

        if (showDispatchModal) {
            fetchAmbulances();
        }
    }, [showDispatchModal, realIncident]);

    useEffect(() => {
        const fetchResponses = async () => {
            try {
                const res = await apiClient.get(`/incidents/${id}/authority-response`);
                // Auto-initialize if no authority responses exist yet (so FIRE/POLICE can see their section)
                if (!res.data || res.data.length === 0) {
                    try {
                        const initRes = await apiClient.post(`/incidents/${id}/authority-response/initialize`);
                        setAuthResponses(initRes.data || []);
                    } catch (initErr) {
                        console.warn("Could not auto-initialize authority responses:", initErr);
                        setAuthResponses([]);
                    }
                } else {
                    setAuthResponses(res.data);
                }
            } catch (err) {
                console.error("Failed to fetch authority responses", err);
                setAuthResponses([]);
            }
        };
        if (id) fetchResponses();
    }, [id]);

    // Restore dispatched unit from backend dispatch log (survives page refresh)
    useEffect(() => {
        const fetchDispatchLog = async () => {
            try {
                const res = await apiClient.get(`/dispatch-logs/incident/${id}`);
                const logs = res.data || [];
                const active = logs.find(l => ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'ON_SCENE', 'TRANSPORTING'].includes(l.status));
                if (active) {
                    const amb = active.ambulance || {};
                    let dynamicEtaStr = formatEtaSeconds(active.estimatedEtaSeconds);
                    
                    if (active.status === 'ARRIVED' || active.status === 'ON_SCENE') {
                        dynamicEtaStr = '0 min';
                    } else if (active.status === 'TRANSPORTING' && realIncident) {
                        // Use time-based progress to simulate ambulance driving to hospital
                        const sceneLat = realIncident.latitude;
                        const sceneLng = realIncident.longitude;
                        // Fallback to a generic 5.5km away point if the hospital lacks GPS coordinates
                        const hospLat = active.destinationHospitalLat || (sceneLat + 0.05);
                        const hospLng = active.destinationHospitalLng || (sceneLng + 0.05);

                        const startMs = active.updatedAt ? new Date(active.updatedAt).getTime() : Date.now();
                        const elapsedSec = (Date.now() - startMs) / 1000;
                        const speedKmPerSec = 0.111; // Matches fleet map (approx 400 km/h simulation)
                        const totalDistKm = haversineKm(sceneLat, sceneLng, hospLat, hospLng);
                        
                        const progress = totalDistKm > 0.001 ? Math.min(1, (elapsedSec * speedKmPerSec) / totalDistKm) : 1;
                        
                        const curLat = sceneLat + (hospLat - sceneLat) * progress;
                        const curLng = sceneLng + (hospLng - sceneLng) * progress;
                        
                        if (progress >= 1) {
                            dynamicEtaStr = '0 min';
                            active.status = 'ARRIVED_AT_HOSPITAL'; // Override local status for rendering
                        } else {
                            const remainingDist = totalDistKm * (1 - progress);
                            dynamicEtaStr = formatEtaSeconds(Math.max(120, Math.round((remainingDist / AVG_SPEED_KMH) * 3600)));
                        }

                        // Update ref + state synchronously before setDispatchedUnit reads dynamicEtaStr
                        simulatedAmbLocationRef.current = { lat: curLat, lng: curLng };
                        setSimulatedAmbLocation({ lat: curLat, lng: curLng });
                    } else if (amb.currentLocation && realIncident) {
                        // EN_ROUTE: ambulance driving from base station to incident
                        const dist = haversineKm(
                            amb.currentLocation.latitude, 
                            amb.currentLocation.longitude, 
                            realIncident.latitude, 
                            realIncident.longitude
                        );
                        dynamicEtaStr = formatEtaSeconds(Math.max(120, Math.round((dist / AVG_SPEED_KMH) * 3600)));
                    }

                    setDispatchedUnit({
                        id: amb.vehicleId || active.vehicleId,
                        dispatchId: active.dispatchId,
                        crew: amb.crewName || 'Assigned Unit',
                        eta: dynamicEtaStr,
                        dispatchStatus: active.status === 'ARRIVED' ? 'ON_SCENE' : active.status, // Can be EN_ROUTE, ON_SCENE, TRANSPORTING, ARRIVED_AT_HOSPITAL
                        destinationHospitalName: active.destinationHospitalName,
                        destinationHospitalAddress: active.destinationHospitalAddress,
                    });
                    setDispatched(true);
                    setIncidentStatus('Dispatched');
                }
            } catch (err) {
                // No dispatch log yet — that's fine
            }
        };
        if (id) {
            fetchDispatchLog();
            const intervalId = setInterval(fetchDispatchLog, 5000);
            return () => clearInterval(intervalId);
        }
    }, [id, realIncident]);

    // Fetch hospitals list when transport modal opens (ADMIN/MEDICAL only)
    useEffect(() => {
        if (!showTransportModal) return;
        apiClient.get('/hospitals')
            .then(res => {
                const fetched = res.data || [];
                const incLat = realIncident?.latitude || 6.9034;
                const incLng = realIncident?.longitude || 79.8515;
                
                const withDistance = fetched.map(h => {
                    // Make sure hospital has coordinates
                    if (!h.latitude || !h.longitude) return { ...h, distanceKm: 9999, distanceStr: '' };
                    const distance = haversineKm(h.latitude, h.longitude, incLat, incLng);
                    return { ...h, distanceKm: distance, distanceStr: distance.toFixed(1) + ' km' };
                });
                
                withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
                setHospitals(withDistance);
            })
            .catch(err => console.error('Failed to fetch hospitals', err));
    }, [showTransportModal, realIncident]);

    const handleAuthStatusUpdate = async (respId, newStatus) => {
        try {
            await apiClient.patch(`/authority-response/${respId}/status`, { status: newStatus });
            setAuthResponses(prev => prev.map(r => r.id === respId ? { ...r, status: newStatus } : r));
            showToast(`${newStatus} status updated`);
        } catch (e) {
            console.error(e);
            showToast('Failed to update authority status', 'error');
        }
    };

    const getSeverityScore = (severityStr) => {
        switch (severityStr) {
            case 'Critical': return 5;
            case 'High': return 4;
            case 'Medium': return 3;
            case 'Low': return 1;
            default: return 3;
        }
    };

    const getRecommendationScore = (amb, severityStr) => {
        const severity = getSeverityScore(severityStr);
        const distance = amb.distanceKm ?? 9999; // use real distance in km
        let score = distance;

        if (severity >= 4) {
            if (amb.type === 'ICU') score -= 50;
            else if (amb.type === 'Advanced') score -= 20;
            else if (amb.type === 'Basic') score += 100;
        } else if (severity <= 2) {
            if (amb.type === 'Basic') score -= 20;
            else if (amb.type === 'Advanced') score += 50;
            else if (amb.type === 'ICU') score += 150;
        }
        return score;
    };

    const zoomIn = () => setMapZoom(z => Math.min(3, parseFloat((z + 0.25).toFixed(2))));
    const zoomOut = () => setMapZoom(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))));
    const gridSize = Math.round(30 * mapZoom);
    const markerScale = Math.max(0.6, Math.min(1.4, mapZoom));

    const showMedicalProfile = incidentStatus === 'Active' && incidentData.reporter.type === 'Myself';

    const outcomeOptions = ['Hospitalized', 'Treated on Scene', 'ICU Admission', 'Refused Treatment', 'False Alarm', 'Other'];

    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const formatTimeStr = (isoString, addMinutes = 0) => {
        if (!isoString) return '2:14 PM';
        const d = new Date(isoString);
        d.setMinutes(d.getMinutes() + addMinutes);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const reportedTime = realIncident ? formatTimeStr(realIncident.reportedAt) : '2:14 PM';
    const locTime = realIncident ? formatTimeStr(realIncident.reportedAt, 0) : '2:14 PM';
    const evidenceTime = realIncident ? formatTimeStr(realIncident.reportedAt, 2) : '2:16 PM';
    const dispatchTime = realIncident ? formatTimeStr(realIncident.reportedAt, 4) : '2:18 PM';
    const onSceneTime = realIncident ? formatTimeStr(realIncident.reportedAt, 12) : '2:26 PM';
    const transportTime = realIncident ? formatTimeStr(realIncident.reportedAt, 15) : '2:29 PM';
    const arriveHospTime = realIncident ? formatTimeStr(realIncident.reportedAt, 25) : '2:39 PM';
    const resolveTime = realIncident ? formatTimeStr(realIncident.reportedAt, 27) : '2:41 PM';

    const hasReached = (statuses) => dispatchedUnit && statuses.includes(dispatchedUnit.dispatchStatus);

    const timeline = [
        { time: reportedTime, label: 'Alert received', detail: 'Reported via AlertMe Mobile App' },
        { time: locTime, label: 'Location captured', detail: `GPS: ${realIncident ? `${realIncident.latitude.toFixed(4)}° N, ${realIncident.longitude.toFixed(4)}° E` : '6.9034° N, 79.8515° E'} · Accuracy ±5m` },
        ...(evidences && evidences.length > 0 ? [{ time: evidences[0]?.uploadedAt ? formatTimeStr(evidences[0].uploadedAt, 0) : evidenceTime, label: 'Evidence uploaded', detail: `${evidences.length} media file${evidences.length > 1 ? 's' : ''} submitted` }] : []),
        ...(incidentStatus !== 'Active' ? [{ time: dispatchTime, label: 'Ambulance dispatched', detail: dispatchedUnit ? `${dispatchedUnit.id} – ${dispatchedUnit.crew}` : 'Unit assigned globally' }] : []),
        
        ...((hasReached(['ON_SCENE', 'TRANSPORTING', 'ARRIVED_AT_HOSPITAL']) || incidentStatus === 'Resolved') 
            ? [{ time: onSceneTime, label: 'Unit arrived on scene', detail: 'Medical personnel responding' }] : []),
            
        ...((hasReached(['TRANSPORTING', 'ARRIVED_AT_HOSPITAL']) || (incidentStatus === 'Resolved' && dispatchedUnit?.destinationHospitalName))
            ? [{ time: transportTime, label: 'Transporting patient', detail: `En route to ${dispatchedUnit?.destinationHospitalName || 'hospital'}` }] : []),
            
        ...(hasReached(['ARRIVED_AT_HOSPITAL']) || (incidentStatus === 'Resolved' && dispatchedUnit?.destinationHospitalName)
            ? [{ time: arriveHospTime, label: 'Arrived at hospital', detail: 'Patient safely delivered' }] : []),
            
        ...(incidentStatus === 'Resolved' ? [{ time: resolveTime, label: 'Incident resolved', detail: incidentOutcome || 'Outcome recorded securely' }] : []),
    ];

    const handleResolve = async () => {
        if (!selectedOutcome) return;
        try {
            await apiClient.patch(`/incidents/${id}/status`, { status: "RESOLVED", outcome: selectedOutcome });
            setIncidentOutcome(selectedOutcome);
            setIncidentStatus('Resolved');
            setShowOutcomeModal(false);
            showToast('Incident marked as resolved securely on the backend');
        } catch (error) {
            console.error("Resolution sync failed:", error);
            showToast('Failed to trigger database resolution', 'error');
        }
    };

    const updateStatus = async (newStatus) => {
        try {
            const dbStatus = newStatus === 'Active' ? 'REPORTED' : newStatus.toUpperCase();
            await apiClient.patch(`/incidents/${id}/status`, { status: dbStatus });
            setIncidentStatus(newStatus);
            if (newStatus === 'Dispatched') showToast('Status updated globally: Ambulance Dispatched');
        } catch (error) {
            console.error(error);
            showToast('Status update failed on the server', 'error');
        }
    };

    const handleDispatch = async () => {
        if (!selectedAmb) return;
        try {
            const res = await apiClient.post(`/incidents/${id}/dispatch`, null, {
                params: { vehicleId: selectedAmb.id }
            });
            // Use the backend's calculated ETA (Haversine-based) from the dispatch log response
            const backendEta = res.data?.estimatedEtaSeconds
                ? formatEtaSeconds(res.data.estimatedEtaSeconds)
                : selectedAmb.eta; // fallback to client-side estimate
            const unitWithRealEta = { ...selectedAmb, eta: backendEta };
            setDispatchedUnit(unitWithRealEta);
            setDispatched(true);
            setIncidentStatus('Dispatched');
            showToast(`Ambulance ${selectedAmb.id} globally dispatched!`);
            setTimeout(() => {
                setShowDispatchModal(false);
                setDispatched(false);
                setSelectedAmb(null);
            }, 2000);
        } catch (err) {
            console.error("Manual Dispatch Failed:", err);
            showToast('Server Dispatch Validation Failed', 'error');
        }
    };

    const lat = realIncident?.latitude || 6.9034;
    const lng = realIncident?.longitude || 79.8515;
    const displayId = incidentData.id.length > 15 ? incidentData.id.substring(0, 8).toUpperCase() : incidentData.id;

    // If the stored address is the old SOS system label, show GPS coords instead
    const isSosLabel = (addr) => addr && (addr.includes('SOS Push Detection') || addr.includes('Immediate SOS'));
    const displayAddress = realIncident
        ? (isSosLabel(realIncident.approximateAddress)
            ? `${realIncident.latitude?.toFixed(4)}°N, ${realIncident.longitude?.toFixed(4)}°E`
            : realIncident.approximateAddress || incidentData.location.address)
        : incidentData.location.address;

    return (
        <div className="incident-detail-page">
            {/* Photo Lightbox Modal */}
            {showPhotoModal && (
                <div className="modal-backdrop" onClick={() => setShowPhotoModal(false)}>
                    <div className="photo-lightbox" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn lightbox-close" onClick={() => setShowPhotoModal(false)}>
                            <X size={20} />
                        </button>
                        <img src={activePhoto} alt="Accident Scene" className="lightbox-img" />
                        <div className="lightbox-caption">Uploaded by Reporter</div>
                    </div>
                </div>
            )}

            {/* Assign Ambulance Modal */}
            {showDispatchModal && (
                <div className="modal-backdrop" onClick={() => setShowDispatchModal(false)}>
                    <div className="modal-panel" onClick={e => e.stopPropagation()}>
                        {dispatched ? (
                            <div className="dispatch-success">
                                <CheckCircle size={48} className="success-icon" />
                                <h3>Ambulance Dispatched!</h3>
                                <p><strong>{dispatchedUnit.id} – {dispatchedUnit.crew}</strong></p>
                                <p>ETA: {dispatchedUnit.eta} to {displayAddress}</p>
                            </div>
                        ) : (
                            <>
                                <div className="modal-header">
                                    <h3><Ambulance size={20} /> Assign Ambulance</h3>
                                    <button className="modal-close-btn" onClick={() => setShowDispatchModal(false)}>
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="modal-incident-info">
                                    <MapPin size={14} />
                                    <span>Incident <strong>{displayId}</strong> — {displayAddress}</span>
                                </div>
                                <p className="modal-label">Select an available unit:</p>
                                <div className="amb-select-list">
                                    {/* Smart Recommendation */}
                                    {[...availableAmbulances].sort((a, b) => getRecommendationScore(a, incidentSeverity) - getRecommendationScore(b, incidentSeverity)).map((amb, idx) => (
                                        <div
                                            key={amb.id}
                                            className={`amb-select-item ${selectedAmb?.id === amb.id ? 'selected' : ''} ${idx === 0 ? 'amb-recommended' : ''}`}
                                            onClick={() => setSelectedAmb(amb)}
                                        >
                                            <div className="amb-select-icon">
                                                <Ambulance size={20} />
                                            </div>
                                            <div className="amb-select-info">
                                                <div className="amb-id-row">
                                                    <strong>{amb.id}</strong> <span className="type-tag-mini">{amb.type}</span> — {amb.crew}
                                                    {idx === 0 && <span className="recommended-badge" title="Best Fit: highest-capability unit nearest to incident, weighted by severity score">⭐ Best Fit for Severity</span>}
                                                </div>
                                                <div className="amb-select-sub">
                                                    <MapPin size={12} /> {amb.location} • {amb.distance}
                                                </div>
                                            </div>
                                            <div className="amb-select-eta">
                                                {amb.eta}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="modal-footer">
                                    <button className="modal-cancel-btn" onClick={() => setShowDispatchModal(false)}>Cancel</button>
                                    <button
                                        className={`modal-dispatch-btn ${!selectedAmb ? 'disabled' : ''}`}
                                        onClick={handleDispatch}
                                        disabled={!selectedAmb}
                                    >
                                        <Ambulance size={16} /> Dispatch Now
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Outcome Selection Modal */}
            {showOutcomeModal && (
                <div className="modal-backdrop" onClick={() => setShowOutcomeModal(false)}>
                    <div className="modal-panel outcome-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><CheckSquare size={20} /> Select Incident Outcome</h3>
                            <button className="modal-close-btn" onClick={() => setShowOutcomeModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <p className="modal-label" style={{ paddingTop: '20px' }}>What was the final outcome of this incident?</p>
                        <div className="amb-select-list" style={{ maxHeight: 'none', paddingBottom: '24px' }}>
                            {outcomeOptions.map(outcome => (
                                <div
                                    key={outcome}
                                    className={`amb-select-item ${selectedOutcome === outcome ? 'selected' : ''}`}
                                    onClick={() => setSelectedOutcome(outcome)}
                                >
                                    <div className="amb-select-info">
                                        <strong>{outcome}</strong>
                                    </div>
                                    {selectedOutcome === outcome && <CheckCircle size={18} className="text-success" />}
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer">
                            <button className="modal-cancel-btn" onClick={() => setShowOutcomeModal(false)}>Cancel</button>
                            <button
                                className={`modal-dispatch-btn ${!selectedOutcome ? 'disabled' : ''}`}
                                onClick={handleResolve}
                                disabled={!selectedOutcome}
                            >
                                <CheckSquare size={16} /> Confirm Resolution
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transport to Hospital Modal — ADMIN/MEDICAL only */}
            {showTransportModal && canDispatch && (
                <div className="modal-backdrop" onClick={() => setShowTransportModal(false)}>
                    <div className="modal-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🏥 Transport Patient to Hospital</h3>
                            <button className="modal-close-btn" onClick={() => setShowTransportModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <p className="modal-label" style={{ paddingTop: '16px' }}>Select destination hospital:</p>
                        <div style={{ marginBottom: '12px' }}>
                            <input 
                                type="text" 
                                placeholder="Search hospitals by name or district..." 
                                value={hospitalSearch}
                                onChange={(e) => setHospitalSearch(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: '13px', outline: 'none' }}
                            />
                        </div>
                        <div className="amb-select-list" style={{ maxHeight: '320px' }}>
                            {hospitals.length === 0 ? (
                                <p style={{ color: '#94a3b8', padding: '12px', fontSize: '13px' }}>Loading hospitals...</p>
                            ) : hospitals.filter(h => h.name.toLowerCase().includes(hospitalSearch.toLowerCase()) || h.district.toLowerCase().includes(hospitalSearch.toLowerCase())).map((h, idx) => (
                                <div
                                    key={h.hospitalId}
                                    className={`amb-select-item ${selectedHospital?.hospitalId === h.hospitalId ? 'selected' : ''}`}
                                    onClick={() => setSelectedHospital(h)}
                                >
                                    <div className="amb-select-info">
                                        <div className="amb-id-row">
                                            <strong>🏥 {h.name}</strong>
                                            <span className="type-tag-mini">{h.type}</span>
                                        </div>
                                        <div className="amb-select-sub">
                                            <MapPin size={12} /> {h.address} · {h.district}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                        {h.distanceStr && <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>{h.distanceStr}</span>}
                                        {selectedHospital?.hospitalId === h.hospitalId && <CheckCircle size={18} style={{ color: '#2ecc71' }} />}
                                        {idx === 0 && !hospitalSearch && <span style={{ fontSize: '10px', background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(46,204,113,0.3)' }}>Nearest</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer">
                            <button className="modal-cancel-btn" onClick={() => setShowTransportModal(false)}>Cancel</button>
                            <button
                                className={`modal-dispatch-btn ${!selectedHospital ? 'disabled' : ''}`}
                                disabled={!selectedHospital}
                                onClick={async () => {
                                    try {
                                        const res = await apiClient.get(`/dispatch-logs/incident/${id}`);
                                        const active = (res.data || []).find(l => l.status === 'ARRIVED' || l.status === 'ON_SCENE');
                                        if (active) {
                                            await apiClient.patch(`/dispatch-logs/${active.dispatchId}/transport?hospitalId=${selectedHospital.hospitalId}`);
                                            setDispatchedUnit(prev => ({
                                                ...prev,
                                                dispatchStatus: 'TRANSPORTING',
                                                destinationHospitalName: selectedHospital.name,
                                                destinationHospitalAddress: selectedHospital.address,
                                            }));
                                            showToast(`Transporting patient to ${selectedHospital.name}`);
                                            setShowTransportModal(false);
                                            setSelectedHospital(null);
                                        } else {
                                            showToast('Ambulance must be On Scene first', 'error');
                                        }
                                    } catch (e) {
                                        console.error(e);
                                        showToast('Failed to update transport status', 'error');
                                    }
                                }}
                            >
                                🚑 Confirm Transport
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`id-toast id-toast-${toast.type}`}>
                    <CheckCircle size={16} /> {toast.msg}
                </div>
            )}

            <div className="detail-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
                <div className="header-title-area">
                    <div>
                        <h1>Incident {displayId}</h1>
                        <div className="header-meta-row">
                            <span className={`status-badge-large status-${incidentStatus.toLowerCase()}`}>{incidentStatus}</span>
                            <span className="severity-badge-inline">🔴 {incidentSeverity}</span>
                            <span className="reported-time"><Clock size={13} /> Reported at {reportedTime}</span>
                        </div>
                    </div>
                    <button className="dispatch-action-btn-inline" onClick={() => setShowDispatchModal(true)}>
                        <Ambulance size={16} /> Assign Ambulance
                    </button>
                </div>
            </div>

            {/* Emergency Alert Strip */}
            <div className="emergency-alert-strip">
                <div className="strip-icon">🚨</div>
                <div className="strip-text">
                    <strong>ACTIVE EMERGENCY</strong>
                    <span>IMMEDIATE RESPONSE REQUIRED &nbsp;·&nbsp; {realIncident ? realIncident.type : 'Vehicle Accident'} · {displayAddress}</span>
                </div>
                <span className="strip-severity">{incidentSeverity.toUpperCase()}</span>
            </div>

            {/* Large Map Header */}
            <div className="incident-map-banner">
                {!isLoaded || loadError ? (
                    <MapFallback error={loadError} height="350px" />
                ) : (
                    <GoogleMap
                        center={{ lat, lng }}
                        zoom={15}
                        mapContainerStyle={{ height: '350px', width: '100%' }}
                        options={{ styles: darkMapStyle, disableDefaultUI: true, zoomControl: true }}
                    >
                        <MarkerF
                            position={{ lat, lng }}
                            icon={markerIcons.incident}
                        />
                        <div className="coords-overlay" style={{ zIndex: 1000 }}>
                            <span><MapPin size={14} /> {displayAddress}</span>
                            <strong>GPS: {lat.toFixed(4)}° N, {lng.toFixed(4)}° E</strong>
                        </div>
                    </GoogleMap>
                )}
            </div>

            <div className="detail-layout">
                {/* Left Column */}
                <div className="layout-col main-col">
                    <div className="card info-card">
                        <div className="card-header">
                            <h3><Activity size={18} /> Incident Details</h3>
                        </div>
                        <div className="info-list">
                            <div className="info-item">
                                <span className="info-label"><AlertTriangle size={13} /> Type</span>
                                <select
                                    className="severity-select type-box"
                                    value={incidentType}
                                    style={{ borderColor: 'transparent', marginLeft: '-5px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', outline: 'none' }}
                                    onChange={(e) => setIncidentType(e.target.value)}
                                >
                                    <option value="ACCIDENT" style={{ color: '#000' }}>🚗 Vehicle Accident</option>
                                    <option value="MEDICAL" style={{ color: '#000' }}>🚑 Medical Emergency</option>
                                    <option value="FIRE" style={{ color: '#000' }}>🔥 Fire Hazard</option>
                                    <option value="CRIME" style={{ color: '#000' }}>🔪 Crime/Assault</option>
                                    <option value="NATURAL_DISASTER" style={{ color: '#000' }}>🌪️ Natural Disaster</option>
                                    <option value="SOS" style={{ color: '#000' }}>🆘 SOS Fast Push</option>
                                    <option value="OTHER" style={{ color: '#000' }}>❓ Unknown / Other</option>
                                </select>
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Shield size={13} /> Severity</span>
                                <select
                                    className={`severity-select severity-${incidentSeverity.toLowerCase()}`}
                                    value={incidentSeverity}
                                    onChange={(e) => setIncidentSeverity(e.target.value)}
                                >
                                    <option value="Critical">🔴 Critical</option>
                                    <option value="High">🟠 High</option>
                                    <option value="Moderate">🟡 Moderate</option>
                                    <option value="Minor">🟢 Minor</option>
                                    <option value="Low">⚪ Low</option>
                                </select>
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Clock size={13} /> Reported</span>
                                <span className="info-value text-white">{reportedTime}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label"><MapPin size={13} /> Location</span>
                                <span className="info-value text-white">{displayAddress}</span>
                            </div>
                            {incidentOutcome && (
                                <div className="info-item border-success-left bg-success-subtle border-t">
                                    <span className="info-label text-success">Final Outcome</span>
                                    <span className="info-value text-success"><strong>{incidentOutcome}</strong></span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 📹 TACTICAL LIVE STREAM (PROTOTYPE) */}
                    <div className="card info-card tactical-stream-card" style={{ marginBottom: '20px', borderColor: tacticalStream.active ? '#e74c3c' : '#334155' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RadioIcon size={18} color={tacticalStream.active ? "#e74c3c" : "#94a3b8"} />
                                <h3>Tactical Live Feed</h3>
                            </div>
                            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#f59e0b' }}>PROTOTYPE MODE - SIMULATION</span>
                            </div>
                        </div>
                        
                        <div className="tactical-video-container" style={{ position: 'relative', width: '100%', height: '260px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {!tacticalStream.active && !showStreamDelay && (
                                <div style={{ color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <Eye size={36} opacity={0.4} />
                                    <span style={{ fontSize: '13px' }}>Waiting for field unit to start stream...</span>
                                </div>
                            )}

                            {showStreamDelay && (
                                <div style={{ color: '#3b82f6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div className="spinner" style={{ width: '28px', height: '28px', border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                    <span style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }}>ESTABLISHING SECURE WEBRTC CONNECTION...</span>
                                </div>
                            )}

                            {tacticalStream.active && !showStreamDelay && (
                                <>
                                    <video 
                                        src="https://cdn.pixabay.com/video/2021/08/04/83907-584742749_tiny.mp4" 
                                        autoPlay 
                                        loop 
                                        muted 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                                    />
                                    {/* Advanced HUD Overlay */}
                                    <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(231, 76, 60, 0.9)', padding: '4px 8px', borderRadius: '4px' }}>
                                            <div className="live-dot" style={{ width: '8px', height: '8px', backgroundColor: '#fff', borderRadius: '50%', animation: 'pulse 1s infinite alternate' }}></div>
                                            <span style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>LIVE</span>
                                        </div>
                                        <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px' }}>
                                            <span style={{ color: '#2ecc71', fontSize: '11px', fontWeight: 'bold' }}>📶 STRONG</span>
                                        </div>
                                    </div>
                                    <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px' }}>
                                        <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>{streamCurrentTime}</span>
                                    </div>
                                    <div style={{ position: 'absolute', bottom: '12px', left: '12px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px' }}>
                                        <span style={{ color: '#fff', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '1px' }}>TACTICAL FEED – INCIDENT #{id?.split('-')[1] || '1023'}</span>
                                    </div>
                                    {/* HUD Brackets */}
                                    <div style={{ position: 'absolute', top: '25%', left: '25%', width: '20px', height: '20px', borderTop: '2px solid rgba(255,255,255,0.3)', borderLeft: '2px solid rgba(255,255,255,0.3)' }}></div>
                                    <div style={{ position: 'absolute', top: '25%', right: '25%', width: '20px', height: '20px', borderTop: '2px solid rgba(255,255,255,0.3)', borderRight: '2px solid rgba(255,255,255,0.3)' }}></div>
                                    <div style={{ position: 'absolute', bottom: '25%', left: '25%', width: '20px', height: '20px', borderBottom: '2px solid rgba(255,255,255,0.3)', borderLeft: '2px solid rgba(255,255,255,0.3)' }}></div>
                                    <div style={{ position: 'absolute', bottom: '25%', right: '25%', width: '20px', height: '20px', borderBottom: '2px solid rgba(255,255,255,0.3)', borderRight: '2px solid rgba(255,255,255,0.3)' }}></div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="card evidence-card">
                        <div className="card-header"><h3>Uploaded Evidence</h3></div>
                        <div className="evidence-grid">
                            {evidences.length === 0 ? (
                                <p style={{ color: '#94a3b8', padding: '10px', fontSize: '13px' }}>No evidence uploaded for this incident yet.</p>
                            ) : evidences.map(ev => {
                                if (ev.mediaType === 'TEXT' || ev.mediaType === 'DESCRIPTION') {
                                    return (
                                        <div key={ev.evidenceId} className="evidence-box text-box">
                                            <div className="video-header">
                                                <div className="video-icon-wrap" style={{ backgroundColor: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f' }}>
                                                    <AlertTriangle size={16} />
                                                </div>
                                                <span className="evidence-name">Reporter Description</span>
                                            </div>
                                            <div style={{ padding: '12px 14px', backgroundColor: 'rgba(51, 65, 85, 0.35)', border: '1px solid #334155', borderRadius: '8px', fontSize: '13.5px', lineHeight: '1.6', color: '#cbd5e1', fontStyle: 'italic' }}>
                                                &ldquo;{ev.storageUrl}&rdquo;
                                            </div>
                                        </div>
                                    );
                                }
                                if (ev.mediaType === 'PHOTO') {
                                    return (
                                        <div key={ev.evidenceId} className="evidence-box photo-box" onClick={() => { setActivePhoto(ev.storageUrl); setShowPhotoModal(true); }}>
                                            <div className="photo-thumb-wrapper">
                                                <img src={ev.storageUrl} alt="Evidence" className="evidence-thumb" />
                                                <div className="photo-overlay"><Eye size={18} /><span>View</span></div>
                                            </div>
                                            <div className="evidence-meta">
                                                <span className="evidence-name">Photo Evidence</span>
                                            </div>
                                        </div>
                                    );
                                }
                                if (ev.mediaType === 'VIDEO') {
                                    return (
                                        <div key={ev.evidenceId} className="evidence-box video-box">
                                            <div className="video-header">
                                                <div className="video-icon-wrap"><Play size={16} /></div>
                                                <span className="evidence-name">Recorded Video</span>
                                            </div>
                                            <video controls className="video-player-real">
                                                <source src={ev.storageUrl} type="video/mp4" />
                                                Your browser does not support HTML video.
                                            </video>
                                        </div>
                                    );
                                }
                                if (ev.mediaType === 'AUDIO') {
                                    return (
                                        <div key={ev.evidenceId} className="evidence-box audio-box">
                                            <div className="audio-header">
                                                <div className="audio-icon-wrap"><Play size={16} /></div>
                                                <span className="evidence-name">Voice Recording</span>
                                            </div>
                                            <audio controls className="audio-player-real"><source src={ev.storageUrl} type="audio/mpeg" /></audio>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>

                    <div className="card reporter-card">
                        <div className="card-header"><h3><User size={18} /> Reporter Information</h3></div>
                        <div className="info-list">
                            <div className="info-item">
                                <span className="info-label"><User size={13} /> Name</span>
                                <span className="info-value">{realIncident?.reporterName || realIncident?.reporter?.name || "Anonymous / Unregistered"}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Phone size={13} /> Phone</span>
                                <span className="info-value">{realIncident?.reporterPhone || realIncident?.reporter?.phoneNumber || "Not Provided"}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Smartphone size={13} /> Reported via</span>
                                <span className="info-value">AlertMe Mobile App</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Clock size={13} /> Time Submitted</span>
                                <span className="info-value">{reportedTime}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label"><Wifi size={13} /> GPS Accuracy</span>
                                <span className="info-value text-success">±5 metres</span>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="card timeline-card">
                        <div className="card-header"><h3><Clock size={18} /> Incident Timeline</h3></div>
                        <div className="timeline-list">
                            {timeline.map((item, i) => (
                                <div key={i} className={`timeline-item ${i === timeline.length - 1 ? 'last' : ''}`}>
                                    <div className="timeline-dot"></div>
                                    <div className="timeline-content">
                                        <div className="timeline-header-row">
                                            <span className="timeline-label">{item.label}</span>
                                            <span className="timeline-time">{item.time}</span>
                                        </div>
                                        <span className="timeline-detail">{item.detail}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* User History Feature (Strong Academic Feature) */}
                    <div className="card history-card-web">
                        <div className="card-header">
                            <h3><Clock size={16} /> Reporter History</h3>
                        </div>
                        <div className="history-web-list">
                            {reporterHistory.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No previous incidents.</div>
                            ) : (
                                reporterHistory.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="history-web-item">
                                        <div className="history-web-dot"></div>
                                        <div className="history-web-info">
                                            <div className="history-web-row">
                                                <strong>{item.type} Emergency</strong>
                                                <span className="history-web-date">
                                                    {new Date(item.reportedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <span className="history-web-loc">{item.approximateAddress || 'Location unverified'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="history-footer">
                            <span>{reporterHistory.length > 0 ? `Showing last ${Math.min(3, reporterHistory.length)} incidents.` : 'First time reporter.'}</span>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="layout-col side-col">
                    <div className="card comms-action-card">
                        <div className="card-header">
                            <h3><RadioIcon size={18} /> Authority Comms</h3>
                        </div>
                        <div className="comms-body" style={{ padding: '0 20px 20px 20px' }}>
                            <p className="text-muted text-sm" style={{ marginBottom: '12px', fontSize: '13px' }}>Establish a direct encrypted line with the respondent's device.</p>
                            <button
                                className="command-btn btn-outline"
                                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                onClick={() => setShowCommsModal(true)}
                            >
                                <RadioIcon size={16} /> Initiate Voice/Chat
                            </button>
                        </div>
                    </div>

                    <div className="card authority-response-card">
                        <div className="card-header">
                            <h3><Shield size={18} /> Authority Response</h3>
                        </div>
                        <div className="auth-response-body" style={{ padding: '0 20px 20px 20px' }}>
                            {authResponses.length === 0 ? (
                                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                                    <Shield size={28} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>No authority tracking initialized for this incident.</p>
                                    {['ADMIN', 'MEDICAL'].includes(userRole) && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await apiClient.post(`/incidents/${id}/authority-response/initialize`);
                                                    setAuthResponses(res.data || []);
                                                } catch (e) {
                                                    console.error('Failed to initialize authority responses', e);
                                                }
                                            }}
                                            style={{
                                                padding: '8px 16px', fontSize: '12px', borderRadius: '6px',
                                                background: 'rgba(52, 152, 219, 0.15)', color: '#3498db',
                                                border: '1px solid rgba(52, 152, 219, 0.4)', cursor: 'pointer'
                                            }}
                                        >
                                            🚨 Activate Authority Tracking
                                        </button>
                                    )}
                                </div>
                            ) : (
                                authResponses.map(resp => (
                                    <div key={resp.id} className="auth-response-row" style={{ marginTop: '15px' }}>
                                        <div className="auth-type-header" style={{ fontWeight: 'bold', marginBottom: '8px', color: resp.authorityType === 'FIRE' ? '#e74c3c' : '#3498db' }}>
                                            {resp.authorityType === 'FIRE' ? '🚒 Fire Service' : '🚓 Police Department'}
                                        </div>
                                        <div className="auth-status-stepper" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                            {((resp.authorityType === 'FIRE' && !canUpdateFire) || (resp.authorityType === 'POLICE' && !canUpdatePolice)) ? (
                                                <div style={{ fontSize: '12px', color: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(231, 76, 60, 0.2)' }}>
                                                    🔒 Access restricted to {resp.authorityType === 'FIRE' ? 'Fire Service' : 'Police'}/Admin personnel
                                                </div>
                                            ) : resp.status === 'CANCELLED' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                    <div style={{ fontSize: '12px', color: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(231, 76, 60, 0.2)', flexGrow: 1, marginRight: '10px' }}>
                                                        🚫 Authority Dispatch Cancelled
                                                    </div>
                                                    <button
                                                        onClick={() => handleAuthStatusUpdate(resp.id, 'PENDING')}
                                                        style={{
                                                            padding: '6px 12px', fontSize: '11px', borderRadius: '4px', border: '1px solid #94a3b8',
                                                            backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s ease-in-out'
                                                        }}
                                                    >
                                                        Undo Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                {['PENDING', 'ACKNOWLEDGED', 'DISPATCHED', 'ON_SCENE', 'COMPLETED'].map(step => (
                                                    <button
                                                        key={step}
                                                        className={`status-step-btn ${resp.status === step ? 'active' : ''}`}
                                                        onClick={() => handleAuthStatusUpdate(resp.id, step)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            fontSize: '11px',
                                                            borderRadius: '4px',
                                                            border: resp.status === step ? 'none' : '1px solid #334155',
                                                            backgroundColor: resp.status === step ? (resp.authorityType === 'FIRE' ? '#e74c3c' : '#3498db') : 'transparent',
                                                            color: resp.status === step ? '#ffffff' : '#94a3b8',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease-in-out'
                                                        }}
                                                    >
                                                        {step}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => handleAuthStatusUpdate(resp.id, 'CANCELLED')}
                                                    style={{
                                                        padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #e74c3c',
                                                        backgroundColor: 'transparent', color: '#e74c3c', cursor: 'pointer', marginLeft: 'auto',
                                                        transition: 'all 0.2s ease-in-out'
                                                    }}
                                                >
                                                    Cancel Request
                                                </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div className="auth-response-row" style={{ marginTop: '15px' }}>
                                <div className="auth-type-header" style={{ fontWeight: 'bold', marginBottom: '8px', color: '#2ecc71' }}>
                                    🚑 Ambulance Fleet
                                </div>
                                <div className="auth-status-stepper" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        borderRadius: '4px',
                                        backgroundColor: incidentStatus === 'Resolved' ? '#2ecc71' : 
                                                         dispatchedUnit?.dispatchStatus === 'ARRIVED_AT_HOSPITAL' ? '#3498db' :
                                                         dispatchedUnit?.dispatchStatus === 'TRANSPORTING' ? '#f39c12' : '#334155',
                                        color: '#ffffff',
                                        width: 'fit-content'
                                    }}>
                                        {incidentStatus === 'Resolved' ? 'COMPLETED' : 
                                         dispatchedUnit?.dispatchStatus === 'ARRIVED_AT_HOSPITAL' ? 'ARRIVED AT HOSPITAL' :
                                         dispatchedUnit?.dispatchStatus === 'TRANSPORTING' ? 'TRANSPORTING PATIENT' :
                                         dispatchedUnit?.dispatchStatus === 'ON_SCENE' ? 'ON SCENE / RESPONDING' : 
                                         (incidentStatus === 'Dispatched' ? 'EN ROUTE / DISPATCHED' : 'PENDING DISPATCH')}
                                    </span>
                                    {dispatchedUnit && (
                                        <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px', backgroundColor: 'rgba(46, 204, 113, 0.1)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
                                            <div style={{ marginBottom: '4px' }}><strong>Unit:</strong> {dispatchedUnit.id} — {dispatchedUnit.crew}</div>
                                            {incidentStatus === 'Resolved' ? (
                                                <div><strong>Status:</strong> <span style={{ color: '#2ecc71', fontWeight: 'bold', fontSize: '14px' }}>Incident Cleared</span></div>
                                            ) : dispatchedUnit.dispatchStatus === 'ARRIVED_AT_HOSPITAL' ? (
                                                <div>
                                                    <div style={{ marginBottom: '4px' }}><strong>Status:</strong> <span style={{ color: '#3498db', fontWeight: 'bold', fontSize: '14px' }}>🏥 Arrived at Hospital</span></div>
                                                    <div style={{ marginBottom: '4px' }}><strong>Location:</strong> {dispatchedUnit.destinationHospitalName || 'Hospital'}</div>
                                                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>Patient has been successfully delivered.</div>
                                                </div>
                                            ) : dispatchedUnit.dispatchStatus === 'ON_SCENE' ? (
                                                <>
                                                    <div style={{ marginBottom: '8px' }}><strong>Status:</strong> <span style={{ color: '#3498db', fontWeight: 'bold', fontSize: '14px' }}>🏥 On Scene</span></div>
                                                    {canDispatch && (
                                                        <button
                                                            onClick={() => setShowTransportModal(true)}
                                                            style={{
                                                                padding: '5px 10px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer',
                                                                background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71',
                                                                border: '1px solid rgba(46, 204, 113, 0.4)', marginTop: '2px'
                                                            }}
                                                        >
                                                            🚑 Transport to Hospital
                                                        </button>
                                                    )}
                                                </>
                                            ) : dispatchedUnit.dispatchStatus === 'TRANSPORTING' ? (
                                                <div>
                                                    <div style={{ marginBottom: '4px' }}><strong>Status:</strong> <span style={{ color: '#f39c12', fontWeight: 'bold', fontSize: '14px' }}>🚑 Transporting Patient</span></div>
                                                    <div style={{ marginBottom: '4px' }}><strong>Destination:</strong> {dispatchedUnit.destinationHospitalName || 'Hospital'}</div>
                                                    {dispatchedUnit.destinationHospitalAddress && (
                                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{dispatchedUnit.destinationHospitalAddress}</div>
                                                    )}
                                                    <div style={{ marginTop: '6px' }}><strong>Hospital ETA:</strong> <span style={{ color: '#f39c12', fontWeight: 'bold' }}>{dispatchedUnit.eta}</span></div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ marginBottom: '8px' }}><strong>Estimated Arrival:</strong> <span style={{ color: '#2ecc71', fontWeight: 'bold', fontSize: '14px' }}>{dispatchedUnit.eta}</span></div>
                                                    {canDispatch && (
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        const res = await apiClient.get(`/dispatch-logs/incident/${id}`);
                                                                        const active = (res.data || []).find(l => l.status === 'ASSIGNED' || l.status === 'EN_ROUTE');
                                                                        if (active) {
                                                                            await apiClient.patch(`/dispatch-logs/${active.dispatchId}/status`, { status: 'ARRIVED' });
                                                                            setDispatchedUnit(prev => ({ ...prev, eta: '0 min', dispatchStatus: 'ON_SCENE' }));
                                                                            showToast('Ambulance marked as On Scene!');
                                                                        }
                                                                    } catch (e) {
                                                                        showToast('Failed to update ambulance status', 'error');
                                                                    }
                                                                }}
                                                                style={{
                                                                    padding: '5px 10px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer',
                                                                    background: 'rgba(52, 152, 219, 0.15)', color: '#3498db',
                                                                    border: '1px solid rgba(52, 152, 219, 0.4)', marginTop: '2px'
                                                                }}
                                                            >
                                                                📍 Mark On Scene
                                                            </button>
                                                            <button
                                                                title="Recall this unit — cancels the dispatch and returns the ambulance to Available"
                                                                onClick={async () => {
                                                                    if (!window.confirm('Recall this unit? The ambulance will be returned to Available status.')) return;
                                                                    try {
                                                                        const res = await apiClient.get(`/dispatch-logs/incident/${id}`);
                                                                        const active = (res.data || []).find(l => ['ASSIGNED', 'EN_ROUTE'].includes(l.status));
                                                                        if (active) {
                                                                            await apiClient.patch(`/dispatch-logs/${active.dispatchId}/status`, { status: 'CANCELLED' });
                                                                            setDispatchedUnit(null);
                                                                            setDispatched(false);
                                                                            setIncidentStatus('Active');
                                                                            showToast('Unit recalled — incident returned to Active queue.');
                                                                        } else {
                                                                            showToast('No active dispatch log found.', 'error');
                                                                        }
                                                                    } catch (e) {
                                                                        showToast('Failed to recall unit. Try again.', 'error');
                                                                    }
                                                                }}
                                                                style={{
                                                                    padding: '5px 10px', fontSize: '11px', borderRadius: '5px', cursor: 'pointer',
                                                                    background: 'rgba(231, 76, 60, 0.12)', color: '#e74c3c',
                                                                    border: '1px solid rgba(231, 76, 60, 0.35)', marginTop: '2px'
                                                                }}
                                                            >
                                                                ↩ Recall Unit
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card status-update-card">
                        <div className="card-header">
                            <h3><CheckSquare size={18} /> Update Status</h3>
                        </div>
                        <p className="current-status-row">Current: <span className={`inline-status-badge status-${incidentStatus.toLowerCase()}`}>{incidentStatus}</span></p>
                        <div className="status-btn-group">
                            {!canResolve && !canDispatch ? (
                                <div style={{ fontSize: '13px', color: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(231, 76, 60, 0.2)', width: '100%', textAlign: 'center' }}>
                                    🔒 Status updates and ambulance dispatch are restricted to Medical/Admin personnel.
                                </div>
                            ) : (
                                <>
                                    {canDispatch && (
                                        <button
                                            className={`status-action-btn btn-dispatched ${incidentStatus === 'Dispatched' ? 'current' : ''}`}
                                            onClick={() => setShowDispatchModal(true)}
                                            disabled={incidentStatus === 'Dispatched' || incidentStatus === 'Resolved'}
                                        >
                                            Dispatch Ambulance
                                        </button>
                                    )}
                                    {canResolve && (
                                        <button
                                            className={`status-action-btn btn-resolved ${incidentStatus === 'Resolved' ? 'current' : ''}`}
                                            onClick={() => setShowOutcomeModal(true)}
                                            disabled={incidentStatus === 'Resolved'}
                                        >
                                            Mark as Resolved
                                        </button>
                                    )}
                                    {canResolve && incidentStatus !== 'Active' && (
                                        <button
                                            className="status-action-btn btn-reopen"
                                            onClick={() => {
                                                setIncidentOutcome(null);
                                                updateStatus('Active');
                                            }}
                                        >
                                            Re-open Incident
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {(userRole === 'ADMIN' || userRole === 'MEDICAL') && (
                        <div className="card medical-card">
                            <div className="medical-header">
                                <h3><Lock size={16} /> Medical Profile</h3>
                                <span className="secure-tag">Authorized Access</span>
                            </div>
                            <div className="info-list medical-info">
                                <div className="info-item border-danger-left">
                                    <span className="info-label text-danger">Blood Group</span>
                                    <strong className="info-value text-danger">{medicalProfile?.bloodGroup || incidentData.medicalData.bloodGroup}</strong>
                                </div>
                                <div className="info-item">
                                    <span className="info-label text-warning">Allergies</span>
                                    <span className="info-value text-warning">{medicalProfile?.allergies || 'None recorded'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Chronic Conditions</span>
                                    <span className="info-value text-white">{medicalProfile?.chronicConditions || 'None recorded'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Current Medications</span>
                                    <span className="info-value text-white">{medicalProfile?.currentMedications || 'None recorded'}</span>
                                </div>
                                <div className="info-item notes-box">
                                    <span className="info-label text-danger">Special Med Notes</span>
                                    <p>{medicalProfile?.specialNotes || 'No special notes provided by citizen.'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Modals */}
            {showCommsModal && <SecureCommsModal 
                isOpen={showCommsModal} 
                onClose={() => { setShowCommsModal(false); setIncomingAction(null); }} 
                incidentId={incidentData.id}
                reporterPhone={medicalProfile?.contactPhone || incidentData.reporter.phone}
                incomingAction={incomingAction}
            />}
        </div>
    );
}
