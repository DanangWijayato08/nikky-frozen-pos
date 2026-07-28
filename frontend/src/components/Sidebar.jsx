import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  Clock3,
  History,
  LogOut,
  PackagePlus,
  PackageSearch,
  ReceiptText,
  Settings,
  ShoppingCart,
  ChevronsLeft,
  ChevronsRight,
  Snowflake,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";

import * as api from "../services/api";
import ConfirmModal from "./ConfirmModal";

const SIDEBAR_COLLAPSED_KEY = "nikky_sidebar_collapsed_final";

const ownerMenus = [
  { name: "Dashboard", path: "/owner/dashboard", icon: BarChart3 },
  { name: "Laporan", path: "/laporan", icon: ReceiptText },
  { name: "Barang & Stok", path: "/barang", icon: PackageSearch },
  { name: "Pengeluaran", path: "/pengeluaran", icon: WalletCards },
  { name: "Data User", path: "/owner/data-kasir", icon: UsersRound },
  { name: "Aktivitas Login", path: "/owner/aktivitas-login", icon: History },
  { name: "Pengaturan", path: "/pengaturan", icon: Settings },
];

const adminMenus = [
  { name: "Dashboard Admin", path: "/admin/dashboard", icon: BarChart3 },
  { name: "Produk", path: "/admin/produk", icon: Boxes },
  { name: "Mutasi Stok", path: "/admin/mutasi", icon: PackagePlus },
  { name: "Riwayat Stok", path: "/admin/riwayat", icon: History },
];

const kasirMenus = [
  { name: "Kasir", path: "/", icon: ShoppingCart },
  { name: "Shift Saya", path: "/shift", icon: Clock3 },
  { name: "Riwayat Transaksi", path: "/transaksi", icon: History },
];

function getCurrentUser() {
  const savedUser = localStorage.getItem("nikky_user");

  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser);
  } catch {
    localStorage.removeItem("nikky_user");
    localStorage.removeItem("nikky_login_activity_id");
    return null;
  }
}

function getInitialCollapsedState() {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

function Sidebar({ isOpen = false, onClose = () => {} }) {
  const navigate = useNavigate();

  const initialUser = useMemo(() => getCurrentUser(), []);

  const [currentUser, setCurrentUser] = useState(initialUser);
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsedState);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const userRole = String(currentUser?.role || "cashier").toLowerCase().replace("kasir", "cashier");

  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const isKasir = userRole === "cashier";

  const toggleCollapse = () => {
    setIsCollapsed((previousValue) => {
      const nextValue = !previousValue;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextValue));
      return nextValue;
    });
  };

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";

    const userData = getCurrentUser();

    if (userData) {
      setCurrentUser(userData);
    } else {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const menus = useMemo(() => {
    if (isOwner) return ownerMenus;
    if (isAdmin) return adminMenus;
    if (isKasir) return kasirMenus;

    return [];
  }, [isOwner, isAdmin, isKasir]);

  const clearLoginSession = () => {
    localStorage.removeItem("nikky_user");
    localStorage.removeItem("nikky_token");
    localStorage.removeItem("nikky_login_activity_id");
  };

  const handleOpenLogoutModal = () => {
    if (isLoggingOut) return;
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);

      const savedUser = localStorage.getItem("nikky_user");
      const savedLoginActivityId = localStorage.getItem(
        "nikky_login_activity_id",
      );

      let userData = null;

      if (savedUser) {
        try {
          userData = JSON.parse(savedUser);
        } catch {
          userData = null;
        }
      }

      if (typeof api.logoutUser === "function") {
        await api.logoutUser({
          login_activity_id: savedLoginActivityId
            ? Number(savedLoginActivityId)
            : userData?.loginActivityId || null,
        });
      }
    } catch (error) {
      console.error("Logout gagal:", error);
    } finally {
      clearLoginSession();
      setCurrentUser(null);
      setIsLoggingOut(false);
      setShowLogoutModal(false);
      navigate("/login", { replace: true });
    }
  };

  const handleCloseLogoutModal = () => {
    setShowLogoutModal(false);
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[232px] shrink-0 flex-col border-r border-[#EBCDB8] bg-[#FFFDF8] text-[#2A1712] shadow-2xl shadow-slate-950/10 transition-all duration-300 lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 lg:shadow-none ${
          isCollapsed ? "lg:w-[76px]" : "lg:w-[232px]"
        } ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[76px] items-center justify-between px-4">
          <div
            className={`flex min-w-0 items-center gap-3 ${
              isCollapsed ? "lg:hidden" : ""
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C80503] text-white">
              <Snowflake className="h-5 w-5" strokeWidth={2.5} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-black text-[#C80503]">
                Nikky Frozen
              </h1>
              <p className="truncate text-[11px] font-semibold text-[#7A6258]">
                POS System
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleCollapse}
            className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF6EA] text-[#7A6258] transition hover:bg-[#C80503]/10 hover:text-[#C80503] lg:flex ${
              isCollapsed ? "lg:hidden" : ""
            }`}
            aria-label="Perkecil sidebar"
            title="Perkecil sidebar"
          >
            <ChevronsLeft className="h-4 w-4" strokeWidth={2.8} />
          </button>

          <button
            type="button"
            onClick={toggleCollapse}
            className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C80503]/10 text-[#C80503] transition hover:bg-[#C80503]/20 ${
              isCollapsed ? "lg:flex" : "lg:hidden"
            }`}
            aria-label="Buka sidebar"
            title="Buka sidebar"
          >
            <ChevronsRight className="h-4 w-4" strokeWidth={2.8} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF6EA] text-[#7A6258] transition hover:bg-[#EBCDB8] lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div className="space-y-1.5">
            {menus.length > 0 ? (
              menus.map((menu) => {
                const Icon = menu.icon;

                return (
                  <NavLink
                    key={menu.name}
                    to={menu.path}
                    end={menu.path === "/"}
                    onClick={onClose}
                    title={isCollapsed ? menu.name : undefined}
                    className={({ isActive }) =>
                      [
                        "group flex items-center rounded-xl text-sm font-semibold transition-all duration-200",
                        isCollapsed
                          ? "lg:justify-center lg:px-0 lg:py-3"
                          : "gap-3 px-3 py-2.5",
                        isActive
                          ? "bg-[#C80503]/10 text-[#C80503]"
                          : "text-[#7A6258] hover:bg-[#FFF6EA] hover:text-[#C80503]",
                      ].join(" ")
                    }
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />

                    <span
                      className={`min-w-0 truncate ${
                        isCollapsed ? "lg:hidden" : ""
                      }`}
                    >
                      {menu.name}
                    </span>
                  </NavLink>
                );
              })
            ) : (
              <div className="rounded-xl border border-[#EBCDB8] bg-[#FFF6EA] px-3 py-2 text-xs font-semibold text-[#7A6258]">
                Tidak ada menu.
              </div>
            )}
          </div>
        </nav>

        <div className="border-t border-[#EBCDB8] px-4 py-4">
          <button
            type="button"
            onClick={handleOpenLogoutModal}
            disabled={isLoggingOut}
            className={`flex w-full items-center rounded-xl text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 ${
              isCollapsed ? "lg:justify-center lg:px-0 lg:py-2.5" : "gap-2 px-2 py-2.5"
            }`}
            title="Keluar"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={2.2} />
            <span className={isCollapsed ? "lg:hidden" : ""}>
              {isLoggingOut ? "Keluar..." : "Keluar"}
            </span>
          </button>
        </div>

        <ConfirmModal
          open={showLogoutModal}
          title="Keluar dari sistem?"
          message="Apakah Anda yakin ingin mengakhiri sesi saat ini?"
          confirmText="Ya, Keluar"
          cancelText="Batal"
          variant="danger"
          loading={isLoggingOut}
          onConfirm={handleConfirmLogout}
          onCancel={handleCloseLogoutModal}
        />
      </aside>
    </>
  );
}

export default Sidebar;
