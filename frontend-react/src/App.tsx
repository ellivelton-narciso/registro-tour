import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { ConfigPage } from './pages/admin/ConfigPage';
import { ConfrontosCopaPage } from './pages/admin/ConfrontosCopaPage';
import { ExclusivosPage } from './pages/admin/ExclusivosPage';
import { LoginPage } from './pages/admin/LoginPage';
import { ParticipantsPage } from './pages/admin/ParticipantsPage';
import { SorteioGruposPage } from './pages/admin/SorteioGruposPage';
import { ClosedPage } from './pages/public/ClosedPage';
import { CupStandingsPage } from './pages/public/CupStandingsPage';
import { RegistrationPage } from './pages/public/RegistrationPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RegistrationPage />} />
          <Route path="/encerradas" element={<ClosedPage />} />
          <Route path="/grupos-copa" element={<CupStandingsPage />} />

          <Route path="/admin/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<ConfigPage />} />
            <Route path="/admin/participantes" element={<ParticipantsPage />} />
            <Route path="/admin/sorteio-grupos" element={<SorteioGruposPage />} />
            <Route path="/admin/confrontos-copa" element={<ConfrontosCopaPage />} />
            <Route path="/admin/exclusivos" element={<ExclusivosPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
