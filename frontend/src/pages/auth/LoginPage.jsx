import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Snowflake, User, Lock, Eye, EyeOff, LogIn } from "lucide-react";

import { loginUser } from "../../services/api";
import frozenFoodImage from "../../assets/Frozen food.jpg";

function normalizeRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "kasir") return "cashier";
  return normalized;
}

function formatDateTime(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function LoginPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));

    setErrorMessage("");
  };

  const saveLoginSession = (loginData) => {
    const user = loginData.user;
    const loginActivityId = loginData.login_activity_id;

    const loginSession = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: normalizeRole(user.role),
      branch_id: user.branch_id,
      branch: normalizeRole(user.role) === "owner" ? "Semua Cabang" : user.branch,
      branch_code: user.branch_code,
      shift: user.shift,
      phone: user.phone,
      status: user.status,
      loginTime: formatDateTime(),
      last_login_at: user.last_login_at,
      loginActivityId,
    };

    localStorage.setItem("nikky_user", JSON.stringify(loginSession));
    localStorage.setItem("nikky_login_activity_id", String(loginActivityId));

    if (loginData.token) {
      localStorage.setItem("nikky_token", loginData.token);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.username.trim()) {
      setErrorMessage("Username wajib diisi.");
      return;
    }

    if (!formData.password.trim()) {
      setErrorMessage("Password wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const loginData = await loginUser({
        username: formData.username,
        password: formData.password,
      });

      saveLoginSession(loginData);

      if (normalizeRole(loginData.user.role) === "owner") {
        navigate("/owner/dashboard");
      } else if (normalizeRole(loginData.user.role) === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (error) {
      setErrorMessage(
        error.message ||
        "Login gagal. Pastikan username dan password sudah benar."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden font-sans p-4">
      {/* Background Layer */}
      <img
        src={frozenFoodImage}
        alt="Background Nikky Frozen"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Dark Blur Overlay */}
      <div className="absolute inset-0 bg-[#1B120E]/60 backdrop-blur-sm" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[420px] rounded-[2rem] border border-white/20 bg-[#FFFDF8] p-8 sm:p-10 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C80503] text-white shadow-lg shadow-[#C80503]/30">
            <Snowflake className="h-7 w-7" />
          </div>

          <h1 className="text-2xl font-black text-[#2A1712] tracking-tight">
            Nikky Frozen
          </h1>
          <h2 className="text-sm font-black text-[#C80503] uppercase tracking-wider mb-2">
            POS System
          </h2>

          <p className="mt-2 text-xs font-semibold text-[#7A6258]">
            Masukkan username dan password untuk melanjutkan.
          </p>
        </div>

          {errorMessage && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-[#2A1712]">
                Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#C80503]">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Masukkan username"
                  autoComplete="username"
                  className="w-full rounded-xl border border-[#EBCDB8] bg-white py-2.5 pl-10 pr-4 text-sm text-[#2A1712] placeholder:text-[#EBCDB8] outline-none transition focus:border-[#C80503] focus:ring-2 focus:ring-[#C80503]/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-[#2A1712]">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#C80503]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[#EBCDB8] bg-white py-2.5 pl-10 pr-10 text-sm text-[#2A1712] placeholder:text-[#EBCDB8] outline-none transition focus:border-[#C80503] focus:ring-2 focus:ring-[#C80503]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#C80503] hover:text-[#8B0306] focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 mt-6 font-bold text-white shadow-md transition-all ${isSubmitting
                  ? "cursor-not-allowed bg-slate-400"
                  : "bg-[#C80503] hover:bg-[#8B0306] hover:shadow-[#C80503]/30"
                }`}
            >
              {isSubmitting ? (
                "Memproses Login..."
              ) : (
                <>
                  Masuk ke Sistem <LogIn className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
    </div>
  );
}

export default LoginPage;
