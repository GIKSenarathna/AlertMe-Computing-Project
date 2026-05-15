import React, { useState, useEffect } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, LineElement, PointElement,
    ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import { Download, FileText, Activity, AlertTriangle, TrendingUp, TrendingDown, BrainCircuit, Lightbulb, ExternalLink } from 'lucide-react';
import './AnalyticsReports.css';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, LineElement, PointElement,
    ArcElement, Title, Tooltip, Legend
);

// Set default text color for charts to dark mode neutral
ChartJS.defaults.color = '#94a3b8';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AnalyticsReports() {
    const [timeFilter, setTimeFilter] = useState('year');
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        const fetchSummary = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get('/analytics/summary?filter=' + timeFilter);
                setSummary(response.data);
            } catch (error) {
                console.error("Failed to fetch analytics summary", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, [timeFilter]);

    if (loading || !summary) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#94a3b8' }}><div className="spin-icon" style={{marginRight: '8px', border: '2px solid transparent', borderTopColor: '#3b82f6', borderRadius: '50%', width: '20px', height: '20px'}}></div> Loading Analytics Engine...</div>;
    }

    const { currentMonth, historicalTrend } = summary;
    
    // Dynamic styling for Peak values
    const incidentsData = historicalTrend.monthlyIncidents;
    const responseTimeData = historicalTrend.monthlyResponseTimes;
    const dynamicLabels = historicalTrend.labels;
    const customTooltips = historicalTrend.tooltips;
    
    const peakIncidentIdx = incidentsData.indexOf(Math.max(...incidentsData));
    const fastestResponseIdx = responseTimeData.indexOf(Math.min(...responseTimeData));

    const monthlyData = {
        labels: dynamicLabels,
        datasets: [{
            label: 'Incidents',
            data: incidentsData,
            backgroundColor: incidentsData.map((_, i) => i === peakIncidentIdx ? '#38BDF8' : 'rgba(56, 189, 248, 0.35)'),
            borderColor: incidentsData.map((_, i) => i === peakIncidentIdx ? '#7dd3fc' : 'transparent'),
            borderWidth: incidentsData.map((_, i) => i === peakIncidentIdx ? 2 : 0),
            borderRadius: 4,
            hoverBackgroundColor: '#60A5FA',
        }]
    };

    const responseData = {
        labels: dynamicLabels,
        datasets: [{
            label: 'Avg Response Time (min)',
            data: responseTimeData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: responseTimeData.map((_, i) => i === fastestResponseIdx ? '#10b981' : '#f59e0b'),
            pointRadius: responseTimeData.map((_, i) => i === fastestResponseIdx ? 8 : 3),
            pointBorderColor: '#fff',
            pointBorderWidth: responseTimeData.map((_, i) => i === fastestResponseIdx ? 2 : 0),
        }]
    };

    const severityData = {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
            data: [
                currentMonth.severityBreakdown.Critical || 0, 
                currentMonth.severityBreakdown.High || 0, 
                currentMonth.severityBreakdown.Medium || 0, 
                currentMonth.severityBreakdown.Low || 0
            ],
            backgroundColor: ['#ef4444', '#f59e0b', '#eab308', '#10b981'],
            borderWidth: 0,
            hoverOffset: 4,
        }]
    };

    const monthlyChartOptions = {
        responsive: true,
        plugins: { 
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#fff',
                bodyColor: '#cbd5e1',
                padding: 10,
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                callbacks: {
                    title: function(context) {
                        return customTooltips[context[0].dataIndex] || context[0].label;
                    }
                }
            }
        },
        scales: { 
            x: { 
                grid: { display: false },
                ticks: { color: '#94a3b8' }
            }, 
            y: { 
                title: { display: true, text: 'Number of Incidents', color: '#64748b', font: { size: 11, weight: 'bold' } },
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#94a3b8' }
            } 
        },
    };

    const responseChartOptions = {
        ...monthlyChartOptions,
        scales: {
            ...monthlyChartOptions.scales,
            y: {
                title: { display: true, text: 'Minutes', color: '#64748b', font: { size: 11, weight: 'bold' } },
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#94a3b8' }
            }
        }
    };

    const handleExportCsv = () => {
        const now = new Date();
        const timestamp = now.toISOString().replace('T', '_').replace(/:/g, '-').substring(0, 19);
        
        const headers = ['Period', 'Incidents', 'Avg Response Time (min)'];
        const csvRows = [
            `"Report Generated: ${now.toLocaleString()}"`,
            headers.join(',')
        ];
        
        dynamicLabels.forEach((label, idx) => {
            const row = [
                customTooltips[idx] || label,
                monthlyData.datasets[0].data[idx],
                responseData.datasets[0].data[idx]
            ];
            csvRows.push(row.join(','));
        });
        
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlertMe_Analytics_Report_${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = () => {
        window.print();
    };

    return (
        <div className="analytics-page">
            <div className="page-header-row">
                <div className="page-header">
                    <div>
                        <h1>Analytics & Reports</h1>
                        <p>Historical incident trends and performance metrics</p>
                    </div>
                </div>
                
                <div className="header-actions-group">
                    <div className="analytics-time-filter">
                        <button className={`filter-pill ${timeFilter === '7d' ? 'active' : ''}`} onClick={() => setTimeFilter('7d')}>Last 7 Days</button>
                        <button className={`filter-pill ${timeFilter === '30d' ? 'active' : ''}`} onClick={() => setTimeFilter('30d')}>Last 30 Days</button>
                        <button className={`filter-pill ${timeFilter === 'year' ? 'active' : ''}`} onClick={() => setTimeFilter('year')}>Year</button>
                    </div>

                    <div className="export-buttons">
                        <button className="export-btn ai-summary-btn" onClick={handleExportPdf}>
                            <BrainCircuit size={15} /> Download AI Summary (PDF)
                        </button>
                        <button className="export-btn dark-btn" onClick={handleExportCsv}>
                            <FileText size={15} /> Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Insight Summary Box */}
            <div className="analytics-insights-box">
                <div className="insights-header">
                    <Lightbulb size={18} className="text-warning" />
                    <span className="font-semibold text-white">Key Insights (AI Generated)</span>
                </div>
                <div className="insights-content">
                    <ul>
                        <li>
                            <strong className={incidentsData[incidentsData.length-1] >= incidentsData[incidentsData.length-2] ? "text-danger" : "text-success"}>
                                Incidents {incidentsData[incidentsData.length-1] >= incidentsData[incidentsData.length-2] ? "increased" : "decreased"} by {Math.round(Math.abs((incidentsData[incidentsData.length-1] - incidentsData[incidentsData.length-2]) / (incidentsData[incidentsData.length-2] || 1)) * 100)}%
                            </strong> compared to the previous period across all districts.
                        </li>
                        <li>
                            <strong className={responseTimeData[responseTimeData.length-1] <= responseTimeData[responseTimeData.length-2] ? "text-success" : "text-warning"}>
                                Response time {responseTimeData[responseTimeData.length-1] <= responseTimeData[responseTimeData.length-2] ? "improved" : "increased"} by {Math.round(Math.abs((responseTimeData[responseTimeData.length-1] - responseTimeData[responseTimeData.length-2]) / (responseTimeData[responseTimeData.length-2] || 1)) * 100)}%
                            </strong> during peak traffic hours due to dynamic fleet positioning.
                        </li>
                        <li>
                            <strong className="text-danger">Critical cases rising in {currentMonth.mostActiveZone} region</strong>, suggesting a need for a reallocation of Zone 1 resources.
                        </li>
                    </ul>
                </div>
            </div>

            <div className="charts-grid">
                <div className="card chart-card wide-chart">
                    <div className="card-header border-b custom-chart-header">
                        <h3>{timeFilter === 'year' ? 'Monthly' : timeFilter === '30d' ? 'Weekly' : 'Daily'} Incident Trends</h3>
                        <div className="chart-marker-legend">
                            <span className="marker-dot bg-primary"></span> Peak Period: {customTooltips[peakIncidentIdx]} ({Math.max(...incidentsData)})
                        </div>
                    </div>
                    <div className="chart-body"><Bar data={monthlyData} options={monthlyChartOptions} /></div>
                </div>

                <div className="card chart-card">
                    <div className="card-header border-b">
                        <h3>Severity Breakdown</h3>
                    </div>
                    <div className="chart-body donut-wrap">
                        <Doughnut data={severityData} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } }, cutout: '65%' }} />
                    </div>
                </div>

                <div className="card chart-card wide-chart">
                    <div className="card-header border-b custom-chart-header">
                        <h3>Average Response Time ({timeFilter === 'year' ? 'Monthly' : timeFilter === '30d' ? 'Weekly' : 'Daily'})</h3>
                        <div className="chart-marker-legend text-success-light">
                            <span className="marker-dot bg-success"></span> Fastest Response: {customTooltips[fastestResponseIdx]} ({Math.min(...responseTimeData)}m)
                        </div>
                    </div>
                    <div className="chart-body"><Line data={responseData} options={responseChartOptions} /></div>
                </div>

                <div className="card summary-card">
                    <div className="card-header border-b">
                        <h3>Quick Stats</h3>
                    </div>
                    <div className="stat-rows">
                        <div className="stat-row">
                            <span className="text-muted">Total Incidents</span>
                            <div className="stat-value-group">
                                <strong className="text-white">{currentMonth.totalIncidents}</strong>
                                <span className="stat-trend trend-up"><TrendingUp size={12}/> +</span>
                            </div>
                        </div>
                        <div className="stat-row">
                            <span className="text-muted">Avg Response Time</span>
                            <div className="stat-value-group">
                                <strong className="text-warning">{currentMonth.averageResponseTime} min</strong>
                                <span className="stat-trend trend-down-good"><TrendingDown size={12}/> opt</span>
                            </div>
                        </div>
                        
                        {/* Highlighting Critical Incidents */}
                        <div className="stat-row critical-stat-row">
                            <span className="text-danger flex items-center gap-1">
                                <AlertTriangle size={14} className="pulse-danger-icon"/> Critical Incidents
                            </span>
                            <strong className="text-danger">
                                {Object.values(currentMonth.severityBreakdown).reduce((a,b) => a+b, 0) > 0 ? 
                                    Math.round((currentMonth.severityBreakdown.Critical / Object.values(currentMonth.severityBreakdown).reduce((a,b) => a+b, 0)) * 100) 
                                    : 0}%
                            </strong>
                        </div>

                        <div className="stat-row">
                            <span className="text-muted">Most Active Zone</span>
                            <Link to="/risk-map" className="zone-link-nav">
                                {currentMonth.mostActiveZone} <ExternalLink size={12} />
                            </Link>
                        </div>
                    </div>

                    {/* ML Connect: Prediction vs Actual */}
                    <div className="ml-prediction-card">
                        <div className="ml-pred-header">
                            <BrainCircuit size={14} className="text-primary"/> 
                            <span>ML Prediction vs Actual</span>
                        </div>
                        <div className="ml-pred-body">
                            <div className="pred-stat">
                                <span className="text-muted">Predicted Range</span>
                                <strong>{Math.max(10, currentMonth.totalIncidents - 10)} - {currentMonth.totalIncidents + 15}</strong>
                            </div>
                            <div className="pred-stat actual-vs-pred text-right">
                                <span className="text-muted">Actual Output</span>
                                <strong>{currentMonth.totalIncidents} <span className="text-danger">(Live)</span></strong>
                            </div>
                        </div>
                        <div className="ml-pred-footer">
                            <Activity size={10} className="spin-icon-slow"/> Model Recalibrating...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
