import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import LoginPage from "./pages/auth/LoginPage";
import KasirPage from "./pages/kasir/KasirPage";
import BarangPage from "./pages/barang/BarangPage";
import TransaksiPage from "./pages/transaksi/TransaksiPage";
import LaporanPage from "./pages/laporan/LaporanPage";
import PengeluaranPage from "./pages/pengeluaran/PengeluaranPage";
import PengaturanPage from "./pages/pengaturan/PengaturanPage";
import ShiftPage from "./pages/shift/ShiftPage";

import OwnerDashboard from "./pages/owner/OwnerDashboard";
import DataKasirPage from "./pages/owner/DataKasirPage";
import AktivitasLoginPage from "./pages/owner/AktivitasLoginPage";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProdukPage from "./pages/admin/AdminProdukPage";
import AdminMutasiPage from "./pages/admin/AdminMutasiPage";
import AdminRiwayatStok from "./pages/admin/AdminRiwayatStok";

import { getMe } from "./services/api";

function normalizeRole(role) {
  const normalized = String(role || "").toLowerCase();
  return normalized === "kasir" ? "cashier" : normalized;
}

function getCurrentUser() {
  const savedUser = localStorage.getItem("nikky_user");
  if (!savedUser) return null;
  try {
    return JSON.parse(savedUser);
  } catch (error) {
    localStorage.removeItem("nikky_user");
    return null;
  }
}

function GuestRoute({ children }) {
  const currentUser = getCurrentUser();

  if (currentUser?.role === "owner") {
    return <Navigate to="/owner/dashboard" replace />;
  }

  if (currentUser?.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (normalizeRole(currentUser?.role) === "cashier") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ProtectedRoute({ children }) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function OwnerOnlyRoute({ children }) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (normalizeRole(currentUser.role) !== "owner") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AdminOnlyRoute({ children }) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (normalizeRole(currentUser.role) !== "admin") {
    if (normalizeRole(currentUser.role) === "owner") {
      return <Navigate to="/owner/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}

function KasirOnlyRoute({ children }) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (normalizeRole(currentUser.role) !== "cashier") {
    if (normalizeRole(currentUser.role) === "owner") {
      return <Navigate to="/owner/dashboard" replace />;
    }
    if (normalizeRole(currentUser.role) === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}

function RoleRedirect() {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (normalizeRole(currentUser.role) === "owner") {
    return <Navigate to="/owner/dashboard" replace />;
  }

  if (normalizeRole(currentUser.role) === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <KasirPage />;
}

function AppContent() {
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem("nikky_token");
      if (!token) {
        setIsChecking(false);
        return;
      }

      try {
        const user = await getMe();
        // Update user data seamlessly
        const oldUser = getCurrentUser() || {};
        const loginSession = {
          ...oldUser,
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: normalizeRole(user.role),
          branch_id: user.branch_id,
          branch: normalizeRole(user.role) === "owner" ? "Semua Cabang" : user.branch?.name,
          branch_code: user.branch?.code,
          shift: user.shift_name,
          phone: user.phone,
          status: user.status,
        };
        localStorage.setItem("nikky_user", JSON.stringify(loginSession));
      } catch (error) {
        // If 401, handleResponse in api.js already clears local storage and redirects.
        console.error("Session verification failed", error);
      } finally {
        setIsChecking(false);
      }
    };

    verifySession();
  }, []);

  if (isChecking) {
    return <div className="flex h-screen items-center justify-center font-bold text-[#C80503]">Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleRedirect />} />

        <Route
          path="owner/dashboard"
          element={
            <OwnerOnlyRoute>
              <OwnerDashboard />
            </OwnerOnlyRoute>
          }
        />

        <Route
          path="owner/data-kasir"
          element={
            <OwnerOnlyRoute>
              <DataKasirPage />
            </OwnerOnlyRoute>
          }
        />

        <Route
          path="owner/aktivitas-login"
          element={
            <OwnerOnlyRoute>
              <AktivitasLoginPage />
            </OwnerOnlyRoute>
          }
        />

        <Route
          path="admin/dashboard"
          element={
            <AdminOnlyRoute>
              <AdminDashboard />
            </AdminOnlyRoute>
          }
        />

        <Route
          path="admin/produk"
          element={
            <AdminOnlyRoute>
              <AdminProdukPage />
            </AdminOnlyRoute>
          }
        />

        <Route
          path="admin/mutasi"
          element={
            <AdminOnlyRoute>
              <AdminMutasiPage />
            </AdminOnlyRoute>
          }
        />

        <Route
          path="admin/riwayat"
          element={
            <AdminOnlyRoute>
              <AdminRiwayatStok />
            </AdminOnlyRoute>
          }
        />

        <Route
          path="shift"
          element={
            <KasirOnlyRoute>
              <ShiftPage />
            </KasirOnlyRoute>
          }
        />

        <Route
          path="barang"
          element={
            <OwnerOnlyRoute>
              <BarangPage />
            </OwnerOnlyRoute>
          }
        />

        <Route
          path="transaksi"
          element={
            <KasirOnlyRoute>
              <TransaksiPage />
            </KasirOnlyRoute>
          }
        />

        <Route
          path="laporan"
          element={
            <OwnerOnlyRoute>
              <LaporanPage />
            </OwnerOnlyRoute>
          }
        />

        <Route
          path="pengeluaran"
          element={
            <OwnerOnlyRoute>
              <PengeluaranPage />
            </OwnerOnlyRoute>
          }
        />

        <Route
          path="pengaturan"
          element={
            <OwnerOnlyRoute>
              <PengaturanPage />
            </OwnerOnlyRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
