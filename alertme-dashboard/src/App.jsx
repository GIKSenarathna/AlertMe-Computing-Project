import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Splash from './pages/Splash';

import Login from './pages/Login';
import DashboardOverview from './pages/DashboardOverview';
import LiveIncidents from './pages/LiveIncidents';
import IncidentDetail from './pages/IncidentDetail';
import AmbulanceManagement from './pages/AmbulanceManagement';
import PredictiveRiskMap from './pages/PredictiveRiskMap';
import AnalyticsReports from './pages/AnalyticsReports';
import HistoricalRecords from './pages/HistoricalRecords';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route path="/" element={<Splash />} />
                <Route path="/login" element={<Login />} />

                {/* Protected: any authenticated role */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<DashboardLayout />}>
                        <Route path="/dashboard" element={<DashboardOverview />} />
                        <Route path="/live-incidents" element={<LiveIncidents />} />
                        <Route path="/incident/:id" element={<IncidentDetail />} />
                        <Route path="/risk-map" element={<PredictiveRiskMap />} />
                        <Route path="/historical" element={<HistoricalRecords />} />
                    </Route>
                </Route>

                {/* Protected: ADMIN and MEDICAL only */}
                <Route element={<ProtectedRoute requiredRoles={['ADMIN', 'MEDICAL']} />}>
                    <Route element={<DashboardLayout />}>
                        <Route path="/ambulances" element={<AmbulanceManagement />} />
                    </Route>
                </Route>

                {/* Protected: ADMIN only */}
                <Route element={<ProtectedRoute requiredRoles={['ADMIN']} />}>
                    <Route element={<DashboardLayout />}>
                        <Route path="/analytics" element={<AnalyticsReports />} />
                    </Route>
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
