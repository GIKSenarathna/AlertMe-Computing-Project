import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Eye, X, ChevronDown, AlertTriangle, MapPin, RadioIcon, User, Clock } from 'lucide-react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { useGoogleMaps, defaultCenter, darkMapStyle, MapFallback, buildMarkerIcons } from '../services/googleMapsConfig';
import apiClient from '../services/apiClient';
import SecureCommsModal from '../components/SecureCommsModal';
import './LiveIncidents.css';

export default function LiveIncidents() {
    const navigate = useNavigate();
    const { isLoaded, loadError } = useGoogleMaps();
    const markerIcons = useMemo(() => isLoaded ? buildMarkerIcons() : {}, [isLoaded]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ severity: '', status: '', reporterType: '' });
    const filterRef = useRef(null);

    // Close filter panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (filterRef.current && !filterRef.current.contains(e.target)) {
                setShowFilters(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [allIncidents, setAllIncidents] = useState([]);
    
    // Live Database Synchronization Hook
    const fetchIncidents = async () => {
        try {
            const response = await apiClient.get('/incidents/active');
            
            // Map the Spring Boot DTOs into the existing React components specifications
            const formatted = response.data.map(inc => ({
                id: inc.incidentId,
                shortId: inc.incidentId.substring(0, 8).toUpperCase(),
                lat: inc.latitude || 6.9271,
                lng: inc.longitude || 79.8612,
                location: `${inc.latitude?.toFixed(4) || '?.????'}° N, ${inc.longitude?.toFixed(4) || '?.????'}° E · ${inc.approximateAddress || 'Unknown GPS Coordinates'}`,
                time: new Date(inc.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                severity: inc.severityScore >= 5 ? 'Critical' : inc.severityScore >= 4 ? 'High' : inc.severityScore >= 3 ? 'Medium' : 'Low',
                status: inc.status === 'REPORTED' ? 'Active' : 
                        inc.status === 'DISPATCHED' ? 'Dispatched' : 
                        inc.status === 'RESOLVED' ? 'Resolved' : inc.status,
                reporterType: inc.type, // e.g., VEHICLE, FIRE, MEDICAL
                reporterId: inc.reporterId || 'UNKNOWN',
                reporterName: inc.reporterName || 'Anonymous',
                reporterPhone: inc.reporterPhone || 'Unknown'
            }));
            setAllIncidents(formatted);
        } catch (error) {
            console.error('API Sync Blocked. Could not fetch active firehose:', error);
        }
    };

    useEffect(() => {
        fetchIncidents(); // Initial Fetch
        const pollingId = setInterval(() => {
            fetchIncidents();
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 800);
        }, 5000); // 5 second polling interval
        return () => clearInterval(pollingId);
    }, []);

    // Apply search + all active filters
    const incidents = allIncidents.filter(inc => {
        const matchSearch = !searchTerm ||
            inc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inc.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchSeverity = !filters.severity || inc.severity === filters.severity;
        const matchStatus = !filters.status || inc.status === filters.status;
        const matchReporter = !filters.reporterType || inc.reporterType === filters.reporterType;
        return matchSearch && matchSeverity && matchStatus && matchReporter;
    });

    const clearFilters = () => setFilters({ severity: '', status: '', reporterType: '' });
    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    const [selectedIncident, setSelectedIncident] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [showCommsModal, setShowCommsModal] = useState(false);
    const [reporterHistory, setReporterHistory] = useState([]);

    const handleRowClick = async (inc) => {
        setSelectedIncident(inc);
        setReporterHistory([]);
        setIsPanelOpen(true);
        if (inc.reporterId && inc.reporterId !== 'UNKNOWN') {
            try {
                const histRes = await apiClient.get(`/incidents/reporter/${inc.reporterId}`);
                setReporterHistory(histRes.data.filter(i => i.incidentId !== inc.id));
            } catch(e) {
                console.error(e);
            }
        }
    };

    const closePanel = () => {
        setIsPanelOpen(false);
    };

    const handleViewFullDetails = (id) => navigate(`/incident/${id}`);

    // Update table row onClick
    // ... later in the file ...

    // Fake auto-refresh effect for demo polish
    const [isRefreshing, setIsRefreshing] = useState(false);

    return (
        <div className="live-incidents-page">
            <div className="page-header">
                <div>
                    <h1>Live Incident Feed</h1>
                    <p>Real-time log of all incoming emergency alerts</p>
                </div>
                <div className="system-status live-status-container">
                    <span className="status-dot green-pulse"></span>
                    <span className="live-text">Live Monitoring <span className="updating-dots">Updating</span></span>
                </div>
            </div>

            <div className="table-controls card">
                <div className="controls-group">
                    <div className="search-bar search-bar-glow">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by ID or Location..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="quick-filters">
                        <button className={`filter-chip ${!filters.severity && !filters.status ? 'active' : ''}`} onClick={clearFilters}>All</button>
                        <button className={`filter-chip ${filters.severity === 'Critical' ? 'active' : ''}`} onClick={() => setFilters(f => ({...f, severity: f.severity === 'Critical' ? '' : 'Critical'}))}>Critical</button>
                        <button className={`filter-chip ${filters.status === 'Active' ? 'active' : ''}`} onClick={() => setFilters(f => ({...f, status: f.status === 'Active' ? '' : 'Active'}))}>Active</button>
                        <button className={`filter-chip ${filters.status === 'Dispatched' ? 'active' : ''}`} onClick={() => setFilters(f => ({...f, status: f.status === 'Dispatched' ? '' : 'Dispatched'}))}>Dispatched</button>
                    </div>

                    <div className="filter-wrapper" ref={filterRef}>
                        <button
                            className={`filter-btn ${activeFilterCount > 0 ? 'filter-active' : ''}`}
                            onClick={() => setShowFilters(prev => !prev)}
                        >
                            <Filter size={18} />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="filter-count-badge">{activeFilterCount}</span>
                            )}
                            <ChevronDown size={14} className={`chevron ${showFilters ? 'open' : ''}`} />
                        </button>

                        {showFilters && (
                            <div className="filter-panel">
                                <div className="filter-panel-header">
                                    <h4>Filter Incidents</h4>
                                    {activeFilterCount > 0 && (
                                        <button className="clear-filters-btn" onClick={clearFilters}>
                                            <X size={13} /> Clear all
                                        </button>
                                    )}
                                </div>

                                <div className="filter-group">
                                    <label>Severity</label>
                                    <div className="filter-options">
                                        {['Critical', 'High', 'Medium', 'Low'].map(s => (
                                            <button
                                                key={s}
                                                className={`filter-tag filter-tag-${s.toLowerCase()} ${filters.severity === s ? 'selected' : ''}`}
                                                onClick={() => setFilters(f => ({ ...f, severity: f.severity === s ? '' : s }))}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="filter-group">
                                    <label>Status</label>
                                    <div className="filter-options">
                                        {['Active', 'Dispatched', 'Pending', 'Resolved'].map(s => (
                                            <button
                                                key={s}
                                                className={`filter-tag ${filters.status === s ? 'selected' : ''}`}
                                                onClick={() => setFilters(f => ({ ...f, status: f.status === s ? '' : s }))}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="filter-group">
                                    <label>Reporter Type</label>
                                    <div className="filter-options">
                                        {['Myself', 'Someone Else', 'Anonymous'].map(r => (
                                            <button
                                                key={r}
                                                className={`filter-tag ${filters.reporterType === r ? 'selected' : ''}`}
                                                onClick={() => setFilters(f => ({ ...f, reporterType: f.reporterType === r ? '' : r }))}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
                <div className="active-chips">
                    {filters.severity && (
                        <span className="chip chip-severity">
                            Severity: {filters.severity}
                            <X size={12} onClick={() => setFilters(f => ({ ...f, severity: '' }))} />
                        </span>
                    )}
                    {filters.status && (
                        <span className="chip">
                            Status: {filters.status}
                            <X size={12} onClick={() => setFilters(f => ({ ...f, status: '' }))} />
                        </span>
                    )}
                    {filters.reporterType && (
                        <span className="chip">
                            Reporter: {filters.reporterType}
                            <X size={12} onClick={() => setFilters(f => ({ ...f, reporterType: '' }))} />
                        </span>
                    )}
                    <span className="result-count">{incidents.length} result{incidents.length !== 1 ? 's' : ''}</span>
                </div>
            )}

            <div className={`table-container card ${isRefreshing ? 'refresh-flash' : ''}`}>
                <table className="incidents-table">
                    <thead>
                        <tr>
                            <th>Incident ID</th>
                            <th>Location</th>
                            <th>Time</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Reporter</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {incidents.length > 0 ? incidents.map((inc, index) => {
                            const isCriticalActive = inc.severity === 'Critical' && inc.status === 'Active';
                            return (
                            <tr 
                                key={inc.id} 
                                className={`row-animate-in row-severity-${inc.severity.toLowerCase()} ${isCriticalActive ? 'row-critical-active' : ''} ${selectedIncident?.id === inc.id ? 'row-selected' : ''}`}
                                style={{ animationDelay: `${index * 0.08}s` }}
                                onClick={() => handleRowClick(inc)}
                            >
                                <td className="font-mono text-white column-id">
                                    <div className="id-cell">
                                        {inc.severity === 'Critical' && <AlertTriangle size={15} className="text-danger bounce" />}
                                        <strong>{inc.shortId}</strong>
                                    </div>
                                </td>
                                <td className="column-location"><MapPin size={13} className="text-muted mr-1"/> {inc.location}</td>
                                <td className="column-time">{inc.time}</td>
                                <td>
                                    <span className={`badge-pill badge-${inc.severity.toLowerCase()}`}>
                                        {inc.severity}
                                    </span>
                                </td>
                                <td>
                                    <div className="status-cell">
                                        <span className={`status-dot status-dot-${inc.status.toLowerCase()} ${inc.status === 'Active' ? 'status-dot-active-pulse' : ''}`}></span>
                                        <span className={`status-text-${inc.status.toLowerCase()}`}>{inc.status}</span>
                                    </div>
                                </td>
                                <td className="text-muted column-reporter">{inc.reporterType}</td>
                                <td>
                                    <button 
                                        className="view-btn view-btn-primary" 
                                        onClick={(e) => { e.stopPropagation(); handleRowClick(inc); }}
                                    >
                                        <Eye size={15} className="view-icon"/> Quick View
                                    </button>
                                </td>
                            </tr>
                        )}) : (
                            <tr>
                                <td colSpan={7} className="no-results">No incidents match your filters.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Live Incident Side Panel */}
            <div className={`incident-side-panel ${isPanelOpen ? 'open' : ''}`}>
                {selectedIncident && (
                    <div className="side-panel-content">
                        <div className="side-panel-header">
                            <div className="header-id">
                                <AlertTriangle size={18} className={`text-${selectedIncident.severity === 'Critical' ? 'danger' : 'warning'}`} />
                                <h3>{selectedIncident.shortId}</h3>
                            </div>
                            <button className="panel-close-btn" onClick={(e) => { e.stopPropagation(); closePanel(); }}><X size={20} /></button>
                        </div>

                        <div className="panel-status-strip">
                            <span className={`status-dot status-dot-${selectedIncident.status.toLowerCase()} status-dot-active-pulse`}></span>
                            <span className="status-label">Status: <strong>{selectedIncident.status === 'Active' ? 'Waiting for Response' : selectedIncident.status}</strong></span>
                        </div>

                        <div className="panel-map-preview card">
                            <div className="mini-map-header">
                                <MapPin size={14} /> <span>Live Location Preview</span>
                            </div>
                            <div style={{ height: '220px', width: '100%', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                                {!isLoaded || loadError ? (
                                    <MapFallback error={loadError} />
                                ) : (
                                    <GoogleMap 
                                        center={{ lat: selectedIncident.lat, lng: selectedIncident.lng }} 
                                        zoom={14} 
                                        mapContainerStyle={{ height: '100%', width: '100%' }}
                                        options={{ styles: darkMapStyle, disableDefaultUI: true }}
                                    >
                                        <MarkerF 
                                            position={{ lat: selectedIncident.lat, lng: selectedIncident.lng }} 
                                            icon={markerIcons.incident}
                                        />
                                        <div className="map-coords" style={{ zIndex: 1000, position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(15,23,42,0.85)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}>
                                            {selectedIncident.location}
                                        </div>
                                    </GoogleMap>
                                )}
                            </div>
                        </div>

                        <div className="panel-section">
                            <label><User size={14} /> Reporter Details</label>
                            <div className="reporter-info-box card">
                                <div className="info-row">
                                    <span className="lbl">Name:</span>
                                    <span className="val">{selectedIncident.reporterName}</span>
                                </div>
                                <div className="info-row">
                                    <span className="lbl">Phone:</span>
                                    <span className="val">{selectedIncident.reporterPhone}</span>
                                </div>
                                <div className="info-row">
                                    <span className="lbl">Type:</span>
                                    <span className="val">{selectedIncident.reporterType}</span>
                                </div>
                            </div>
                        </div>

                        {/* User History Feature (Consistency) */}
                        <div className="panel-section">
                            <label><Clock size={14} /> Reporter History</label>
                            <div className="history-web-list-mini card">
                                {reporterHistory.length === 0 ? (
                                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>First time reporter.</div>
                                ) : (
                                    reporterHistory.slice(0, 3).map((item, idx) => (
                                        <div key={idx} className="history-web-item">
                                            <div className="history-web-dot"></div>
                                            <div className="history-web-info">
                                                <div className="history-web-row">
                                                    <strong>{item.type} Emergency</strong>
                                                    <span className="history-web-date">
                                                        {new Date(item.reportedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="panel-actions">
                            <button className="panel-action-btn panel-action-primary" onClick={() => handleViewFullDetails(selectedIncident.id)}>
                                View Full Incident File
                            </button>
                            <button 
                                className="panel-action-btn outline-btn"
                                onClick={() => setShowCommsModal(true)}
                            >
                                <RadioIcon size={16} /> Initiate Voice/Chat
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCommsModal && selectedIncident && (
                <SecureCommsModal 
                    isOpen={showCommsModal} 
                    onClose={() => setShowCommsModal(false)} 
                    incidentId={selectedIncident.id || selectedIncident.shortId}
                    reporterPhone={selectedIncident.reporterPhone}
                />
            )}
        </div>
    );
}
