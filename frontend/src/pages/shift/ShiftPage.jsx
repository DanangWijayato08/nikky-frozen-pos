import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  WalletCards,
  Receipt,
  TrendingUp,
  Loader2,
} from "lucide-react";
import * as api from "../../services/api";
import { formatNumberInput, parseNumberInput } from "../../utils/formatters";

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCurrentUser() {
  const savedUser = localStorage.getItem("nikky_user");
  if (!savedUser) return null;
  try {
    return JSON.parse(savedUser);
  } catch {
    return null;
  }
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-[1.5rem] border border-[#EBCDB8] bg-[#FFFDF8] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, variant = "gray" }) {
  const variants = {
    green: "bg-green-50 text-green-700 border border-green-200",
    orange: "bg-orange-50 text-orange-700 border border-orange-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    gray: "bg-gray-50 text-gray-600 border border-gray-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${variants[variant]}`}>
      {children}
    </span>
  );
}

function SummaryCard({ icon: Icon, title, value, accent }) {
  return (
    <div className="rounded-2xl border border-[#EBCDB8] bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#8A6F66]">{title}</p>
      <p className="mt-1 text-lg font-black text-[#2A1712]">{value}</p>
    </div>
  );
}

function ShiftPage() {
  const currentUser = getCurrentUser();

  const [activeShift, setActiveShift] = useState(null);
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      const activeRes = await api.getActiveShift({
        username: currentUser.username,
        branch_id: currentUser.branch_id,
      });
      setActiveShift(activeRes?.shift || null);

      const historyRes = await api.getShifts({
        username: currentUser.username,
        status: "Selesai",
      });
      setHistory(Array.isArray(historyRes) ? historyRes : []);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message: error.message || "Gagal memuat data shift.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchData();
  }, [currentUser?.username, currentUser?.branch_id]);

  const todaySummary = useMemo(() => ({
    transaksi: activeShift?.total_transactions || 0,
    penjualan: activeShift?.total_sales || 0,
    kasAwal: activeShift?.opening_cash || 0,
  }), [activeShift]);

  const branchName = activeShift?.branch?.name || currentUser?.branch_name || "-";

  const handleStartShift = async () => {
    if (openingCash === "" || Number(openingCash) < 0) {
      setFeedback({ type: "error", message: "Masukkan kas awal terlebih dahulu." });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback({ type: "", message: "" });
      await api.openShift({
        branch_id: currentUser.branch_id,
        cashier_name: currentUser.name || currentUser.username,
        username: currentUser.username,
        shift_name: currentUser.shift || "Shift Pagi",
        opening_cash: Number(openingCash || 0),
        note: "",
      });
      setOpeningCash("");
      setFeedback({ type: "success", message: "Shift berhasil dibuka." });
      await fetchData();
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Gagal membuka shift." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;

    if (closingCash === "" || Number(closingCash) < 0) {
      setFeedback({ type: "error", message: "Masukkan kas akhir terlebih dahulu." });
      setShowCloseConfirm(false);
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback({ type: "", message: "" });
      await api.closeShift(activeShift.id, {
        closing_cash: Number(closingCash || 0),
        note: "",
      });
      setClosingCash("");
      setShowCloseConfirm(false);
      setFeedback({ type: "success", message: "Shift berhasil ditutup." });
      await fetchData();
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Gagal menutup shift." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser) return <div className="p-8">Memuat data user...</div>;

  return (
    <div className="min-h-[calc(100vh-100px)]">
      <h1 className="mb-6 text-2xl font-black text-[#2A1712]">Shift Kasir</h1>

      {feedback.message && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm font-bold ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#EBCDB8] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#2A1712]">Status Shift Saat Ini</h2>
              <p className="mt-1 text-sm font-medium text-[#7A6258]">
                Lacak aktivitas selama shift ini berlangsung.
              </p>
            </div>
            {activeShift ? <Badge variant="green">Sedang Berjalan</Badge> : <Badge variant="orange">Belum Dibuka</Badge>}
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-[#EBCDB8] bg-white p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#C80503]" />
              <p className="mt-3 text-sm font-bold text-[#7A6258]">Memuat data shift...</p>
            </div>
          ) : activeShift ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-[#2A1712]">Shift Aktif ({activeShift.shift_name})</p>
                    <p className="mt-1 text-sm font-semibold text-[#5F4B45]">
                      {activeShift.cashier_name} • {branchName}
                    </p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-green-700">
                    Berjalan
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-[#5F4B45]">
                  <Clock3 className="h-4 w-4 text-[#C80503]" />
                  Mulai: {formatDateTime(activeShift.opened_at)}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard icon={WalletCards} title="Kas Awal" value={formatRupiah(todaySummary.kasAwal)} accent="bg-[#FFF1F1] text-[#C80503]" />
                <SummaryCard icon={Receipt} title="Transaksi" value={todaySummary.transaksi} accent="bg-[#FFF7ED] text-[#F97316]" />
                <SummaryCard icon={TrendingUp} title="Pemasukan" value={formatRupiah(todaySummary.penjualan)} accent="bg-green-50 text-green-700" />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#F3D6C4] bg-[#FFF7ED] p-6">
              <p className="text-lg font-black text-[#2A1712]">Belum ada shift berjalan</p>
              <p className="mt-2 text-sm font-medium text-[#7A6258]">
                Anda belum membuka shift. Silakan buka shift dengan memasukkan kas awal di panel aksi sebelum melayani pelanggan.
              </p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-6 border-b border-[#EBCDB8] pb-4">
            <h2 className="text-lg font-bold text-[#2A1712]">Aksi Shift</h2>
            <p className="mt-1 text-sm font-medium text-[#7A6258]">Buka / Tutup shift kerja Anda.</p>
          </div>

          {!activeShift ? (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-[#2A1712]">Kas Awal</label>
                <div className="relative flex items-center">
                  <Banknote className="pointer-events-none absolute left-3 h-5 w-5 text-[#C80503]" />
                  <span className="pointer-events-none absolute left-10 text-base font-bold text-[#7A6258]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(openingCash)}
                    onChange={(event) => setOpeningCash(parseNumberInput(event.target.value))}
                    placeholder="1.000.000"
                    disabled={isLoading || isSubmitting}
                    className="w-full rounded-xl border border-[#EBCDB8] bg-white py-3.5 pl-[4.5rem] pr-4 text-base font-bold text-[#2A1712] outline-none transition focus:border-[#C80503] focus:ring-2 focus:ring-[#C80503]/20 disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartShift}
                disabled={openingCash === "" || Number(openingCash) < 0 || isLoading || isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C80503] px-4 py-4 text-sm font-bold text-white shadow-md transition hover:bg-[#8B0306] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                {isSubmitting ? "Membuka..." : "Buka Shift"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-[#2A1712]">Kas Akhir</label>
                <div className="relative flex items-center">
                  <Banknote className="pointer-events-none absolute left-3 h-5 w-5 text-[#2A1712]" />
                  <span className="pointer-events-none absolute left-10 text-base font-bold text-[#7A6258]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(closingCash)}
                    onChange={(event) => setClosingCash(parseNumberInput(event.target.value))}
                    placeholder="0"
                    disabled={isLoading || isSubmitting}
                    className="w-full rounded-xl border border-[#EBCDB8] bg-white py-3.5 pl-[4.5rem] pr-4 text-base font-bold text-[#2A1712] outline-none transition focus:border-[#C80503] focus:ring-2 focus:ring-[#C80503]/20 disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCloseConfirm(true)}
                disabled={closingCash === "" || Number(closingCash) < 0 || isLoading || isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2A1712] px-4 py-4 text-sm font-bold text-white shadow-md transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                {isSubmitting ? "Menutup..." : "Tutup Shift"}
              </button>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-[#EBCDB8] bg-[#FFF6EA] p-4">
            <p className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-[#7A6258]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C80503]" />
              <span>Pastikan jumlah uang fisik di laci kasir sesuai dengan kas akhir sebelum menutup shift.</span>
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden p-0 xl:col-span-2">
          <div className="border-b border-[#EBCDB8] p-6">
            <h2 className="text-lg font-bold text-[#2A1712]">Riwayat Shift Sebelumnya</h2>
            <p className="mt-1 text-sm font-medium text-[#7A6258]">Daftar histori shift Anda yang telah ditutup.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-[#FFF6EA] text-xs font-bold uppercase text-[#7A6258]">
                <tr>
                  <th className="border-b border-[#EBCDB8] px-6 py-4">Kasir</th>
                  <th className="border-b border-[#EBCDB8] px-6 py-4">Cabang</th>
                  <th className="border-b border-[#EBCDB8] px-6 py-4">Waktu Mulai</th>
                  <th className="border-b border-[#EBCDB8] px-6 py-4">Waktu Selesai</th>
                  <th className="border-b border-[#EBCDB8] px-6 py-4 text-right">Kas Awal</th>
                  <th className="border-b border-[#EBCDB8] px-6 py-4 text-right">Kas Akhir</th>
                  <th className="border-b border-[#EBCDB8] px-6 py-4 text-right">Transaksi</th>
                  <th className="border-b border-[#EBCDB8] px-6 py-4 text-right">Pemasukan</th>
                  <th className="border-b border-[#EBCDB8] px-6 py-4 text-right">Selisih</th>
                  <th className="border-b border-[#EBCDB8] px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBCDB8]">
                {history.map((item) => (
                  <tr key={item.id} className="bg-white transition-colors hover:bg-[#FFFDF8]">
                    <td className="px-6 py-4 font-black text-[#2A1712]">{item.cashier_name}</td>
                    <td className="px-6 py-4 font-semibold text-[#7A6258]">{item.branch?.name || "-"}</td>
                    <td className="px-6 py-4 font-semibold text-[#7A6258]">{formatDateTime(item.opened_at)}</td>
                    <td className="px-6 py-4 font-semibold text-[#7A6258]">{formatDateTime(item.closed_at)}</td>
                    <td className="px-6 py-4 text-right font-black text-[#2A1712]">{formatRupiah(item.opening_cash)}</td>
                    <td className="px-6 py-4 text-right font-black text-[#2A1712]">{formatRupiah(item.closing_cash)}</td>
                    <td className="px-6 py-4 text-right font-black text-[#2A1712]">{item.total_transactions || 0}</td>
                    <td className="px-6 py-4 text-right font-black text-[#2A1712]">{formatRupiah(item.total_sales || 0)}</td>
                    <td className={`px-6 py-4 text-right font-black ${(item.closing_cash||0)-(item.opening_cash||0)-(item.total_sales||0) >= 0 ? "text-green-600" : "text-red-600"}`}><span className="whitespace-nowrap inline-flex items-center justify-end gap-1 w-full"><span>{(item.closing_cash||0)-(item.opening_cash||0)-(item.total_sales||0) < 0 ? "-" : ""}</span><span>{formatRupiah(Math.abs((item.closing_cash||0)-(item.opening_cash||0)-(item.total_sales||0)))}</span></span></td>
                    <td className="px-6 py-4 text-center"><Badge variant="gray">Selesai</Badge></td>
                  </tr>
                ))}

                {!isLoading && history.length === 0 && (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center text-[#7A6258]">
                      <LogOut className="mx-auto mb-3 h-8 w-8 text-[#EBCDB8]" />
                      <p className="font-bold">Belum ada riwayat shift.</p>
                      <p className="mt-1 text-xs">Shift yang Anda tutup akan muncul di sini.</p>
                    </td>
                  </tr>
                )}

                {isLoading && (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center text-[#7A6258]">
                      <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#C80503]" />
                      <p className="font-bold">Memuat riwayat...</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-[1.5rem] border border-[#EBCDB8] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-black text-[#2A1712]">Tutup shift sekarang?</h3>
            <p className="mt-2 text-sm text-[#7A6258]">Pastikan kas akhir sudah sesuai sebelum shift ditutup.</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 rounded-xl border border-[#EBCDB8] bg-white px-4 py-3 text-sm font-bold text-[#7A6258] hover:bg-[#FFF6EA]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleEndShift}
                disabled={closingCash === "" || Number(closingCash) < 0 || isLoading || isSubmitting}
                className="flex-1 rounded-xl bg-[#C80503] px-4 py-3 text-sm font-bold text-white hover:bg-[#8B0306] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSubmitting ? "Menutup..." : "Ya, Tutup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShiftPage;




