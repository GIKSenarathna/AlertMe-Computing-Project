import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Truck, Clock, FileText, MapPin, Activity, Navigation, ArrowRight, Zap, CheckCircle, ZoomIn, ZoomOut, RefreshCw, Trash2, ChevronRight, X, Siren, Shield, Info, MoreHorizontal, LayoutDashboard, History, Settings, Bell, Search, Menu, Users, Thermometer, Droplets, Wind, Siren as SirenIcon } from 'lucide-react';
import { GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { Client } from '@stomp/stompjs';
import apiClient from '../services/apiClient';
import { useGoogleMaps, defaultCenter, mapContainerStyle, darkMapStyle, MapFallback, buildMarkerIcons } from '../services/googleMapsConfig';
import './DashboardOverview.css';

export default function DashboardOverview() {
    const navigate = useNavigate();
    const { isLoaded, loadError } = useGoogleMaps();
    const [openMarkerId, setOpenMarkerId] = useState(null);
    const handleMarkerClick = useCallback((id) => setOpenMarkerId(prev => prev === id ? null : id), []);
    // Marker icons — only built once Google Maps SDK is ready (avoids window.google errors)
    const markerIcons = useMemo(() => isLoaded ? buildMarkerIcons() : {}, [isLoaded]);
    const [secondsAgo, setSecondsAgo] = useState(0);
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };
    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [showAlertDrawer, setShowAlertDrawer] = useState(false);
    const [selectedAmb, setSelectedAmb] = useState(null);
    const [selectedMapItem, setSelectedMapItem] = useState(null);
    const [dispatched, setDispatched] = useState(false);
    const hasPlayedRef = useRef(false);

    const [availableAmbulances, setAvailableAmbulances] = useState([]);
    const [activeAmbulances, setActiveAmbulances] = useState([]);
    const [criticalIncident, setCriticalIncident] = useState(null);
    const [activeIncidentCount, setActiveIncidentCount] = useState(0);
    const [criticalAlertCount, setCriticalAlertCount] = useState(0);
    const [avgResponseTime, setAvgResponseTime] = useState('—');
    const [activeIncidentsList, setActiveIncidentsList] = useState([]);
    const [activeAuthorities, setActiveAuthorities] = useState([]);
    const [criticalZoneCount, setCriticalZoneCount] = useState(0);

    // Live timestamp ticker
    useEffect(() => {
        const interval = setInterval(() => setSecondsAgo(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    // Alert beep on mount
    useEffect(() => {
        if (hasPlayedRef.current) return;
        hasPlayedRef.current = true;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const playTone = (freq, startTime, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.4, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };
            playTone(880, ctx.currentTime, 0.15);
            playTone(660, ctx.currentTime + 0.18, 0.15);
            playTone(880, ctx.currentTime + 0.36, 0.25);
        } catch (e) { }
    }, []);

    const lastUpdated = secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`;

    // WebSocket Real-time fleet updates
    useEffect(() => {
        const stompClient = new Client({
            brokerURL: 'ws://localhost:8080/ws-emergency/websocket',
            onConnect: (frame) => {
                stompClient.subscribe('/topic/ambulances', (message) => {
                    const updatedAmb = JSON.parse(message.body);
                    const mapped = {
                        id: updatedAmb.vehicleId,
                        fullId: updatedAmb.vehicleId,
                        status: updatedAmb.currentStatus,
                        latitude: updatedAmb.currentLocation?.latitude,
                        longitude: updatedAmb.currentLocation?.longitude,
                        type: updatedAmb.capabilityType || 'BASIC',
                        location: updatedAmb.currentStatus === 'AVAILABLE' ? (updatedAmb.stationName || 'Hub') : 'En Route',
                        driver: updatedAmb.crewName
                    };

                    if (updatedAmb.currentStatus === 'AVAILABLE') {
                        setAvailableAmbulances(prev => {
                            const idx = prev.findIndex(a => a.id === mapped.id);
                            if (idx !== -1) return prev.map(a => a.id === mapped.id ? { ...a, ...mapped } : a);
                            return [...prev, mapped];
                        });
                        setActiveAmbulances(prev => prev.filter(a => a.id !== mapped.id));
                    } else {
                        setActiveAmbulances(prev => {
                            const idx = prev.findIndex(a => a.id === mapped.id);
                            if (idx !== -1) return prev.map(a => a.id === mapped.id ? { ...a, ...mapped } : a);
                            return [...prev, mapped];
                        });
                        setAvailableAmbulances(prev => prev.filter(a => a.id !== mapped.id));
                    }
                });
            }
        });

        stompClient.activate();
        return () => stompClient.deactivate();
    }, []);

    // Initial Data Fetch & Background Sync
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch independently to prevent RBAC 403s from crashing the whole dashboard
                let ambRes = { data: [] };
                try {
                    const userRole = localStorage.getItem('userRole') || 'ADMIN';
                    if (['ADMIN', 'MEDICAL'].includes(userRole)) {
                        ambRes = await apiClient.get('/ambulances');
                    }
                } catch (e) {
                    console.warn("Skipped fetching ambulances due to permissions");
                }

                const fetchSafe = (url) => apiClient.get(url).catch(e => ({ data: [] }));
                const [mlRes, incRes, authRes] = await Promise.all([
                    fetchSafe('/analytics/risk-clusters?days=30'),
                    fetchSafe('/incidents/active'),
                    fetchSafe('/authority-response/active')
                ]);

                // 🚨 Risk Clusters
                setCriticalZoneCount((mlRes.data || []).filter(c => c.risk === 'Critical').length);

                // 🚑 Ambulances — always use fresh backend coordinates for AVAILABLE units
                const allAmb = ambRes.data || [];
                setAvailableAmbulances(allAmb.filter(a => (a.currentStatus || '').toUpperCase() === 'AVAILABLE').map((a, idx) => ({
                    id: a.vehicleId,
                    fullId: a.vehicleId,
                    location: a.stationName || 'Colombo Center',
                    driver: a.crewName || 'Assigned Crew',
                    type: a.capabilityType || 'BASIC',
                    latitude: a.currentLocation?.latitude || (6.9271 + idx * 0.02),
                    longitude: a.currentLocation?.longitude || (79.8612 + idx * 0.02)
                })));
                setActiveAmbulances(allAmb.filter(a => {
                    const st = (a.currentStatus || '').toUpperCase();
                    return ['EN_ROUTE', 'DISPATCHED', 'ON_SCENE', 'TRANSPORTING', 'ARRIVED_AT_HOSPITAL', 'ARRIVED'].includes(st);
                }).map(a => {
                    const st = (a.currentStatus || '').toUpperCase();
                    let displayStatus = 'En Route';
                    if (st === 'ON_SCENE' || st === 'ARRIVED') displayStatus = 'On Scene';
                    if (st === 'TRANSPORTING') displayStatus = 'Transporting';
                    if (st === 'ARRIVED_AT_HOSPITAL') displayStatus = 'At Hospital';
                    
                    return {
                        id: a.vehicleId,
                        status: displayStatus,
                        location: 'Tracking Live...',
                        latitude: a.currentLocation?.latitude,
                        longitude: a.currentLocation?.longitude,
                        type: a.capabilityType || 'BASIC',
                        driver: a.crewName
                    };
                }));

                // 📋 Incidents
                const activeIncs = incRes.data || [];
                // Only show incidents that haven't been dispatched yet (Red dots / Critical alerts)
                const unresolved = activeIncs.filter(i => {
                    const st = (i.status || '').toUpperCase();
                    return st === 'REPORTED' || st === 'ACTIVE';
                });
                setActiveIncidentCount(unresolved.length);
                setActiveIncidentsList(unresolved);
                setCriticalAlertCount(unresolved.filter(i => i.severityScore >= 5).length);

                // ⚖️ Authorities
                setActiveAuthorities((authRes.data || []).filter(a => a.status !== 'RESOLVED' && a.status !== 'COMPLETED' && a.status !== 'CANCELLED'));

                // Header Stats & Primary Alert
                if (unresolved.length > 0) {
                    const sorted = [...unresolved].sort((a,b) => b.severityScore - a.severityScore);
                    setCriticalIncident(sorted[0]);
                    
                    const oldest = unresolved.reduce((a, b) => new Date(a.reportedAt) < new Date(b.reportedAt) ? a : b);
                    const elapsedMs = Date.now() - new Date(oldest.reportedAt).getTime();
                    setAvgResponseTime(`${Math.floor(elapsedMs / 60000)}m ${Math.floor((elapsedMs % 60000) / 1000)}s`);
                } else {
                    setCriticalIncident(null);
                    setAvgResponseTime('—');
                }

            } catch (err) {
                console.warn("Dashboard Refresh Conflict:", err);
            }
        };

        fetchDashboardData();
        const intervalId = setInterval(fetchDashboardData, 15000);
        return () => clearInterval(intervalId);
    }, []);

    const getRecommendationScore = (amb, severity) => {
        let score = 5; // Base ETA assumption
        if (severity >= 4) {
            if (amb.type === 'ICU') score -= 5;
            else if (amb.type === 'Basic') score += 10;
        }
        return score;
    };

    const handleDispatchConfirm = async () => {
        if (!selectedAmb || !criticalIncident) return;
        setDispatched(true);
        try {
            await apiClient.post(`/incidents/${criticalIncident.incidentId}/dispatch`, null, {
                params: { vehicleId: selectedAmb.fullId }
            });
            setTimeout(() => {
                setShowDispatchModal(false);
                setDispatched(false);
                setSelectedAmb(null);
            }, 1200);
        } catch (err) {
            showToast(`Dispatch failed: ${err?.message || 'Server error'}`, 'error');
            setDispatched(false);
        }
    };

    const handleDismissAuthority = async (e, authId) => {
        e.stopPropagation();
        try {
            await apiClient.patch(`/authority-response/${authId}/status`, { status: 'RESOLVED' });
            setActiveAuthorities(prev => prev.filter(a => a.id !== authId));
        } catch (err) { console.error(err); }
    };

    const secondaryIncidents = activeIncidentsList.filter(i => i.incidentId !== criticalIncident?.incidentId);

    const sortedAmbulances = [...availableAmbulances].sort((a, b) => {
        const scoreA = getRecommendationScore(a, criticalIncident?.severityScore || 1);
        const scoreB = getRecommendationScore(b, criticalIncident?.severityScore || 1);
        return scoreA - scoreB;
    });

    return (
        <div className="dashboard-overview">
            {/* ── Inline Toast (replaces alert()) ── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
                    background: toast.type === 'error' ? '#7f1d1d' : '#14532d',
                    border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#22c55e'}`,
                    color: '#fff', padding: '12px 20px', borderRadius: '10px',
                    fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center',
                    gap: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    animation: 'slideInRight 0.3s ease'
                }}>
                    {toast.type === 'error' ? '⚠️' : '✅'} {toast.msg}
                </div>
            )}
            <div className="page-header">
                <div>
                    <h1>Command Center</h1>
                    <p className="header-urgent">🚨 Continuous Emergency Monitoring &nbsp;·&nbsp; Enterprise Dispatch System</p>
                </div>
                <div className="header-right-block">
                    <span className="last-updated-tag">Sync: {lastUpdated}</span>
                    <div className="system-status">
                        <span className="status-dot green-pulse"></span>
                        <div className="system-status-text">
                            <span className="system-status-main">FLEET LIVE</span>
                            <span className="system-status-sub">Real-time GPS Tracking Active</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* CRITICAL EMERGENCY BANNER (The One the User Missed) */}
            {criticalIncident ? (
                <div className="critical-alert-banner alert-pulse">
                    <div className="alert-icon-pulse"><AlertCircle size={32} /></div>
                    <div className="alert-content">
                        <span className="alert-label">🚨 CRITICAL EMERGENCY</span>
                        <h4>{criticalIncident.type} Reported — <span className="casualties-highlight">Immediate Dispatch Required</span></h4>
                        <div className="alert-sub-label">⚠️ HIGH PRIORITY SECTOR: {criticalIncident.approximateAddress}</div>
                        <div className="alert-details">
                            <span><MapPin size={14} /> {criticalIncident.approximateAddress}</span>
                            <span><Clock size={14} /> Reported {new Date(criticalIncident.reportedAt).toLocaleTimeString()}</span>
                            <span><Activity size={14} /> Severity Score: {criticalIncident.severityScore}</span>
                        </div>
                    </div>
                    <div className="alert-actions">
                        <button className="btn-outline" onClick={() => navigate(`/incident/${criticalIncident.incidentId}`)}>View Incident</button>
                        <button className="btn-solid" onClick={() => setShowDispatchModal(true)}>Dispatch Unit</button>
                        {activeIncidentsList.length > 1 && (
                            <button className="btn-outline" style={{ borderStyle: 'dashed' }} onClick={() => setShowAlertDrawer(true)}>
                                +{activeIncidentsList.length - 1} more queue
                                <ChevronRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="empty-alert-banner">
                    <div className="empty-alert-bg-glow"></div>
                    <div className="alert-icon-wrapper success">
                        <CheckCircle size={32} />
                    </div>
                    <div className="alert-content">
                        <span className="alert-label success">✅ SECTOR SECURE</span>
                        <h4>No Active Threats Detected — <span className="status-secondary">Awaiting Real-time Signals</span></h4>
                        <p className="status-detail">Continuous satellite & IoT monitoring active. System operational.</p>
                    </div>
                    <div className="alert-meta-status">
                        <div className="pulse-mini-container">
                            <span className="pulse-mini success"></span>
                            <span className="pulse-label">System Active</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="dashboard-main-grid">
                {/* COLUMN 1: LIVE MAP */}
                <div className="map-column">
                    <div className="card live-emergency-map">
                        <div className="card-header">
                            <h3>Live Emergency Map</h3>
                            <div className="live-indicator"><span className="dot red-pulse"></span> GPS Tracking</div>
                        </div>
                        <div className="map-container">
                            {!isLoaded || loadError ? (
                                <MapFallback error={loadError} />
                            ) : (
                                <GoogleMap
                                    mapContainerStyle={mapContainerStyle}
                                    center={defaultCenter}
                                    zoom={12}
                                    options={{ styles: darkMapStyle, disableDefaultUI: true, zoomControl: true }}
                                >
                                    {/* Incident markers — red dots */}
                                    {activeIncidentsList.map(inc => (
                                        <MarkerF
                                            key={inc.incidentId}
                                            position={{ lat: inc.latitude || 6.9271, lng: inc.longitude || 79.8612 }}
                                            icon={markerIcons.incident}
                                            onClick={() => handleMarkerClick(inc.incidentId)}
                                        >
                                            {openMarkerId === inc.incidentId && (
                                                <InfoWindowF onCloseClick={() => setOpenMarkerId(null)}>
                                                    <div style={{ color: '#0f172a', minWidth: '120px' }}>
                                                        <strong>🚨 {inc.type}</strong><br/>
                                                        <span style={{ fontSize: '12px' }}>{inc.approximateAddress || 'Active Scene'}</span>
                                                    </div>
                                                </InfoWindowF>
                                            )}
                                        </MarkerF>
                                    ))}
                                    {/* Available ambulances — green dots */}
                                    {availableAmbulances.map((amb, i) => (
                                        <MarkerF
                                            key={amb.id || `avail-${i}`}
                                            position={{ lat: amb.latitude || 6.9271, lng: amb.longitude || 79.8612 }}
                                            icon={markerIcons.ambulance}
                                            onClick={() => handleMarkerClick(amb.id || `avail-${i}`)}
                                        >
                                            {openMarkerId === (amb.id || `avail-${i}`) && (
                                                <InfoWindowF onCloseClick={() => setOpenMarkerId(null)}>
                                                    <div style={{ color: '#0f172a' }}><strong>🚑 {amb.id}</strong> — Available</div>
                                                </InfoWindowF>
                                            )}
                                        </MarkerF>
                                    ))}
                                    {/* Active ambulances — orange dots */}
                                    {activeAmbulances.map((amb, i) =>
                                        amb.latitude && amb.longitude ? (
                                            <MarkerF
                                                key={`act-${amb.id || i}`}
                                                position={{ lat: amb.latitude, lng: amb.longitude }}
                                                icon={markerIcons.activeAmbulance}
                                                onClick={() => handleMarkerClick(`act-${amb.id || i}`)}
                                            >
                                                {openMarkerId === `act-${amb.id || i}` && (
                                                    <InfoWindowF onCloseClick={() => setOpenMarkerId(null)}>
                                                        <div style={{ color: '#0f172a' }}><strong>🚨 {amb.id}</strong> — Responding</div>
                                                    </InfoWindowF>
                                                )}
                                            </MarkerF>
                                        ) : null
                                    )}
                                </GoogleMap>
                            )}

                            <div className="map-legend">
                                <div className="legend-row"><span className="legend-dot bg-danger"></span> <span>Active Scene</span></div>
                                <div className="legend-row"><span className="legend-dot" style={{ backgroundColor: '#f39c12' }}></span> <span>Dispatched / Active</span></div>
                                <div className="legend-row"><span className="legend-dot bg-success"></span> <span>Available</span></div>
                            </div>

                            {/* RESTORED: Critical Zone Card as a visible Map Modal/Overlay */}
                            <div className="map-overlay-minimal overlay-clickable" onClick={() => navigate('/risk-map')}>
                                <MapPin size={24} className="overlay-icon" />
                                <div className="overlay-text">
                                    <strong>{criticalZoneCount} Predictive Risk Clusters</strong>
                                    <span>{criticalZoneCount > 0 ? 'High alert in critical sectors' : 'All sectors stable'}</span>
                                </div>
                                <ArrowRight size={18} style={{ color: '#94a3b8' }} />
                            </div>
                        </div>
                    </div>

                    {/* RESTORED: Authority Requests monitoring list (Moved under the map as requested) */}
                    <div className="card authority-requests-card">
                        <div className="card-header">
                            <div className="header-title-group">
                                <Shield size={18} className="header-pill-icon" />
                                <h3>Authority Dispatch Monitor</h3>
                            </div>
                            <span className="count-badge pulse-badge">{activeAuthorities.length} Pending</span>
                        </div>
                        <div className="auth-request-list">
                            {activeAuthorities.map(auth => (
                                <div key={auth.id} className="auth-item" onClick={() => navigate(`/incident/${auth.incident?.incidentId}`)}>
                                     <div className={`auth-icon-box ${auth.authorityType.toLowerCase()}`}>
                                         {auth.authorityType === 'POLICE' ? <Shield size={16} /> : <SirenIcon size={16} />}
                                     </div>
                                     <div className="auth-item-content">
                                         <div className="auth-item-top">
                                             <strong>{auth.authorityType} ASSISTANCE REQUESTED</strong>
                                             <span className={`status-pill ${auth.status.toLowerCase()}`}>{auth.status}</span>
                                         </div>
                                         <div className="auth-item-bottom">
                                             <span><Clock size={12} /> {new Date(auth.requestedAt || auth.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                             <span>·</span>
                                             <span>Scene: {auth.incident?.approximateAddress || 'Locating...'}</span>
                                         </div>
                                     </div>
                                     <div className="auth-item-actions">
                                         {((auth.authorityType === 'FIRE' && ['ADMIN', 'FIRE'].includes(localStorage.getItem('userRole') || 'ADMIN')) || 
                                           (auth.authorityType === 'POLICE' && ['ADMIN', 'POLICE'].includes(localStorage.getItem('userRole') || 'ADMIN'))) && (
                                             <div style={{ display: 'flex', gap: '8px' }}>
                                                 <button 
                                                     className="btn-dismiss" 
                                                     style={{ padding: '8px', minWidth: '32px', justifyContent: 'center' }}
                                                     title="Resolve"
                                                     onClick={(e) => handleDismissAuthority(e, auth.id)}
                                                 >
                                                     <CheckCircle size={16}/>
                                                 </button>
                                                 <button 
                                                     className="btn-dismiss" 
                                                     style={{ padding: '8px', minWidth: '32px', justifyContent: 'center', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.2)', background: 'rgba(231,76,60,0.1)' }} 
                                                     title="Cancel"
                                                     onClick={(e) => {
                                                         e.stopPropagation();
                                                         apiClient.patch(`/authority-response/${auth.id}/status`, { status: 'CANCELLED' })
                                                             .then(() => setActiveAuthorities(prev => prev.filter(a => a.id !== auth.id)))
                                                             .catch(err => console.error(err));
                                                     }}
                                                 >
                                                     <X size={16}/>
                                                 </button>
                                             </div>
                                         )}
                                     </div>
                                </div>
                            ))}
                            {activeAuthorities.length === 0 && (
                                <div className="empty-auth-state">
                                    <Shield size={32} />
                                    <p>No external authority requests active.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COLUMN 2: SIDE PANELS */}
                <div className="dashboard-side-panels">
                    <div className="stat-cards-mini">
                        <div className="stat-card-mini stat-card-critical">
                            <div className="stat-info">
                                <span className="stat-label">Emergency Queue</span>
                                <span className="stat-value danger stat-glow">{activeIncidentCount}</span>
                                <span className="stat-sub-label">ACTION NEEDED</span>
                            </div>
                            <AlertCircle size={20} className="stat-icon danger" />
                        </div>
                        <div className="stat-card-mini">
                            <div className="stat-info">
                                <span className="stat-label">⏱ Response Avg</span>
                                <span className="stat-value">{avgResponseTime}</span>
                            </div>
                            <Clock size={20} className="stat-icon" />
                        </div>
                    </div>

                    <div className="card active-response-panel" style={{ flex: 1 }}>
                        <div className="card-header">
                            <h3>Live Fleet Units</h3>
                        </div>
                        <div className="ambulance-list">
                            {activeAmbulances.length > 0 ? activeAmbulances.map(amb => (
                                <div key={amb.id} className="ambulance-item">
                                    <div className="amb-icon-wrapper active-amb"><Truck size={18} /></div>
                                    <div className="amb-info">
                                        <h4>{amb.id}</h4>
                                        <span className="amb-location">Responding...</span>
                                    </div>
                                    <div className="amb-status-col">
                                        <div className="status-indicator status-en-route">
                                            <span className="dot blink-dot"></span>
                                            <span className="status-text-upper">{amb.status}</span>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-state" style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
                                    No units currently dispatched.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* SECONDARY ALERT DRAWER */}
            {showAlertDrawer && (
                <div className="modal-backdrop" onClick={() => setShowAlertDrawer(false)}>
                    <div className="modal-panel side-drawer" onClick={e => e.stopPropagation()} style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '380px', background: '#0f172a', borderLeft: '1px solid #334155' }}>
                        <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '24px', borderBottom: '1px solid #334155' }}>
                            <h3>Incident Queue</h3>
                            <button onClick={() => setShowAlertDrawer(false)}><X size={20}/></button>
                        </div>
                        <div className="drawer-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: 'calc(100vh - 70px)' }}>
                            {secondaryIncidents.map(inc => (
                                <div key={inc.incidentId} className="secondary-inc-card" style={{ padding: '16px', background: '#1e293b', borderRadius: '12px', cursor: 'pointer' }} onClick={() => navigate(`/incident/${inc.incidentId}`)}>
                                    <span className="drawer-primary-tag">Level {inc.severityScore}</span>
                                    <h4 style={{ margin: '8px 0' }}>{inc.type}</h4>
                                    <p style={{ fontSize: '12px', opacity: 0.7 }}><MapPin size={12}/> {inc.approximateAddress}</p>
                                    <button className="btn-solid" style={{ marginTop: '12px', width: '100%', fontSize: '12px', padding: '8px' }}>Manage Response</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* DISPATCH MODAL */}
            {showDispatchModal && (
                <div className="modal-backdrop">
                    <div className="modal-panel">
                        {/* Header */}
                        <div className="dispatch-modal-header">
                            <div>
                                <h3><Truck size={18} /> Ambulance Dispatch</h3>
                                <p>
                                    Incident: <strong>{criticalIncident?.type}</strong> &nbsp;—&nbsp; {criticalIncident?.approximateAddress}
                                </p>
                            </div>
                            <button className="modal-close-btn" onClick={() => { setShowDispatchModal(false); setSelectedAmb(null); }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Incident Coord Info */}
                        <div style={{ padding: '8px 24px 0', fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={12} />
                            {criticalIncident?.latitude?.toFixed(4)}°N, {criticalIncident?.longitude?.toFixed(4)}°E
                        </div>

                        {/* Unit List Label */}
                        <div style={{ padding: '12px 24px 4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
                            Select an Available Unit:
                        </div>

                        {/* Ambulance List */}
                        <div className="dispatch-amb-list" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                            {sortedAmbulances.map((amb, idx) => {
                                // Haversine distance
                                const R = 6371;
                                const lat1 = (criticalIncident?.latitude || 6.9271) * Math.PI / 180;
                                const lat2 = (amb.latitude || 6.9271) * Math.PI / 180;
                                const dLat = lat2 - lat1;
                                const dLon = ((amb.longitude || 79.86) - (criticalIncident?.longitude || 79.86)) * Math.PI / 180;
                                const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
                                const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                const etaMin = Math.round(distKm / 0.6); // ~36 km/h avg

                                const typeColor = amb.type === 'ICU' ? '#818cf8' : amb.type === 'ADVANCED' ? '#38BDF8' : '#94a3b8';
                                const isRecommended = idx === 0;

                                return (
                                    <div
                                        key={amb.id}
                                        className={`dispatch-amb-item ${selectedAmb?.id === amb.id ? 'selected' : ''} ${isRecommended ? 'dispatch-recommended' : ''}`}
                                        onClick={() => setSelectedAmb(amb)}
                                    >
                                        <div className="dispatch-amb-icon"><Truck size={18} /></div>
                                        <div className="dispatch-amb-info">
                                            <div className="dispatch-amb-id-row">
                                                <span className="dispatch-amb-id">{amb.id}</span>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: typeColor, background: `${typeColor}18`, padding: '2px 7px', borderRadius: '4px' }}>{amb.type}</span>
                                                {isRecommended && (
                                                    <span className="recommended-badge" title="Best Fit: ranked by capability type vs. severity score and distance to incident">
                                                        ⭐ Best Fit
                                                    </span>
                                                )}
                                            </div>
                                            <span className="dispatch-amb-detail">
                                                <Navigation size={11} /> {amb.driver || 'Crew Assigned'} &nbsp;·&nbsp; {distKm.toFixed(1)} km
                                            </span>
                                        </div>
                                        <div className="dispatch-amb-eta">
                                            <Clock size={13} /> {etaMin} min
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="dispatch-modal-footer">
                            <button className="dispatch-cancel-btn" onClick={() => { setShowDispatchModal(false); setSelectedAmb(null); }}>Cancel</button>
                            <button
                                className={`dispatch-confirm-btn ${(!selectedAmb || dispatched) ? 'disabled' : ''}`}
                                disabled={!selectedAmb || dispatched}
                                onClick={handleDispatchConfirm}
                            >
                                <Navigation size={15} style={{ display: 'inline', marginRight: '6px' }} />
                                {dispatched ? 'Dispatching...' : 'Dispatch Now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
