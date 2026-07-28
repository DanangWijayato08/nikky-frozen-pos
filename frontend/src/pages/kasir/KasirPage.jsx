import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ImageOff,
  Loader2,
  Minus,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  X,
  User,
  Store,
  Clock,
} from "lucide-react";

import * as api from "../../services/api";
import { getProductImageUrl } from "../../utils/image";
import { formatNumberInput, parseNumberInput } from "../../utils/formatters";

const paymentMethods = [
  { id: "Tunai", label: "Tunai", icon: Banknote },
  { id: "QRIS", label: "QRIS", icon: QrCode },
  { id: "Transfer", label: "Transfer", icon: CreditCard },
];

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getImageUrl(image) {
  if (!image) return null;
  const baseUrl = api.getApiBaseUrl().replace('/api', '');
  if (String(image).startsWith("http")) return image;
  const cleanImage = String(image).replace(/^\/+/, "");
  if (cleanImage.startsWith("storage/")) return `${baseUrl}/${cleanImage}`;
  return `${baseUrl}/storage/${cleanImage}`;
}

function normalizeProduct(product) {
  return {
    id: product.id,
    branchId: product.branch_id,
    code: product.code || "-",
    name: product.name || "-",
    category: product.category || "Lainnya",
    stock: Number(product.stock ?? 0),
    price: Number(product.price || 0),
    expiredDate: product.expired_date || null,
    storageLocation: product.storage_location || "-",
    image: product.image || null,
    image_url: product.image_url || null,
    status: product.status || "Aktif",
  };
}

function ProductImage({ product }) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getProductImageUrl(product);

  if (!imageUrl || imageError) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#FFF6EA] to-[#EBCDB8] text-[#C80503]">
        <div className="text-center">
          <ImageOff className="mx-auto h-6 w-6" />
          <p className="mt-1 text-[10px] font-black uppercase tracking-wide">
            {product.code}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-white">
      <img
        src={imageUrl}
        alt={product.name}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

function ProductCard({ product, cartQuantity, onAdd }) {
  const remainingStock = product.stock - cartQuantity;
  const isInactive = String(product.status).toLowerCase() !== "aktif";
  const isOutOfStock = product.stock <= 0;
  const isLowStock = remainingStock > 0 && remainingStock <= 5;
  const cannotAdd = isInactive || isOutOfStock || remainingStock <= 0;

  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={cannotAdd}
      className={`flex flex-col rounded-[1.25rem] border bg-[#FFFDF8] p-3 text-left shadow-sm transition ${
        cannotAdd
          ? "cursor-not-allowed border-[#EBCDB8] opacity-60"
          : "border-[#EBCDB8] hover:border-[#C80503] hover:shadow-md"
      }`}
    >
      <ProductImage product={product} />

      <div className="mt-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#2A1712] leading-tight">
            {product.name}
          </p>
          <p className="mt-0.5 truncate text-[10px] font-semibold text-[#7A6258]">
            {product.code} â€¢ {product.category}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            isOutOfStock
              ? "bg-red-50 text-red-600 border border-red-200"
              : isLowStock
              ? "bg-orange-50 text-orange-600 border border-orange-200"
              : "bg-green-50 text-green-600 border border-green-200"
          }`}
        >
          {isOutOfStock ? "Habis" : `${remainingStock} stok`}
        </span>
      </div>

      <div className="mt-auto pt-2">
        <p className="text-base font-black text-[#C80503]">
          {formatRupiah(product.price)}
        </p>

        <div
          className={`mt-2 rounded-lg py-1.5 text-center text-xs font-bold transition ${
            cannotAdd ? "bg-gray-100 text-gray-400" : "bg-[#C80503] text-white hover:bg-[#8B0306]"
          }`}
        >
          {cannotAdd ? "Tidak tersedia" : "Tambah"}
        </div>
      </div>
    </button>
  );
}

function CartItem({ item, onIncrease, onDecrease, onRemove }) {
  return (
    <div className="rounded-2xl border border-[#EBCDB8] bg-[#FFFDF8] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#2A1712]">
            {item.name}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-[#7A6258]">
            {item.code} â€¢ {formatRupiah(item.price)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center rounded-xl border border-[#EBCDB8] bg-white p-1">
          <button
            type="button"
            onClick={() => onDecrease(item.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7A6258] hover:bg-[#FFF6EA]"
          >
            <Minus className="h-4 w-4" />
          </button>

          <span className="w-10 text-center text-sm font-bold text-[#2A1712]">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={() => onIncrease(item.id)}
            disabled={item.quantity >= item.stock}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7A6258] hover:bg-[#FFF6EA] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm font-black text-[#C80503]">
          {formatRupiah(item.price * item.quantity)}
        </p>
      </div>
    </div>
  );
}

function PaymentModal({
  isOpen,
  cart,
  total,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  onClose,
  onSubmit,
  isSubmitting,
}) {
  if (!isOpen) return null;

  const change = Number(cashReceived || 0) - total;
  const isCash = paymentMethod === "Tunai";
  const isCashInvalid = isCash && Number(cashReceived || 0) < total;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2A1712]/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-[2rem] bg-[#FFFDF8] p-6 shadow-2xl border border-[#EBCDB8]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#2A1712]">Pembayaran</h2>
            <p className="mt-1 text-sm text-[#7A6258]">
              Periksa pesanan sebelum transaksi disimpan.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF6EA] text-[#7A6258] hover:bg-[#EBCDB8]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-[#EBCDB8] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#7A6258]">Total Bayar</span>
            <span className="text-2xl font-black text-[#C80503]">
              {formatRupiah(total)}
            </span>
          </div>

          <div className="mt-3 max-h-[150px] space-y-2 overflow-y-auto pr-2">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-semibold text-[#2A1712]">
                  {item.name} x{item.quantity}
                </span>
                <span className="font-bold text-[#2A1712]">
                  {formatRupiah(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-bold text-[#2A1712]">
            Metode Pembayaran
          </p>

          <div className="grid grid-cols-3 gap-3">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  disabled={isSubmitting}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-sm font-bold transition ${
                    paymentMethod === method.id
                      ? "border-[#C80503] bg-[#C80503]/10 text-[#C80503]"
                      : "border-[#EBCDB8] bg-white text-[#7A6258] hover:bg-[#FFF6EA]"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {method.label}
                </button>
              );
            })}
          </div>
        </div>

        {isCash && (
          <div className="mb-5">
            <label className="mb-2 block text-sm font-bold text-[#2A1712]">
              Uang Diterima
            </label>

            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-4 text-lg font-bold text-[#7A6258]">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberInput(cashReceived)}
                onChange={(event) => setCashReceived(parseNumberInput(event.target.value))}
                disabled={isSubmitting}
                placeholder="0"
                className="w-full rounded-xl border border-[#EBCDB8] bg-white py-3 pl-12 pr-4 text-lg font-bold text-[#2A1712] outline-none focus:border-[#C80503] focus:ring-2 focus:ring-[#C80503]/20"
              />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FFF6EA] px-4 py-3 border border-[#EBCDB8]">
              <span className="text-sm font-bold text-[#7A6258]">Kembalian</span>
              <span
                className={`text-lg font-black ${
                  change < 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {formatRupiah(Math.max(change, 0))}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={isCashInvalid || isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C80503] px-4 py-4 text-base font-bold text-white shadow-md hover:bg-[#8B0306] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none transition-all"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          {isSubmitting ? "Memproses..." : "Simpan Transaksi"}
        </button>
      </div>
    </div>
  );
}

function ClearCartModal({ isOpen, onCancel, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#2A1712]/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-[#EBCDB8] bg-[#FFFDF8] p-6 shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF6EA] text-[#C80503] border border-[#EBCDB8]">
          <ShoppingCart className="h-7 w-7" />
        </div>

        <h2 className="mt-4 text-center text-2xl font-black text-[#2A1712]">
          Kosongkan keranjang?
        </h2>
        <p className="mt-2 text-center text-sm font-medium text-[#7A6258]">
          Semua item yang sudah dipilih akan dihapus dari keranjang.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[#EBCDB8] bg-white px-4 py-3 text-sm font-bold text-[#2A1712] hover:bg-[#FFF6EA]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[#C80503] px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-[#8B0306]"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ transaction, onClose, onPrint }) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#2A1712]/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-[2rem] bg-[#FFFDF8] p-6 text-center shadow-2xl border border-[#EBCDB8]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-green-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <h2 className="mt-4 text-xl font-bold text-[#2A1712]">
          Transaksi Berhasil
        </h2>
        <p className="mt-1 text-sm text-[#7A6258]">
          Pesanan berhasil diproses.
        </p>

        <div className="mt-5 rounded-xl bg-white border border-[#EBCDB8] p-4 text-left">
          <div className="flex justify-between gap-3">
            <span className="text-sm font-bold text-[#7A6258]">Invoice</span>
            <span className="text-sm font-black text-[#2A1712]">
              {transaction.invoice_number}
            </span>
          </div>

          <div className="mt-3 flex justify-between gap-3">
            <span className="text-sm font-bold text-[#7A6258]">Metode</span>
            <span className="text-sm font-black text-[#2A1712]">
              {transaction.payment_method}
            </span>
          </div>

          <div className="mt-3 flex justify-between gap-3">
            <span className="text-sm font-bold text-[#7A6258]">Total</span>
            <span className="text-sm font-black text-[#2A1712]">
              {formatRupiah(transaction.grand_total)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onPrint || (() => window.print())}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#EBCDB8] bg-white px-4 py-3 text-sm font-bold text-[#2A1712] hover:bg-[#FFF6EA]"
          >
            <Printer className="h-4 w-4" />
            Cetak
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#C80503] px-4 py-3 text-sm font-bold text-white hover:bg-[#8B0306] shadow-md"
          >
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
}

function KasirPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Tunai");
  const [cashReceived, setCashReceived] = useState("");
  const [successTransaction, setSuccessTransaction] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearCartOpen, setIsClearCartOpen] = useState(false);
  const [activeShift, setActiveShift] = useState(null);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [showShiftWarning, setShowShiftWarning] = useState(false);
  
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const checkActiveShift = async () => {
      if (!currentUser) return;
      try {
        setShiftLoading(true);
        const res = await api.getActiveShift({ username: currentUser.username });
        setActiveShift(res.shift);
        setHasActiveShift(res.has_active_shift);
        setShowShiftWarning(!res.has_active_shift);
      } catch (err) {
        console.error("Gagal cek shift:", err);
      } finally {
        setShiftLoading(false);
      }
    };
    checkActiveShift();
  }, [currentUser]);

  useEffect(() => {
    const savedUser = localStorage.getItem("nikky_user");
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchProducts = async (branchId) => {
    try {
      setIsLoadingProducts(true);
      setErrorMessage("");

      const response = await api.getProducts({ branch_id: branchId });
      
      const productList = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];

      setProducts(productList.map(normalizeProduct));
    } catch (error) {
      console.error("Gagal mengambil produk:", error);
      setErrorMessage("Produk gagal dimuat. Pastikan backend Laravel sedang berjalan.");
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.branch_id) {
      fetchProducts(currentUser.branch_id);
    }
  }, [currentUser]);

  const categories = useMemo(() => {
    return ["Semua", ...new Set(products.map((product) => product.category))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const filtered = products
      .filter((product) => String(product.status).toLowerCase() === "aktif")
      .filter((product) => {
        const keyword = searchKeyword.toLowerCase();

        const matchSearch =
          product.name.toLowerCase().includes(keyword) ||
          product.code.toLowerCase().includes(keyword) ||
          product.category.toLowerCase().includes(keyword);

        const matchCategory =
          selectedCategory === "Semua" || product.category === selectedCategory;

        return matchSearch && matchCategory;
      });

    // Sort: Stok tersedia di atas, stok habis di bawah.
    // Jika sama-sama ada/habis, urutkan berdasarkan nama.
    return filtered.sort((a, b) => {
      const aOutOfStock = a.stock <= 0;
      const bOutOfStock = b.stock <= 0;

      if (aOutOfStock && !bOutOfStock) return 1;
      if (!aOutOfStock && bOutOfStock) return -1;

      return a.name.localeCompare(b.name);
    });
  }, [products, searchKeyword, selectedCategory]);

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cart]);

  const totalItems = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const getCartQuantity = (productId) => {
    return cart.find((item) => item.id === productId)?.quantity || 0;
  };

  const handleAddToCart = (product) => {
    if (product.stock <= 0) return;

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id);

      if (existingItem) {
        if (existingItem.quantity >= product.stock) return currentCart;

        return currentCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...currentCart, { ...product, quantity: 1 }];
    });
  };

  const handleIncreaseQuantity = (productId) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId && item.quantity < item.stock
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const handleDecreaseQuantity = (productId) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (productId) => {
    setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setIsClearCartOpen(true);
  };
  const handlePrintReceipt = () => {
    window.print();
  };

  const handleOpenPayment = () => {
    if (!hasActiveShift) { setShowShiftWarning(true); return; }
    if (cart.length === 0) return;
    setErrorMessage("");
    setPaymentMethod("Tunai");
    setCashReceived("");
    setIsPaymentOpen(true);
  };

  const handleSubmitTransaction = async () => {
    if (!currentUser) return;
    
    try {
      setIsSubmitting(true);
      
      const payload = {
        payment_method: paymentMethod,
        paid_amount: paymentMethod === "Tunai" ? Number(cashReceived) : subtotal,
        apply_tax: true,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        }))
      };

      const result = await api.checkoutTransaction(payload);
      
      // Update local stock to avoid refetching everything immediately
      setProducts((currentProducts) =>
        currentProducts.map((product) => {
          const soldItem = cart.find((item) => item.id === product.id);
          if (!soldItem) return product;
          return {
            ...product,
            stock: Math.max(product.stock - soldItem.quantity, 0),
          };
        })
      );

      setCart([]);
      setCashReceived("");
      setIsPaymentOpen(false);
      setSuccessTransaction(result);
      
    } catch (error) {
      setErrorMessage(error.message || "Gagal memproses transaksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser) {
    return <div className="p-8">Memuat data user...</div>;
  }

  return (
    <div className="min-h-[calc(100vh-100px)] font-sans">
      

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* KIRI - DAFTAR PRODUK */}
        <div className="min-w-0">
          <div className="mb-6 rounded-[1.5rem] border border-[#EBCDB8] bg-[#FFFDF8] p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-xl font-bold text-[#2A1712]">Produk Toko</h1>
                <p className="mt-1 text-xs font-semibold text-[#7A6258]">
                  Hanya menampilkan stok dari cabang Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fetchProducts(currentUser.branch_id)}
                className="rounded-xl border border-[#EBCDB8] bg-white px-4 py-2 text-sm font-bold text-[#2A1712] hover:bg-[#FFF6EA] shadow-sm transition-all"
              >
                Refresh Produk
              </button>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#EBCDB8]" />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="Cari nama, kode, atau kategori produk..."
                  className="w-full rounded-xl border border-[#EBCDB8] bg-white py-2.5 pl-10 pr-4 text-sm font-bold text-[#2A1712] outline-none transition focus:border-[#C80503] focus:ring-2 focus:ring-[#C80503]/20"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                      selectedCategory === category
                        ? "bg-[#C80503] text-white shadow-md"
                        : "bg-white text-[#7A6258] border border-[#EBCDB8] hover:bg-[#FFF6EA]"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              <AlertCircle className="h-5 w-5" />
              {errorMessage}
            </div>
          )}

          {!shiftLoading && !hasActiveShift && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
              <div>
                <p className="font-bold">Shift belum dibuka</p>
                <p className="mt-0.5 font-medium text-orange-600">
                  Anda harus membuka shift terlebih dahulu sebelum melakukan transaksi.
                </p>
              </div>
            </div>
          )}


          {isLoadingProducts ? (
            <div className="rounded-[1.5rem] border border-[#EBCDB8] bg-[#FFFDF8] p-10 text-center shadow-sm">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#C80503]" />
              <p className="mt-3 font-bold text-[#2A1712]">Memuat produk toko...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQuantity={getCartQuantity(product.id)}
                  onAdd={handleAddToCart}
                />
              ))}

              {filteredProducts.length === 0 && (
                <div className="col-span-full rounded-[1.5rem] border border-[#EBCDB8] bg-[#FFFDF8] p-10 text-center shadow-sm">
                  <p className="font-bold text-[#2A1712]">Produk tidak ditemukan</p>
                  <p className="mt-1 text-sm font-medium text-[#7A6258]">
                    Coba gunakan kata kunci atau kategori lain.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* KANAN - KERANJANG KASIR */}
        <aside className="xl:sticky xl:top-[88px] xl:self-start">
          <div className="rounded-[1.5rem] border border-[#EBCDB8] bg-[#FFFDF8] shadow-md flex flex-col h-[calc(100vh-120px)] max-h-[800px]">
            <div className="border-b border-[#EBCDB8] p-5 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#2A1712]">Keranjang</h2>
                  <p className="mt-1 text-xs font-semibold text-[#7A6258]">
                    {totalItems} item dipilih
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C80503]/10 text-[#C80503]">
                  <ShoppingCart className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onIncrease={handleIncreaseQuantity}
                    onDecrease={handleDecreaseQuantity}
                    onRemove={handleRemoveItem}
                  />
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="rounded-2xl border-2 border-dashed border-[#EBCDB8] bg-white p-6">
                    <ReceiptText className="mx-auto h-8 w-8 text-[#EBCDB8]" />
                    <p className="mt-3 text-sm font-bold text-[#7A6258]">
                      Keranjang Kosong
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#EBCDB8] bg-white p-5 shrink-0 rounded-b-[1.5rem]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#7A6258]">Subtotal</span>
                  <span className="text-sm font-bold text-[#2A1712]">
                    {formatRupiah(subtotal)}
                  </span>
                </div>

                <div className="border-t border-dashed border-[#EBCDB8] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-[#2A1712]">Total Bayar</span>
                    <span className="text-2xl font-black text-[#C80503]">
                      {formatRupiah(subtotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={cart.length === 0}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-bold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  Kosongkan
                </button>

                <button
                  type="button"
                  onClick={handleOpenPayment}
                  disabled={cart.length === 0 || !hasActiveShift || shiftLoading}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#C80503] px-4 py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#8B0306] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none transition-all"
                >
                  Checkout
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <PaymentModal
        isOpen={isPaymentOpen}
        cart={cart}
        total={subtotal}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        cashReceived={cashReceived}
        setCashReceived={setCashReceived}
        onClose={() => setIsPaymentOpen(false)}
        onSubmit={handleSubmitTransaction}
        isSubmitting={isSubmitting}
      />

      <ClearCartModal
        isOpen={isClearCartOpen}
        onCancel={() => setIsClearCartOpen(false)}
        onConfirm={() => {
          setCart([]);
          setIsClearCartOpen(false);
        }}
      />


      {showShiftWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#EBCDB8] bg-white p-6 shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <h2 className="text-center text-lg font-bold text-[#2A1712]">Shift belum dibuka</h2>
            <p className="mt-2 text-center text-sm text-[#7A6258]">
              Anda belum membuka shift. Silakan buka shift terlebih dahulu sebelum melakukan transaksi.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowShiftWarning(false)}
                className="flex-1 rounded-xl border border-[#EBCDB8] bg-white px-4 py-2.5 text-sm font-bold text-[#7A6258] hover:bg-[#FFF6EA] transition"
              >
                Batal
              </button>
              <button
                onClick={() => { setShowShiftWarning(false); window.location.href = "/shift"; }}
                className="flex-1 rounded-xl bg-[#C80503] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#A80000] transition"
              >
                Buka Shift
              </button>
            </div>
          </div>
        </div>
      )}
      <SuccessModal
        transaction={successTransaction}
        onClose={() => setSuccessTransaction(null)}
      />
    </div>
  );
}

export default KasirPage;






