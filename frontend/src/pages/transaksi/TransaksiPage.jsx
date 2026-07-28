import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  Eye,
  Printer,
  ReceiptText,
  Search,
  WalletCards,
  X,
  CreditCard,
  Banknote,
} from "lucide-react";
import * as api from "../../services/api";

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

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTransaction(transaction) {
  return {
    id: transaction.id,
    invoice:
      transaction.invoice_number ||
      transaction.invoice ||
      transaction.code ||
      `TRX-${transaction.id}`,
    date:
      transaction.transaction_date ||
      transaction.created_at ||
      transaction.date ||
      new Date().toISOString(),
    cashier:
      transaction.cashier_name ||
      transaction.user?.name ||
      transaction.cashier?.name ||
      "-",
    branch:
      transaction.branch?.name ||
      transaction.branch ||
      `Cabang ${transaction.branch_id || "-"}`,
    method:
      transaction.payment_method ||
      transaction.paymentMethod ||
      transaction.method ||
      "-",
    total: Number(
      transaction.grand_total ||
        transaction.total ||
        transaction.total_amount ||
        0
    ),
    status: transaction.status || "Selesai",
    items:
      transaction.items ||
      transaction.details ||
      transaction.transaction_items ||
      [],
  };
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
    amber: "bg-orange-50 text-orange-700 border border-orange-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    gray: "bg-gray-50 text-gray-600 border border-gray-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${variants[variant]}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, tone = "red" }) {
  const tones = {
    red: "bg-[#FFF1F1] text-[#C80503]",
    green: "bg-[#ECFDF5] text-[#16A34A]",
    amber: "bg-[#FFF7ED] text-[#F97316]",
    cream: "bg-[#FFF6EA] text-[#C80503]",
  };

  return (
    <Card className="p-5 flex min-w-0 items-center gap-4">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-[#7A6258]">{label}</p>
        <p className="mt-1 break-words text-lg font-black leading-tight text-[#2A1712] xl:text-base 2xl:text-lg">{value}</p>
      </div>
    </Card>
  );
}

function TransactionDetailModal({ transaction, onClose }) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2A1712]/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-[2rem] border border-[#EBCDB8] bg-[#FFFDF8] p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#2A1712]">Detail Transaksi</h2>
            <p className="mt-1 text-sm font-semibold text-[#7A6258]">{transaction.invoice}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF6EA] text-[#7A6258] transition hover:bg-[#EBCDB8]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#EBCDB8] bg-white p-5">
          <div className="flex justify-between gap-3">
            <span className="text-sm font-bold text-[#7A6258]">Tanggal</span>
            <span className="text-sm font-black text-[#2A1712]">{formatDateTime(transaction.date)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-sm font-bold text-[#7A6258]">Kasir</span>
            <span className="text-sm font-black text-[#2A1712]">{transaction.cashier}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-sm font-bold text-[#7A6258]">Cabang</span>
            <span className="text-sm font-black text-[#2A1712]">{transaction.branch}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-sm font-bold text-[#7A6258]">Metode Bayar</span>
            <span className="text-sm font-black text-[#2A1712]">{transaction.method}</span>
          </div>

          <div className="mt-3 border-t border-dashed border-[#EBCDB8] pt-3">
            <p className="mb-2 text-xs font-bold uppercase text-[#7A6258]">Item Pembelian</p>
            {transaction.items?.length > 0 ? (
              <div className="max-h-32 space-y-2 overflow-y-auto pr-2">
                {transaction.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="font-semibold text-[#2A1712]">
                      {item.product_name || item.name} x{item.quantity}
                    </span>
                    <span className="font-bold text-[#2A1712]">
                      {formatRupiah(item.subtotal || item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-[#7A6258]">Tidak ada rincian item (Data lama)</p>
            )}
          </div>

          <div className="mt-3 border-t border-[#EBCDB8] pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-black text-[#2A1712]">Total</span>
              <span className="text-xl font-black text-[#C80503]">{formatRupiah(transaction.total)}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2A1712] px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-black"
        >
          <Printer className="h-4 w-4" />
          Cetak Ulang Struk
        </button>
      </div>
    </div>
  );
}

function TransaksiPage() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayInputValue());
  const [selectedMethod, setSelectedMethod] = useState("Semua Metode");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const savedUser = localStorage.getItem("nikky_user");
      const currentUser = savedUser ? JSON.parse(savedUser) : null;
      const params = {};

      if (currentUser?.username) params.username = currentUser.username;
      if (currentUser?.branch_id) params.branch_id = currentUser.branch_id;
      if (selectedDate) params.date = selectedDate;

      const response = await api.getTransactions(params);
      const payload = response?.summary && Array.isArray(response?.transactions)
        ? response
        : { summary: null, transactions: Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [] };

      setSummary(payload.summary || null);
      setTransactions((payload.transactions || []).map(normalizeTransaction));
    } catch (error) {
      console.error("Gagal mengambil transaksi:", error);
      setErrorMessage(error.message || "Gagal mengambil transaksi.");
      setTransactions([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchTransactions();
  }, [selectedDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const keyword = searchKeyword.toLowerCase();
      const transactionDate = transaction.date?.slice(0, 10);
      const matchSearch =
        transaction.invoice.toLowerCase().includes(keyword) ||
        transaction.cashier.toLowerCase().includes(keyword) ||
        transaction.branch.toLowerCase().includes(keyword);
      const matchMethod =
        selectedMethod === "Semua Metode" || transaction.method === selectedMethod;
      return matchSearch && transactionDate === selectedDate && matchMethod;
    });
  }, [transactions, searchKeyword, selectedDate, selectedMethod]);

  const summarySource = summary || {};
  const totalReceipts = summarySource.total_receipts ?? filteredTransactions.length;
  const totalSales = summarySource.total_sales ?? filteredTransactions.reduce((total, item) => total + item.total, 0);
  const cashTotal = summarySource.cash_total ?? filteredTransactions.filter((item) => String(item.method).toLowerCase() === "tunai").reduce((total, item) => total + item.total, 0);
  const qrisTotal = summarySource.qris_total ?? filteredTransactions.filter((item) => String(item.method).toLowerCase() === "qris").reduce((total, item) => total + item.total, 0);
  const transferTotal = summarySource.transfer_total ?? filteredTransactions.filter((item) => String(item.method).toLowerCase() === "transfer").reduce((total, item) => total + item.total, 0);
  const totalMethod = cashTotal + qrisTotal + transferTotal;

  const methodOptions = ["Semua Metode", "Tunai", "QRIS", "Transfer"];

  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) return;

    const rows = [
      ["Invoice", "Tanggal", "Kasir", "Cabang", "Metode", "Total", "Status"],
      ...filteredTransactions.map((item) => [
        item.invoice,
        formatDateTime(item.date),
        item.cashier,
        item.branch,
        item.method,
        item.total,
        item.status,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `riwayat-transaksi-${selectedDate || "semua"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const paymentBreakdown = totalMethod > 0 ? [
    { label: "Tunai", value: cashTotal, tone: "amber" },
    { label: "QRIS", value: qrisTotal, tone: "red" },
    { label: "Transfer", value: transferTotal, tone: "cream" },
  ].filter((item) => item.value > 0) : [];

  return (
    <div className="min-h-[calc(100vh-100px)]">
      <h1 className="mb-6 text-2xl font-black text-[#2A1712]">Riwayat Transaksi</h1>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard label="Total Struk" value={totalReceipts} icon={ReceiptText} tone="red" />
        <StatCard label="Total Penjualan" value={formatRupiah(totalSales)} icon={WalletCards} tone="green" />
        <StatCard label="Tunai" value={formatRupiah(cashTotal)} icon={Banknote} tone="amber" />
        <StatCard label="QRIS" value={formatRupiah(qrisTotal)} icon={CreditCard} tone="red" />
        <StatCard label="Transfer" value={formatRupiah(transferTotal)} icon={CreditCard} tone="cream" />
      </div>

      <Card className="mb-6 p-5">
        <h3 className="mb-4 text-sm font-bold text-[#2A1712]">Breakdown Pembayaran</h3>
        {totalSales === 0 ? (
          <p className="text-sm font-medium text-[#7A6258]">Belum ada transaksi pada periode ini.</p>
        ) : paymentBreakdown.length === 0 ? (
          <p className="text-sm font-medium text-[#7A6258]">Belum ada transaksi pada periode ini.</p>
        ) : (
          <div className="space-y-3">
            {paymentBreakdown.map((item) => {
              const percent = totalSales > 0 ? (item.value / totalSales) * 100 : 0;
              const barColor = item.tone === "amber" ? "bg-[#F97316]" : item.tone === "red" ? "bg-[#C80503]" : "bg-[#D97706]";
              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex justify-between text-xs font-bold text-[#7A6258]">
                    <span>{item.label}</span>
                    <span>{formatRupiah(item.value)} ({percent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#FFF1F1]">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[#EBCDB8] bg-white p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#EBCDB8]" />
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="Cari invoice, kasir, atau cabang..."
                className="w-full rounded-xl border border-[#EBCDB8] bg-[#FFFDF8] py-2.5 pl-10 pr-4 text-sm font-bold text-[#2A1712] outline-none transition focus:border-[#C80503] focus:ring-2 focus:ring-[#C80503]/20"
              />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#EBCDB8]" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full rounded-xl border border-[#EBCDB8] bg-[#FFFDF8] py-2.5 pl-10 pr-4 text-sm font-bold text-[#2A1712] outline-none transition focus:border-[#C80503] focus:ring-2 focus:ring-[#C80503]/20"
                />
              </div>
              <select
                value={selectedMethod}
                onChange={(event) => setSelectedMethod(event.target.value)}
                className="rounded-xl border border-[#EBCDB8] bg-[#FFFDF8] px-4 py-2.5 text-sm font-bold text-[#2A1712] outline-none transition focus:border-[#C80503] focus:ring-2 focus:ring-[#C80503]/20"
              >
                {methodOptions.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#FFF6EA] text-xs font-bold uppercase text-[#7A6258]">
              <tr>
                <th className="border-b border-[#EBCDB8] px-6 py-4">Invoice</th>
                <th className="border-b border-[#EBCDB8] px-6 py-4">Tanggal Waktu</th>
                <th className="border-b border-[#EBCDB8] px-6 py-4">Kasir</th>
                <th className="border-b border-[#EBCDB8] px-6 py-4">Metode</th>
                <th className="border-b border-[#EBCDB8] px-6 py-4 text-right">Total Nominal</th>
                <th className="border-b border-[#EBCDB8] px-6 py-4 text-center">Status</th>
                <th className="border-b border-[#EBCDB8] px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBCDB8]">
              {!isLoading && filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="bg-white transition-colors hover:bg-[#FFFDF8]">
                  <td className="px-6 py-4 font-black text-[#2A1712]">{transaction.invoice}</td>
                  <td className="px-6 py-4 font-semibold text-[#7A6258]">{formatDateTime(transaction.date)}</td>
                  <td className="px-6 py-4 font-semibold text-[#7A6258]">{transaction.cashier}</td>
                  <td className="px-6 py-4 font-semibold text-[#7A6258]">{transaction.method}</td>
                  <td className="px-6 py-4 text-right font-black text-[#C80503]">{formatRupiah(transaction.total)}</td>
                  <td className="px-6 py-4 text-center"><Badge variant="green">{transaction.status}</Badge></td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedTransaction(transaction)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#C80503]/10 px-3 py-1.5 text-xs font-bold text-[#C80503] transition hover:bg-[#C80503] hover:text-white"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-[#7A6258]">
                    <ReceiptText className="mx-auto mb-3 h-8 w-8 text-[#EBCDB8]" />
                    <p className="font-bold">Memuat transaksi...</p>
                  </td>
                </tr>
              )}
              {!isLoading && filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-[#7A6258]">
                    <ReceiptText className="mx-auto mb-3 h-8 w-8 text-[#EBCDB8]" />
                    <p className="font-bold">Tidak ada transaksi yang cocok.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-[#EBCDB8] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-[#7A6258]">
            Menampilkan <span className="font-bold text-[#2A1712]">{filteredTransactions.length}</span> transaksi.
          </p>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredTransactions.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#EBCDB8] bg-white px-4 py-2 text-sm font-bold text-[#2A1712] transition hover:bg-[#FFF6EA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-[#C80503]" />
            Export ke CSV
          </button>
        </div>
      </Card>

      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  );
}

export default TransaksiPage;


