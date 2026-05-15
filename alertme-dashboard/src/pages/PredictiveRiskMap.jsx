import React, { useState, useEffect } from 'react';
import { Map, Layers, AlertTriangle, TrendingUp, Activity, Clock } from 'lucide-react';
import { GoogleMap, Circle as GoogleCircle, InfoWindowF } from '@react-google-maps/api';
import { useGoogleMaps, defaultCenter, darkMapStyle, MapFallback } from '../services/googleMapsConfig';
import apiClient from '../services/apiClient';
import './PredictiveRiskMap.css';

const DATE_DAYS = { last7: 7, last30: 30, last90: 90, year: 365 };

export default function PredictiveRiskMap() {
    const { isLoaded, loadError } = useGoogleMaps();
    const [selectedSeverity, setSelectedSeverity] = useState('all');
    const [selectedDate, setSelectedDate] = useState('last30');
    const [hoveredZone, setHoveredZone] = useState(null);
    const [selectedZone, setSelectedZone] = useState(null);
    const [simulationText, setSimulationText] = useState(null);
    const [allClusters, setAllClusters] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchClusters = async (days) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/analytics/risk-clusters?days=${days}`);
            setAllClusters(res.data || []);
        } catch (err) {
            console.error('Failed to fetch risk clusters:', err);
            setAllClusters([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClusters(DATE_DAYS[selectedDate]);
    }, [selectedDate]);

    const handleRunPrediction = () => {
        setSimulationText("Analyzing patterns...");
        setTimeout(() => setSimulationText("Generating risk clusters..."), 1200);
        setTimeout(() => {
            setSimulationText(null);
            fetchClusters(DATE_DAYS[selectedDate]);
        }, 2500);
    };

    const filteredClusters = allClusters.filter(c =>
        selectedSeverity === 'all' || c.risk.toLowerCase() === selectedSeverity
    );

    const dateLabel = {
        last7: 'Last 7 Days',
        last30: 'Last 30 Days',
        last90: 'Last 3 Months',
        year: 'Last Year',
    }[selectedDate];

    return (
        <div className="risk-map-page">
            <div className="page-header">
                <div>
                    <h1>Predictive Risk Map</h1>
                    <p>Machine learning powered accident-prone zone analysis</p>
                </div>
                <div className="header-actions">
                    <button 
                        className="btn-simulate-prediction" 
                        onClick={handleRunPrediction} 
                        disabled={simulationText !== null}
                    >
                        {simulationText ? <><Activity size={16} className="spin-icon"/> {simulationText}</> : 'Run Prediction'}
                    </button>
                    <div className="ai-status-wrapper">
                        <div className="system-status risk-ai-status">
                            <span className="status-dot green-pulse"></span>
                            <span>AI Model Active • Last updated: 2 min ago</span>
                        </div>
                        <div className="ai-accuracy-stat">
                            Model Confidence: <strong>{allClusters.length > 0 ? Math.round(allClusters.reduce((acc, c) => acc + (c.confidence || 0), 0) / allClusters.length) : 0}%</strong> &nbsp;|&nbsp; Engine: <strong>DBSCAN ML</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className="risk-controls card">
                <div className="control-group">
                    <label>Severity Filter</label>
                    <select className="dark-select" value={selectedSeverity} onChange={e => setSelectedSeverity(e.target.value)}>
                        <option value="all">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
                <div className="control-group">
                    <label>Date Range Analysis</label>
                    <select className="dark-select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
                        <option value="last7">Last 7 Days</option>
                        <option value="last30">Last 30 Days</option>
                        <option value="last90">Last 3 Months</option>
                        <option value="year">Last Year</option>
                    </select>
                </div>
            </div>

            <div className="risk-layout">
                <div className="heatmap-container card">
                    <div className="card-header">
                        <h3><Map size={18} /> Accident Heatmap</h3>
                        <span className="ml-badge"><Activity size={12} className="mr-1" /> ML Powered</span>
                    </div>
                    <div className="heatmap-placeholder" style={{ position: 'relative', height: '550px' }}>
                        {!isLoaded || loadError ? (
                            <MapFallback error={loadError} />
                        ) : (
                            <GoogleMap 
                                center={{ lat: 7.0, lng: 80.0 }} 
                                zoom={8} 
                                mapContainerStyle={{ height: '100%', width: '100%', borderRadius: '12px' }}
                                options={{ styles: darkMapStyle, disableDefaultUI: true, zoomControl: true }}
                            >
                                {filteredClusters.map(c => {
                                    const color = c.risk === 'Critical' ? '#ef4444' : 
                                                  c.risk === 'High' ? '#f97316' : 
                                                  c.risk === 'Medium' ? '#eab308' : '#22c55e';
                                    return (
                                        <GoogleCircle 
                                            key={c.id}
                                            center={{ lat: parseFloat(c.lat) || 7.0, lng: parseFloat(c.lng) || 80.0 }}
                                            radius={c.risk === 'Critical' ? 8000 : c.risk === 'High' ? 6000 : c.risk === 'Medium' ? 4500 : 3000}
                                            options={{ 
                                                strokeColor: selectedZone === c.id ? '#ffffff' : color, 
                                                strokeOpacity: 1,
                                                strokeWeight: selectedZone === c.id ? 3 : 1,
                                                fillColor: color, 
                                                fillOpacity: simulationText !== null ? 0.05 : 0.45
                                            }}
                                            onClick={() => setSelectedZone(c.id === selectedZone ? null : c.id)}
                                            onMouseOver={() => setHoveredZone(c.id)}
                                            onMouseOut={() => setHoveredZone(null)}
                                        />
                                    );
                                })}
                                {/* Tooltip for hovered or selected zone */}
                                {filteredClusters.filter(c => c.id === hoveredZone || c.id === selectedZone).map(c => {
                                    const color = c.risk === 'Critical' ? '#ef4444' : 
                                                  c.risk === 'High' ? '#f97316' : 
                                                  c.risk === 'Medium' ? '#eab308' : '#22c55e';
                                    return (
                                        <InfoWindowF 
                                            key={`info-${c.id}`}
                                            position={{ lat: parseFloat(c.lat) || 7.0, lng: parseFloat(c.lng) || 80.0 }}
                                            options={{ pixelOffset: new window.google.maps.Size(0, -20) }}
                                        >
                                            <div style={{ color: '#0f172a', minWidth: '100px' }}>
                                                <strong style={{ fontSize: '14px' }}>{c.name}</strong><br/>
                                                Risk: <strong style={{ color }}>{c.risk}</strong><br/>
                                                {c.incidents} incidents tracked
                                            </div>
                                        </InfoWindowF>
                                    );
                                })}
                            </GoogleMap>
                        )}

                        <div className="heatmap-legend" style={{ zIndex: 1000 }}>
                            <div className="legend-title" style={{ fontSize: '12px', color: 'white', marginBottom: '8px', fontWeight: 'bold' }}>Alert Risk Intensity</div>
                            <div className="legend-gradient-bar" style={{ height: '8px', width: '140px', background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)', borderRadius: '4px', marginBottom: '6px' }}></div>
                            <div className="legend-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                                <span>Low</span>
                                <span>Critical</span>
                            </div>
                        </div>

                        <div className="heatmap-status-bar" style={{ zIndex: 1000 }}>
                            <span className="status-dot red-pulse" style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span>
                            <span>AI Predictive Overlay Active &nbsp;•&nbsp; {filteredClusters.length} Zone{filteredClusters.length !== 1 ? 's' : ''} Detected</span>
                        </div>
                    </div>
                </div>

                <div className="risk-cluster-list card">
                    <div className="card-header">
                        <h3><Layers size={18} /> High-Risk Clusters</h3>
                        <span className="cluster-count">{filteredClusters.length} of {allClusters.length}</span>
                    </div>
                    <div className="cluster-items">
                        {loading ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                                <Activity size={20} className="spin-icon" style={{ marginBottom: '8px' }} />
                                <div>Loading real incident clusters...</div>
                            </div>
                        ) : filteredClusters.length === 0 ? (
                            <div className="no-clusters-msg">No incident clusters found for this period.</div>
                        ) : (
                            filteredClusters.map(c => (
                                <div 
                                    className={`cluster-item ${selectedZone === c.id ? 'cluster-selected' : ''}`} 
                                    key={c.id}
                                    onClick={() => setSelectedZone(c.id === selectedZone ? null : c.id)}
                                >
                                    <div className="cluster-top">
                                        <span className="cluster-name">{c.name}</span>
                                        <span className={`badge-pill badge-${c.risk.toLowerCase()}`}>
                                            {c.risk}
                                        </span>
                                    </div>
                                    
                                    <div className="cluster-stats-grid">
                                        <div className="cluster-stat-box">
                                            <span className="text-danger"><AlertTriangle size={13} /> {c.incidents} incidents</span>
                                        </div>
                                        <div className="cluster-stat-box">
                                            <span className="ml-confidence-badge">
                                                <div className="confidence-label">Confidence</div>
                                                <div className="confidence-value">{c.confidence}%</div>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="cluster-trends mt-2">
                                        <div className={`trend-pill ${c.trend.includes('↑') ? 'trend-up' : c.trend.includes('↓') ? 'trend-down' : 'trend-stable'}`}>
                                            <Activity size={12} /> {c.trend}
                                        </div>
                                    </div>
                                    
                                    <div className="cluster-peak-time">
                                        <Clock size={14}/> ⏱ Peak: <strong>{c.peakTime}</strong> on <strong>{c.peakDay || 'Anyday'}</strong>
                                    </div>

                                    {/* Actionability Panel */}
                                    <div className="cluster-actionability mt-2">
                                        <div className="action-title">Recommended Action:</div>
                                        <ul className="action-list">
                                            {c.action.map((act, idx) => (
                                                <li key={idx}>• {act}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    <div className="cluster-coords text-mono mt-2">GPS: {parseFloat(c.lat).toFixed(4)}°N, {parseFloat(c.lng).toFixed(4)}°E</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
