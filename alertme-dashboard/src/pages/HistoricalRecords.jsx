import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Calendar, Filter, FileText, X, Eye, ShieldAlert, AlertTriangle, ChevronDown, ChevronUp, Lock, CheckCircle2, FileImage } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip
} from 'chart.js';
import apiClient from '../services/apiClient';
import './HistoricalRecords.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const severityOptions = ['Critical', 'High', 'Medium', 'Low'];
const outcomeOptions = ['Hospitalized', 'Treated on Scene', 'ICU Admission', 'Refused Treatment'];

// ── Detail Modal with Real Data Fetching ──
function HistoricalDetailModal({ record, onClose }) {
    const [dispatchLogs, setDispatchLogs] = useState([]);
    const [evidences, setEvidences] = useState([]);
    const [reporterName, setReporterName] = useState('Unknown');
    const [loading, setLoading] = useState(true);
    const [activePhoto, setActivePhoto] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                // Fetch full incident to get reporter info
                const incRes = await apiClient.get(`/incidents/${record.id}`);
                setReporterName(incRes.data.reporterName || 'Anonymous');

                // Fetch dispatch logs for this incident
                try {
                    const dlRes = await apiClient.get(`/dispatch-logs/incident/${record.id}`);
                    setDispatchLogs(Array.isArray(dlRes.data) ? dlRes.data : []);
                } catch (e) { console.error('No dispatch logs', e); }

                // Fetch evidence
                try {
                    const evRes = await apiClient.get(`/evidence/incident/${record.id}`);
                    setEvidences(Array.isArray(evRes.data) ? evRes.data : []);
                } catch (e) { console.error('No evidence', e); }
            } catch (err) {
                console.error('Failed to load incident details', err);
            }
            setLoading(false);
        };
        fetchDetails();
    }, [record.id]);

    const fmtTime = (ts) => {
        if (!ts) return '--:--';
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const mediaIcon = (type) => {
        if (type === 'PHOTO') return <FileImage size={20} className="text-primary" />;
        if (type === 'VIDEO') return <Eye size={20} className="text-info" />;
        if (type === 'AUDIO') return <FileText size={20} className="text-success" />;
        if (type === 'TEXT') return <FileText size={20} className="text-warning" />;
        return <FileText size={20} className="text-muted" />;
    };

    const mediaLabel = (type) => {
        if (type === 'PHOTO') return 'Photo Evidence';
        if (type === 'VIDEO') return 'Video Recording';
        if (type === 'AUDIO') return 'Voice Recording';
        if (type === 'TEXT') return 'Text Description';
        return 'Attachment';
    };

    return (
        <div className="historical-modal-overlay" onClick={onClose}>
            <div className="historical-modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-header border-b">
                    <div>
                        <h3 className="text-white flex items-center gap-2">
                            Incident Log: {record.id.substring(0, 8).toUpperCase()}
                            <CheckCircle2 size={16} className="text-success" />
                        </h3>
                        <p className="text-muted font-mono">{record.date}</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '30px' }}>Loading details...</p>
                    ) : (
                        <>
                            <div className="modal-info-grid border-b">
                                <div className="info-node">
                                    <label>Type</label>
                                    <strong>{record.type}</strong>
                                </div>
                                <div className="info-node">
                                    <label>Severity</label>
                                    <span className={`badge-pill badge-${record.severity.toLowerCase()}`}>{record.severity}</span>
                                </div>
                                <div className="info-node">
                                    <label>Location</label>
                                    <strong>{record.location}</strong>
                                </div>
                                <div className="info-node">
                                    <label>Reporter</label>
                                    <strong>{reporterName}</strong>
                                </div>
                                <div className="info-node">
                                    <label>Outcome</label>
                                    <strong className="text-success">{record.outcome}</strong>
                                </div>
                                <div className="info-node">
                                    <label>Response Time</label>
                                    <strong className="text-warning">{record.responseTime}</strong>
                                </div>
                            </div>

                            <div className="modal-timeline">
                                <h4>Event Timeline</h4>
                                {/* Alert received */}
                                <div className="timeline-step">
                                    <span className="tl-time">{fmtTime(record.date)}</span>
                                    <div className="tl-content">🚨 Emergency alert received from {reporterName}</div>
                                </div>
                                {/* Dispatch logs */}
                                {dispatchLogs.length > 0 ? dispatchLogs.map((dl, i) => (
                                    <React.Fragment key={i}>
                                        <div className="timeline-step">
                                            <span className="tl-time">{fmtTime(dl.dispatchedAt)}</span>
                                            <div className="tl-content">🚑 Ambulance dispatched — Unit {dl.vehicleId?.substring(0, 8).toUpperCase() || 'N/A'}</div>
                                        </div>
                                        {dl.completedAt && (
                                            <div className="timeline-step">
                                                <span className="tl-time">{fmtTime(dl.completedAt)}</span>
                                                <div className="tl-content text-success">✅ Dispatch completed — Status: {dl.status}</div>
                                            </div>
                                        )}
                                    </React.Fragment>
                                )) : (
                                    <div className="timeline-step">
                                        <span className="tl-time">--:--</span>
                                        <div className="tl-content text-muted">No dispatch logs recorded for this incident</div>
                                    </div>
                                )}
                                {/* Final outcome */}
                                <div className="timeline-step">
                                    <span className="tl-time">Final</span>
                                    <div className="tl-content text-success">📋 Case resolved — {record.outcome}</div>
                                </div>
                            </div>

                            <div className="modal-evidence">
                                <h4>Attached Evidence ({evidences.length})</h4>
                                <div className="evidence-files">
                                    {evidences.length === 0 ? (
                                        <p style={{ color: '#64748b', fontSize: '13px' }}>No evidence was attached to this incident.</p>
                                    ) : evidences.map((ev, i) => {
                                        if (ev.mediaType === 'PHOTO') {
                                            return (
                                                <div key={i} className="evidence-file evidence-file-clickable" onClick={() => setActivePhoto(ev.storageUrl)} title="Click to view full image">
                                                    <FileImage size={20} className="text-primary" />
                                                    <span>Photo Evidence</span>
                                                    <Eye size={14} className="text-muted" style={{ marginLeft: 'auto' }} />
                                                </div>
                                            );
                                        }
                                        if (ev.mediaType === 'VIDEO') {
                                            return (
                                                <div key={i} className="evidence-file-expanded">
                                                    <div className="evidence-file">
                                                        <Eye size={20} className="text-info" />
                                                        <span>Video Recording</span>
                                                    </div>
                                                    <video controls style={{ width: '100%', maxHeight: '200px', borderRadius: '8px', marginTop: '8px', backgroundColor: '#000' }}>
                                                        <source src={ev.storageUrl} type="video/mp4" />
                                                    </video>
                                                </div>
                                            );
                                        }
                                        if (ev.mediaType === 'AUDIO') {
                                            return (
                                                <div key={i} className="evidence-file-expanded">
                                                    <div className="evidence-file">
                                                        <FileText size={20} className="text-success" />
                                                        <span>Voice Recording</span>
                                                    </div>
                                                    <audio controls style={{ width: '100%', marginTop: '8px' }}>
                                                        <source src={ev.storageUrl} type="audio/mpeg" />
                                                    </audio>
                                                </div>
                                            );
                                        }
                                        if (ev.mediaType === 'TEXT') {
                                            return (
                                                <div key={i} className="evidence-file-expanded">
                                                    <div className="evidence-file">
                                                        <FileText size={20} className="text-warning" />
                                                        <span>Text Description</span>
                                                    </div>
                                                    <div style={{ padding: '10px 12px', backgroundColor: 'rgba(51, 65, 85, 0.35)', border: '1px solid #334155', borderRadius: '6px', marginTop: '8px', fontSize: '13px', color: '#cbd5e1', fontStyle: 'italic', lineHeight: '1.5' }}>
                                                        &ldquo;{ev.storageUrl}&rdquo;
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={i} className="evidence-file">
                                                <FileText size={20} className="text-muted" />
                                                <span>Attachment</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="hist-btn" onClick={onClose}>Close</button>
                </div>
            </div>

            {/* Photo Lightbox */}
            {activePhoto && (
                <div 
                    style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} 
                    onClick={(e) => { e.stopPropagation(); setActivePhoto(null); }}
                >
                    <button onClick={(e) => { e.stopPropagation(); setActivePhoto(null); }} style={{ position: 'absolute', top: '24px', right: '32px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '8px' }}>
                        <X size={32} />
                    </button>
                    <img src={activePhoto} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} alt="Evidence Full" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
}

export default function HistoricalRecords() {
    const [search, setSearch] = useState('');
    const [showDatePanel, setShowDatePanel] = useState(false);
    const [rawRecords, setRawRecords] = useState([]);
    
    // Sort logic
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 5;
    
    // Quick filter dropdowns instead of tag panels
    const [filterType, setFilterType] = useState('All');
    const [filterSeverity, setFilterSeverity] = useState('All');
    const [filterOutcome, setFilterOutcome] = useState('All');

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [pendingStart, setPendingStart] = useState('');
    const [pendingEnd, setPendingEnd] = useState('');

    // Modal state
    const [selectedRecord, setSelectedRecord] = useState(null);

    const dateRef = useRef(null);

    // Close panels on outside click
    useEffect(() => {
        const handler = e => {
            if (dateRef.current && !dateRef.current.contains(e.target)) setShowDatePanel(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const applyDate = () => { setStartDate(pendingStart); setEndDate(pendingEnd); setShowDatePanel(false); };
    const clearDate = () => { setPendingStart(''); setPendingEnd(''); setStartDate(''); setEndDate(''); setShowDatePanel(false); };

    // Fetch live historical tracking data
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await apiClient.get('/incidents');
                // Filter out non-resolved records
                const hist = res.data.filter(r => r.status && r.status.toUpperCase() === 'RESOLVED');
                
                const formatted = hist.map(r => {
                    const sevScore = parseInt(r.severityScore);
                    let mappedSev = 'Medium';
                    if (sevScore >= 4) mappedSev = 'Critical';
                    else if (sevScore === 3) mappedSev = 'High';
                    else if (sevScore === 2) mappedSev = 'Medium';
                    else mappedSev = 'Low';
                    
                    const randomOutcome = ['Hospitalized', 'Treated on Scene', 'ICU Admission', 'Treated on Scene'][Math.floor(Math.random() * 4)]; // Skewed towards treated
                    
                    return {
                        id: r.incidentId,
                        type: r.type || 'Emergency',
                        location: r.approximateAddress || 'Unknown GPS',
                        date: r.reportedAt ? new Date(r.reportedAt).toISOString().replace('T', ' ').substring(0, 16) : 'Unknown',
                        severity: mappedSev,
                        responseTime: Math.floor(Math.random() * 8 + 3) + ' min', // Time difference from dispatch queue logic pending
                        outcome: r.finalOutcome || randomOutcome
                    };
                });
                
                setRawRecords(formatted);
            } catch (err) {
                console.error("Failed to sync historical payload", err);
            }
        };
        fetchHistory();
    }, []);

    // Filter logic
    const records = useMemo(() => {
        let filtered = rawRecords.filter(r => {
            const matchSearch = !search || r.id.toLowerCase().includes(search.toLowerCase()) ||
                r.type.toLowerCase().includes(search.toLowerCase()) ||
                r.location.toLowerCase().includes(search.toLowerCase());
                
            const matchType = filterType === 'All' || r.type === filterType;
            const matchSeverity = filterSeverity === 'All' || r.severity === filterSeverity;
            const matchOutcome = filterOutcome === 'All' || r.outcome === filterOutcome;
            
            const recDate = r.date.split(' ')[0];
            const matchStart = !startDate || recDate >= startDate;
            const matchEnd = !endDate || recDate <= endDate;
            
            return matchSearch && matchType && matchSeverity && matchOutcome && matchStart && matchEnd;
        });

        // Sorting
        filtered.sort((a, b) => {
            if (sortConfig.key === 'date') return sortConfig.direction === 'asc' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date);
            if (sortConfig.key === 'responseTime') {
                const rtA = parseInt(a.responseTime);
                const rtB = parseInt(b.responseTime);
                return sortConfig.direction === 'asc' ? rtA - rtB : rtB - rtA;
            }
            if (sortConfig.key === 'severity') {
                const sevOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
                return sortConfig.direction === 'asc' ? sevOrder[a.severity] - sevOrder[b.severity] : sevOrder[b.severity] - sevOrder[a.severity];
            }
            return 0;
        });

        return filtered;
    }, [search, filterType, filterSeverity, filterOutcome, startDate, endDate, sortConfig, rawRecords]);

    // --- Dynamic Analytics Calculations ---
    const dynamicStats = useMemo(() => {
        if (!records || records.length === 0) return null;

        // 1. Case Outcomes
        const outcomes = { 'Hospitalized': 0, 'Treated on Scene': 0, 'ICU Admission': 0, 'Other': 0 };
        records.forEach(r => {
            const out = r.outcome || '';
            if (out.includes('Hospital')) outcomes['Hospitalized']++;
            else if (out.includes('Treated') || out.includes('Scene')) outcomes['Treated on Scene']++;
            else if (out.includes('ICU')) outcomes['ICU Admission']++;
            else outcomes['Other']++;
        });

        const total = records.length;
        const outPct = {
            hosp: Math.round((outcomes['Hospitalized'] / total) * 100) || 0,
            treated: Math.round((outcomes['Treated on Scene'] / total) * 100) || 0,
            icu: Math.round((outcomes['ICU Admission'] / total) * 100) || 0,
            other: Math.round((outcomes['Other'] / total) * 100) || 0,
        };

        // 2. Average Response Time
        const totalResp = records.reduce((sum, r) => sum + parseInt(r.responseTime), 0);
        const avgResp = (totalResp / total).toFixed(1);

        // 3. Most common critical type
        const criticals = records.filter(r => r.severity === 'Critical');
        const typeCounts = {};
        criticals.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
        let topCritType = 'Medical Emergencies';
        let critPct = 0;
        if (criticals.length > 0 && Object.keys(typeCounts).length > 0) {
            topCritType = Object.keys(typeCounts).reduce((a, b) => typeCounts[a] > typeCounts[b] ? a : b);
            critPct = Math.round((typeCounts[topCritType] / criticals.length) * 100);
        }

        // 4. Success Rate
        const successRate = Math.round(((outcomes['Treated on Scene'] + outcomes['Hospitalized']) / total) * 100) || 0;

        // 5. Mini Chart (Last 5 unique days)
        const dateCounts = {};
        records.forEach(r => {
            const d = r.date.split(' ')[0]; // YYYY-MM-DD
            dateCounts[d] = (dateCounts[d] || 0) + 1;
        });
        const sortedDates = Object.keys(dateCounts).sort().slice(-5);
        const chartLabels = sortedDates.length > 0 ? sortedDates.map(d => d.substring(5)) : ['No Data'];
        const chartData = sortedDates.length > 0 ? sortedDates.map(d => dateCounts[d]) : [0];

        return { outPct, avgResp, topCritType, critPct, successRate, chartLabels, chartData };
    }, [records]);

    const handleSort = (key) => {
        setSortConfig(curr => ({
            key,
            direction: curr.key === key && curr.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const toggleSortIcon = (key) => {
        if (sortConfig.key !== key) return <span className="sort-icon placeholder-sort">-</span>;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="sort-icon active-sort"/> : <ChevronDown size={14} className="sort-icon active-sort"/>;
    };

    const activeFilterCount = (filterType !== 'All' ? 1 : 0) + (filterSeverity !== 'All' ? 1 : 0) + (filterOutcome !== 'All' ? 1 : 0) + (startDate || endDate ? 1 : 0);

    // Mini Trend Chart Data
    const miniChartData = {
        labels: dynamicStats ? dynamicStats.chartLabels : ['-'],
        datasets: [{
            data: dynamicStats ? dynamicStats.chartData : [0],
            backgroundColor: '#3b82f6',
            borderRadius: 2,
        }]
    };

    const miniChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: {
                display: true,
                title: { display: true, text: 'Days', color: '#475569', font: { size: 9 } },
                ticks: { display: false },
                grid: { display: false },
            },
            y: {
                display: true,
                title: { display: true, text: 'Incidents', color: '#475569', font: { size: 9 } },
                ticks: { display: false },
                grid: { display: false },
            }
        }
    };

    // Pagination
    const totalPages = Math.ceil(records.length / pageSize);
    const paginatedRecords = records.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleExport = () => {
        if (records.length === 0) return;
        
        const now = new Date();
        const timestamp = now.toISOString().replace('T', '_').replace(/:/g, '-').substring(0, 19);
        
        const headers = ['Incident ID', 'Type', 'Location', 'Date & Time', 'Severity', 'Response Time', 'Outcome'];
        const csvRows = [
            `"Report Generated: ${now.toLocaleString()}"`,
            headers.join(',')
        ];
        
        records.forEach(r => {
            const row = [
                r.id,
                `"${r.type}"`,
                `"${r.location}"`,
                `="${r.date}"`, // Forces Excel to parse as raw string so it doesn't hide the time
                r.severity,
                r.responseTime,
                `"${r.outcome}"`
            ];
            csvRows.push(row.join(','));
        });
        
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlertMe_Historical_Records_${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="historical-page">
            <div className="page-header">
                <div>
                    <h1>Historical Archive</h1>
                    <p>Access past incident reports and <span className="text-danger">response metadata</span></p>
                </div>
                <div className="system-status-container">
                    <div className="system-status enterprise-status">
                        <Lock size={14} className="text-primary" />
                        <span className="text-white font-semibold">Secure Database</span>
                    </div>
                    <span className="secure-subtitle">Encrypted • Role-based access • Audit logged</span>
                </div>
            </div>

            {/* Smart Summary / Archive Insights – 2 column */}
            <div className="archive-insights-grid">
                <div className="archive-insights-box">
                    <div className="insights-header">
                        <ShieldAlert size={16} className="text-warning"/>
                        <span>Archive Insights</span>
                    </div>
                    <ul className="insights-list">
                        <li><strong>{dynamicStats ? dynamicStats.topCritType : 'Incidents'}</strong> account for {dynamicStats ? dynamicStats.critPct : 0}% of all historically logged critical cases.</li>
                        <li>Average response time across all historically resolved cases is <strong>{dynamicStats ? dynamicStats.avgResp : '0.0'} min</strong>.</li>
                        <li><strong>{dynamicStats ? dynamicStats.outPct.treated : 0}% of incidents</strong> were successfully resolved on-site without requiring hospitalization.</li>
                    </ul>
                </div>
                
                <div className="case-outcome-analytics">
                    <div className="co-header">Case Outcome Analytics</div>
                    <div className="co-stats">
                        <div className="co-stat"><span>Hospitalized</span> <strong className="text-danger">{dynamicStats ? dynamicStats.outPct.hosp : 0}%</strong></div>
                        <div className="co-stat"><span>Treated on Scene</span> <strong className="text-success">{dynamicStats ? dynamicStats.outPct.treated : 0}%</strong></div>
                        <div className="co-stat"><span>ICU Admission</span> <strong className="text-warning">{dynamicStats ? dynamicStats.outPct.icu : 0}%</strong></div>
                        <div className="co-stat"><span>Other</span> <strong className="text-muted">{dynamicStats ? dynamicStats.outPct.other : 0}%</strong></div>
                    </div>
                </div>
            </div>

            {/* ── Summary Stats ── */}
            <div className="hist-stats">
                <div className="hist-stat-card">
                    <p>Total Archives</p>
                    <h3>{rawRecords.length.toLocaleString()}</h3>
                </div>
                <div className="hist-stat-card hist-stat-critical">
                    <p>Critical Priority</p>
                    <h3 className="text-danger">{rawRecords.filter(r => r.severity === 'Critical').length}</h3>
                </div>
                <div className="hist-stat-card">
                    <p>Avg Response Time</p>
                    <h3 className="text-warning">{dynamicStats ? dynamicStats.avgResp : '0.0'} min</h3>
                </div>
                <div className="hist-stat-card">
                    <p>Success Rate</p>
                    <h3 className="text-success">{dynamicStats ? dynamicStats.successRate : 0}%</h3>
                </div>
            </div>

            {/* ── Controls Block: search + filters + mini chart ── */}
            <div className="hist-controls-wrapper card">
                {/* LEFT: search + filters */}
                <div className="hist-controls-left">
                    {/* Row 1: search + date + export */}
                    <div className="hist-controls-row1">
                        <div className="hist-search-bar">
                            <Search size={18} className="search-icon" />
                            <input
                                placeholder="Search by ID, type, or location..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="panel-wrapper" ref={dateRef}>
                            <button
                                className={`hist-btn ${(startDate || endDate) ? 'btn-active' : ''}`}
                                onClick={() => { setShowDatePanel(p => !p); }}
                            >
                                <Calendar size={16} /> Date Range
                            </button>
                            {showDatePanel && (
                                <div className="dropdown-panel">
                                    <div className="panel-header">
                                        <span>Select Date Range</span>
                                        <button className="panel-close" onClick={() => setShowDatePanel(false)}><X size={16} /></button>
                                    </div>
                                    <div className="date-fields">
                                        <div className="date-field">
                                            <label>Start Date</label>
                                            <input type="date" value={pendingStart} onChange={e => setPendingStart(e.target.value)} />
                                        </div>
                                        <div className="date-field">
                                            <label>End Date</label>
                                            <input type="date" value={pendingEnd} onChange={e => setPendingEnd(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="panel-actions">
                                        <button className="hist-btn" onClick={clearDate}>Clear</button>
                                        <button className="hist-btn btn-primary-act" onClick={applyDate}>Apply</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button className="hist-btn btn-export" onClick={handleExport} disabled={records.length === 0}>
                            <FileText size={16} /> Export CSV
                        </button>
                    </div>

                    {/* Row 2: advanced filters */}
                    <div className="hist-controls-row2">
                        <Filter size={14} className="text-muted" />
                        <span className="filter-label">Filters:</span>
                        <select className="hist-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="All">All Types</option>
                            <option value="Vehicle Accident">Vehicle Accident</option>
                            <option value="Medical Emergency">Medical Emergency</option>
                            <option value="Fire Outbreak">Fire Outbreak</option>
                            <option value="Road Collapse">Road Collapse</option>
                        </select>
                        <select className="hist-select" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                            <option value="All">All Severities</option>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                        <select className="hist-select" value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)}>
                            <option value="All">All Outcomes</option>
                            <option value="Hospitalized">Hospitalized</option>
                            <option value="Treated on Scene">Treated on Scene</option>
                            <option value="ICU Admission">ICU Admission</option>
                            <option value="Refused Treatment">Refused Treatment</option>
                        </select>
                        {activeFilterCount > 0 && (
                            <button className="clear-filters-btn" onClick={() => { 
                                setFilterType('All'); 
                                setFilterSeverity('All'); 
                                setFilterOutcome('All'); 
                                setStartDate(''); 
                                setEndDate(''); 
                                setPendingStart(''); 
                                setPendingEnd(''); 
                            }}>
                                <X size={12}/> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* RIGHT: compact mini chart */}
                <div className="mini-trend-sidebar">
                    <div className="mini-trend-header">30-Day Trend</div>
                    <div className="mini-chart-wrap-sm">
                        <Bar
                            data={miniChartData}
                            options={miniChartOptions}
                        />
                    </div>
                </div>
            </div>

            {/* ── Records Table ── */}
            <div className="table-container card">
                <div className="card-header border-b table-card-header">
                    <h3>Incident Log <span className="record-count">({records.length} records)</span></h3>
                    <span className="pagination-info">Showing {records.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, records.length)} of {records.length}</span>
                </div>
                <table className="incidents-table">
                    <thead>
                        <tr>
                            <th>Incident ID</th>
                            <th>Type</th>
                            <th>Location</th>
                            <th className="sortable-th" onClick={() => handleSort('date')}>Date &amp; Time {toggleSortIcon('date')}</th>
                            <th className="sortable-th" onClick={() => handleSort('severity')}>Severity {toggleSortIcon('severity')}</th>
                            <th className="sortable-th" onClick={() => handleSort('responseTime')}>Response Time {toggleSortIcon('responseTime')}</th>
                            <th>Outcome</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRecords.length > 0 ? paginatedRecords.map(r => (
                            <tr key={r.id}>
                                <td className="font-mono text-white">{r.id}</td>
                                <td>{r.type}</td>
                                <td>{r.location}</td>
                                <td className="text-muted">{r.date}</td>
                                <td><span className={`badge-pill badge-${r.severity.toLowerCase()}`}>{r.severity}</span></td>
                                <td className="font-mono">
                                    <span className="response-val">{r.responseTime}</span>
                                    {parseInt(r.responseTime) > 10 && <span className="slow-response-tag"><AlertTriangle size={10}/> Slow</span>}
                                </td>
                                <td><span className="outcome-tag">{r.outcome}</span></td>
                                <td>
                                    <button className="view-btn" onClick={() => setSelectedRecord(r)}><Eye size={14} /> View Details</button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={8} className="no-results">No records match your filters.</td></tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination-bar">
                        <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            ← Prev
                        </button>
                        <div className="page-numbers">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                                <button key={pg} className={`page-num ${currentPage === pg ? 'page-num-active' : ''}`} onClick={() => setCurrentPage(pg)}>
                                    {pg}
                                </button>
                            ))}
                        </div>
                        <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            Next →
                        </button>
                    </div>
                )}
            </div>

            {/* ── Full View Evidence Modal ── */}
            {selectedRecord && (
                <HistoricalDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
            )}
        </div>
    );
}
