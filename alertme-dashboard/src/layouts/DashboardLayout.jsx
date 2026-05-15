import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './DashboardLayout.css';
import apiClient from '../services/apiClient';

export default function DashboardLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const knownIncidentIds = useRef(new Set());
    const navigate = useNavigate();

    useEffect(() => {
        // Request Notification Permission on mount
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }

        const pollActiveIncidents = async () => {
            try {
                const res = await apiClient.get('/incidents/active');
                if (res.data) {
                    const currentIds = new Set(knownIncidentIds.current);
                    let newIncidents = [];

                    res.data.forEach(inc => {
                        const id = inc.incidentId || inc.id;
                        if (!currentIds.has(id)) {
                            newIncidents.push(inc);
                            knownIncidentIds.current.add(id);
                        }
                    });

                    // Trigger notifications for new incidents if it isn't the very first page load map
                    if (currentIds.size > 0 && newIncidents.length > 0) {
                        if (Notification.permission === "granted") {
                            newIncidents.forEach(inc => {
                                const notif = new Notification("🚨 New Emergency Alert", {
                                    body: `${inc.type} reported near ${inc.location?.approximateAddress || 'Unknown Location'}`,
                                    requireInteraction: true // Stays on screen until dispatcher clicks
                                });
                                
                                notif.onclick = () => {
                                    window.focus();
                                    navigate(`/incident/${inc.incidentId || inc.id}`);
                                };
                            });
                        }
                    } else if (currentIds.size === 0) {
                        // Seed the original state silently
                        res.data.forEach(inc => knownIncidentIds.current.add(inc.incidentId || inc.id));
                    }
                }
            } catch (err) {
                console.error("Dashboard Background Polling Failed", err);
            }
        };

        const timer = setInterval(pollActiveIncidents, 5000);
        pollActiveIncidents();

        return () => clearInterval(timer);
    }, [navigate]);

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
            <main className={`main-content ${!isSidebarOpen ? 'collapsed' : ''}`}>
                <div className="content-wrapper">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
