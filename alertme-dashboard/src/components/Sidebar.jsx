import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, AlertCircle, Truck, Map, BarChart2, History, X, Menu, LogOut } from 'lucide-react';
import AlertMeLogo from './AlertMeLogo';
import './Sidebar.css';

export default function Sidebar({ isOpen, onToggle }) {
    const navigate = useNavigate();
    const userRole = localStorage.getItem('userRole') || 'ADMIN';
    
    const menuItems = [
        { name: 'Overview', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['ADMIN', 'MEDICAL', 'FIRE', 'POLICE'] },
        { name: 'Live Incidents', path: '/live-incidents', icon: <AlertCircle size={20} />, roles: ['ADMIN', 'MEDICAL', 'FIRE', 'POLICE'] },
        { name: 'Ambulances', path: '/ambulances', icon: <Truck size={20} />, roles: ['ADMIN', 'MEDICAL'] },
        { name: 'Risk Map', path: '/risk-map', icon: <Map size={20} />, roles: ['ADMIN'] },
        { name: 'Analytics', path: '/analytics', icon: <BarChart2 size={20} />, roles: ['ADMIN'] },
        { name: 'Historical', path: '/historical', icon: <History size={20} />, roles: ['ADMIN'] },
    ].filter(item => item.roles.includes(userRole));

    return (
        <aside className={`sidebar ${!isOpen ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                {isOpen ? (
                    <div className="brand">
                        <div className="sidebar-logo">
                            <AlertMeLogo size={28} color="white" />
                        </div>
                        <div className="brand-text">
                            <h2>AlertMe</h2>
                            <span>Authority Dashboard</span>
                        </div>
                    </div>
                ) : (
                    <div className="brand-collapsed"></div>
                )}
                <button className="close-btn" onClick={onToggle}>
                    {isOpen ? <X size={18} /> : <Menu size={24} />}
                </button>
            </div>

            <div className="user-profile">
                <div className="avatar">A</div>
                <div className="user-info">
                    <h4>Authority User</h4>
                    <p>{userRole}</p>
                </div>
            </div>

            <nav className="nav-menu">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        title={!isOpen ? item.name : undefined}
                    >
                        {item.icon}
                        <span>{item.name}</span>
                    </NavLink>
                ))}

                <div className="nav-divider"></div>
                <button 
                    className="nav-link logout-btn" 
                    onClick={() => {
                        localStorage.removeItem('userRole');
                        navigate('/login');
                    }}
                    title={!isOpen ? "Logout" : undefined}
                >
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </nav>
        </aside>
    );
}
