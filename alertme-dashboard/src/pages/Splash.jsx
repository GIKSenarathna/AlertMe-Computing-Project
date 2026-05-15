import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import './Splash.css';

export default function Splash() {
    const navigate = useNavigate();

    useEffect(() => {
        // Simulate loading data and initial auth check
        const timer = setTimeout(() => {
            navigate('/login');
        }, 2500);

        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="splash-container">
            <div className="branding">
                <ShieldAlert size={80} className="splash-icon" />
                <h1 className="splash-title">AlertMe</h1>
                <p className="splash-subtitle">Emergency Monitoring & Predictive Analytics</p>
            </div>
            <div className="loading-bar-container">
                <div className="loading-bar"></div>
            </div>
            <p className="loading-text">Initializing Secure Connection...</p>
        </div>
    );
}
