import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PermissionRoute } from './components/auth/PermissionRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { ParishRegisterPage } from './pages/ParishRegister';
import { RegisterFamilyPage } from './pages/RegisterFamily';
import { EditFamilyPage } from './pages/EditFamily';
import { UnitsPage } from './pages/Units';
import { UsersPage } from './pages/Users';
import { SettingsPage } from './pages/Settings';
import { ImportRegistrationsPage } from './pages/ImportRegistrations';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes (Requires Login) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route
              path="register"
              element={
                <PermissionRoute module="REGISTER">
                  <ParishRegisterPage />
                </PermissionRoute>
              }
            />
            <Route
              path="register/new"
              element={
                <PermissionRoute module="REGISTER_NEW">
                  <RegisterFamilyPage />
                </PermissionRoute>
              }
            />
            <Route
              path="register/import"
              element={
                <PermissionRoute module="IMPORT_REGISTRATIONS">
                  <ImportRegistrationsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="register/:id/edit"
              element={
                <PermissionRoute module="REGISTER">
                  <EditFamilyPage />
                </PermissionRoute>
              }
            />
            <Route
              path="units"
              element={
                <PermissionRoute module="WARDS">
                  <UnitsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="users"
              element={
                <PermissionRoute module="USERS">
                  <UsersPage />
                </PermissionRoute>
              }
            />
            <Route
              path="settings"
              element={
                <PermissionRoute module="SETTINGS">
                  <SettingsPage />
                </PermissionRoute>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
  );
}

export default App;
