import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FeatureProvider } from './context/FeatureContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PermissionRoute } from './components/auth/PermissionRoute';
import { AppLayout } from './components/layout/AppLayout';
import { NotFoundScreen } from './components/ui/NotFoundScreen';
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
    <AuthProvider>
      <FeatureProvider>
        <ThemeProvider>
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
                    <PermissionRoute module="REGISTER" featureKey="PAGE_REGISTER">
                      <ParishRegisterPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="register/new"
                  element={
                    <PermissionRoute module="REGISTER_NEW" action="canCreate" featureKey="PAGE_REGISTER_NEW">
                      <RegisterFamilyPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="register/import"
                  element={
                    <PermissionRoute module="IMPORT_REGISTRATIONS" action="canCreate" featureKey="PAGE_REGISTER_IMPORT">
                      <ImportRegistrationsPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="register/:id/edit"
                  element={
                    <PermissionRoute module="REGISTER" action="canEdit" featureKey="PAGE_REGISTER">
                      <EditFamilyPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="units"
                  element={
                    <PermissionRoute module="WARDS" featureKey="PAGE_UNITS">
                      <UnitsPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="users"
                  element={
                    <PermissionRoute module="USERS" featureKey="PAGE_USERS">
                      <UsersPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <PermissionRoute module="SETTINGS" featureKey="PAGE_SETTINGS">
                      <SettingsPage />
                    </PermissionRoute>
                  }
                />
                {/* Fallback for undefined nested subroutes */}
                <Route path="*" element={<NotFoundScreen />} />
              </Route>

              {/* Global Catch-all: Stealth 404 */}
              <Route path="*" element={<NotFoundScreen />} />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </FeatureProvider>
    </AuthProvider>
  );
}

export default App;

