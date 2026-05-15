import { Navigate, Outlet } from 'react-router-dom';

/**
 * ProtectedRoute — Guards all dashboard pages.
 * If the user has no JWT token (not logged in), redirect to /login.
 * Also enforces role-based access for specific routes.
 */
export default function ProtectedRoute({ requiredRoles }) {
    const token = localStorage.getItem('jwtToken');
    const userRole = localStorage.getItem('userRole');

    // 1. Not logged in at all → go to login
    if (!token || !userRole) {
        return <Navigate to="/login" replace />;
    }

    // 2. Logged in but wrong role for this route → go to dashboard
    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
        return <Navigate to="/dashboard" replace />;
    }

    // 3. Authorized → render the child route
    return <Outlet />;
}
