import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, Building, Users, Activity, Flame, Truck, BarChart2, AlertCircle, Loader2, Clock, MessageSquare } from 'lucide-react';
import AlertMeLogo from '../components/AlertMeLogo';
import apiClient from '../services/apiClient';
import { auth } from '../services/firebaseClient';
import { signInWithEmailAndPassword } from 'firebase/auth';
import './Login.css';

export default function Login() {
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPwTooltip, setShowPwTooltip] = useState(false);
    const [lastLoginStr, setLastLoginStr] = useState('Session Secure | Colombo HQ');

    useEffect(() => {
        const storedLogin = localStorage.getItem('lastLoginAt');
        if (storedLogin) {
            const date = new Date(storedLogin);
            const diffMs = new Date() - date;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            
            if (diffMins < 1) {
                setLastLoginStr(`Last login: Just now | Colombo HQ`);
            } else if (diffHours < 1) {
                setLastLoginStr(`Last login: ${diffMins} mins ago | Colombo HQ`);
            } else if (diffHours < 24) {
                setLastLoginStr(`Last login: ${diffHours} hours ago | Colombo HQ`);
            } else {
                const diffDays = Math.floor(diffHours / 24);
                setLastLoginStr(`Last login: ${diffDays} days ago | Colombo HQ`);
            }
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Please enter both username and password.');
            return;
        }

        setLoading(true);

        // Clear any stale session tokens before attempting a fresh login
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userRole');

        try {
            // Step 1: Sign in with Firebase using email + password
            const userCredential = await signInWithEmailAndPassword(auth, username.trim(), password);

            // Step 2: Get the Firebase ID token
            const idToken = await userCredential.user.getIdToken();

            // Step 3: Send the Firebase ID token to our backend for role verification
            const response = await apiClient.post('/auth/login', { idToken });

            const { token, role, name, userId } = response.data;

            // Block Citizens from accessing the Command Center
            const validRoles = ['ADMIN', 'MEDICAL', 'FIRE', 'POLICE'];
            if (!validRoles.includes(role)) {
                setError(`Access Denied: Unrecognized authority role (${role}).`);
                setLoading(false);
                return;
            }

            // Secure the tokens locally
            localStorage.setItem('jwtToken', token);
            localStorage.setItem('userRole', role);
            localStorage.setItem('dispatcherName', name);
            localStorage.setItem('dispatcherId', userId);
            localStorage.setItem('lastLoginAt', new Date().toISOString());

            navigate('/dashboard');
        } catch (err) {
            // ── Full diagnostics ──────────────────────────────────────────
            console.error('🔴 Login Error Object:', err);
            console.error('  err.code:', err.code);
            console.error('  err.message:', err.message);
            console.error('  err.response?.status:', err.response?.status);
            console.error('  err.response?.data:', err.response?.data);
            // ─────────────────────────────────────────────────────────────

            const code = err.code;
            if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setError('Invalid email or password. Please try again.');
            } else if (code === 'auth/too-many-requests') {
                setError('Too many failed attempts. Please try again later.');
            } else if (code === 'auth/invalid-email') {
                setError('Please enter a valid email address.');
            } else {
                const backendMsg = err.response?.data;
                // Show the real error — if object, stringify it for visibility
                const displayMsg = typeof backendMsg === 'string'
                    ? backendMsg
                    : backendMsg
                        ? `Backend error: ${JSON.stringify(backendMsg)}`
                        : `Network/unknown error: ${err.message}`;
                setError(displayMsg);
            }
            setLoading(false);
        }
    };

    const roles = [
        { id: 'police', label: 'Police / Law Enforcement', icon: Shield },
        { id: 'hospital', label: 'Medical / Hospital', icon: Activity },
        { id: 'fire', label: 'Fire Service', icon: Flame },
        { id: 'admin', label: 'System Admin', icon: Building }
    ];

    const hasError = !!error;

    return (
        <div className="login-container">
            <div className="login-branding-side">
                <div className="branding-content">
                    <div className="branding-logo">
                        <AlertMeLogo size={56} color="white" />
                    </div>
                    <h1>AlertMe Command Center</h1>
                    <p>Advanced Emergency Coordination &amp; Real-Time Tracking Platform</p>
                    <div className="branding-features">
                        <div className="feature-item"><Activity size={20} /> <span>Live Incident Mapping</span></div>
                        <div className="feature-item"><Truck size={20} /> <span>Fleet Dispatching</span></div>
                        <div className="feature-item"><BarChart2 size={20} /> <span>Predictive Analytics</span></div>
                    </div>
                </div>
                <div className="branding-overlay"></div>
            </div>

            <div className="login-form-side">
                <div className="login-card-modern">
                    <div className="login-header">
                        <div className="secure-badge">
                            <Lock size={14} /> <span>Secure Authority Portal</span>
                        </div>
                        <h2>Welcome Back</h2>
                        <p>Authenticate to access the command center</p>
                    </div>

                    <form onSubmit={handleLogin} className="login-form">
                        <div className="form-group">
                            <label htmlFor="username">Email Address</label>
                            <div className={`input-with-icon ${hasError ? 'input-error' : ''}`}>
                                <Users size={18} className="input-icon" />
                                <input
                                    type="email"
                                    id="username"
                                    placeholder="Enter your email"
                                    value={username}
                                    onChange={(e) => { setUsername(e.target.value); setError(''); }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Security Passphrase</label>
                            <div className={`input-with-icon ${hasError ? 'input-error' : ''}`}>
                                <Lock size={18} className="input-icon" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    placeholder="Enter password"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                />
                                <div className="eye-toggle-wrapper">
                                    <button
                                        type="button"
                                        className="eye-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        onMouseEnter={() => setShowPwTooltip(true)}
                                        onMouseLeave={() => setShowPwTooltip(false)}
                                    >
                                        {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                                    </button>
                                    {showPwTooltip && (
                                        <div className="pw-tooltip">
                                            {showPassword ? 'Hide password' : 'Show password'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Error State */}
                        {error && (
                            <div className="login-error-box">
                                <AlertCircle size={15} />
                                <span>{error}</span>
                            </div>
                        )}

                        <button type="submit" className={`login-submit-btn ${loading ? 'btn-loading' : ''}`} disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="spin-loader" />
                                    Authenticating...
                                </>
                            ) : (
                                'Authenticate & Proceed'
                            )}
                        </button>

                        <div className="auth-footer">
                            {/* Last Login Info */}
                            <div className="last-login-info">
                                <Clock size={12} />
                                <span>{lastLoginStr}</span>
                            </div>

                            {/* Contact Admin */}
                            <div className="contact-admin-link">
                                <MessageSquare size={12} />
                                <span>Need access? <strong>Contact system admin</strong></span>
                            </div>

                            <p className="privacy-notice">
                                <Shield size={12} /> Unauthorized access is strictly prohibited and logged.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
