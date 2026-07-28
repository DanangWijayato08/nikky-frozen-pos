const API_BASE_URL =

  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";



async function handleResponse(response, defaultErrorMessage) {
  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (response.status === 401) {
    localStorage.removeItem("nikky_user");
    localStorage.removeItem("nikky_token");
    localStorage.removeItem("nikky_login_activity_id");
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Sesi telah habis. Silakan login kembali.");
  }

  if (response.status === 403) {
    throw new Error(result?.message || "Anda tidak memiliki akses ke resource ini.");
  }

  if (response.status === 404) {
    throw new Error(result?.message || "Data tidak ditemukan.");
  }

  if (response.status === 409) {
    throw new Error(result?.message || "Terjadi konflik data (misal: stok tidak cukup).");
  }

  if (response.status === 422) {
    if (result?.errors) {
      // Return all validation errors if needed, but for simple string we pick first
      const firstError = Object.values(result.errors)[0]?.[0];
      throw new Error(firstError || result?.message || "Data yang dikirim tidak valid.");
    }
    throw new Error(result?.message || "Data yang dikirim tidak valid.");
  }

  if (response.status >= 500) {
    throw new Error(result?.message || "Terjadi kesalahan internal pada server.");
  }

  if (!response.ok) {
    throw new Error(result?.message || defaultErrorMessage);
  }

  return result;
}

function buildQueryParams(params = {}) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      queryParams.append(key, value);
    }
  });
  return queryParams.toString();
}

async function request(url, options = {}, defaultErrorMessage = "Terjadi kesalahan.") {
  try {
    const isFormData = options.body instanceof FormData;
    const token = localStorage.getItem("nikky_token");

    const headers = {
      Accept: "application/json",
      ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    return await handleResponse(response, defaultErrorMessage);
  } catch (err) {
    // If it's a network error (TypeError: Failed to fetch), err.message might not be from our HTTP statuses
    if (err.name === "TypeError" || err.message === "Failed to fetch") {
      throw new Error("Tidak bisa terhubung ke backend. Pastikan server API berjalan.", { cause: err });
    }
    throw err;
  }
}







const apiCache = new Map();



export function clearCacheByPrefix(prefix) {

  Array.from(apiCache.keys()).forEach((key) => {

    if (key.includes(prefix)) apiCache.delete(key);

  });

}



async function cachedRequest(url, options = {}, defaultErrorMessage = "Terjadi kesalahan.", ttlMs = 60000) {

  const cached = apiCache.get(url);

  if (cached && Date.now() - cached.time < ttlMs) {

    return cached.value;

  }

  const value = await request(url, options, defaultErrorMessage);

  apiCache.set(url, { value, time: Date.now() });

  return value;

}



async function requestBlob(url, options = {}, defaultErrorMessage = "Terjadi kesalahan.") {
  try {
    const isFormData = options.body instanceof FormData;
    const token = localStorage.getItem("nikky_token");

    const headers = {
      Accept: "text/csv",
      ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      let result = null;
      try { result = await response.json(); } catch { result = null; }
      throw new Error(result?.message || defaultErrorMessage);
    }

    const blob = await response.blob();

    const disposition = response.headers.get("Content-Disposition");

    let filename = "laporan-owner.csv";

    if (disposition) {

      const m = disposition.match(/filename="?([^";]+)"?/i);

      if (m?.[1]) filename = m[1];

    }

    return { blob, filename };

  } catch (err) {

    if (err instanceof Error) throw err;

    throw new Error("Tidak bisa terhubung ke backend. Pastikan Laravel berjalan di http://127.0.0.1:8000", { cause: err });

  }

}



/* =========================

   PRODUCTS API

========================= */



export async function getProducts(params = {}) {

  const queryString = buildQueryParams(params);



  const url = queryString

    ? `${API_BASE_URL}/products?${queryString}`

    : `${API_BASE_URL}/products`;



  const result = await request(

    url,

    {

      method: "GET",

    },

    "Gagal mengambil data produk."

  );



  return result.data;

}



export async function getProductById(id) {

  const result = await request(

    `${API_BASE_URL}/products/${id}`,

    {

      method: "GET",

    },

    "Gagal mengambil detail produk."

  );



  return result.data;

}



export async function createProduct(productData) {

  const isFormData = productData instanceof FormData;

  const result = await request(

    `${API_BASE_URL}/products`,

    {

      method: "POST",

      body: isFormData ? productData : JSON.stringify(productData),

    },

    "Gagal menambahkan produk."

  );



  return result.data;

}



export async function updateProduct(id, productData) {

  const isFormData = productData instanceof FormData;

  

  if (isFormData) {

    productData.append("_method", "PUT");

  }



  const result = await request(

    `${API_BASE_URL}/products/${id}`,

    {

      method: isFormData ? "POST" : "PUT",

      body: isFormData ? productData : JSON.stringify(productData),

    },

    "Gagal memperbarui produk."

  );



  return result.data;

}



export async function mutateProductStock(id, payload) {

  const result = await request(

    `${API_BASE_URL}/products/${id}/mutate`,

    {

      method: "POST",

      body: JSON.stringify(payload),

    },

    "Gagal memutasi stok produk."

  );



  return result.data;

}



export async function restockProduct(id, payload) {

  const result = await request(

    `${API_BASE_URL}/products/${id}/restock`,

    {

      method: "POST",

      body: JSON.stringify(payload),

    },

    "Gagal restock gudang."

  );



  return result.data;

}



export async function adjustProductStock(id, payload) {

  const result = await request(

    `${API_BASE_URL}/products/${id}/adjust`,

    {

      method: "POST",

      body: JSON.stringify(payload),

    },

    "Gagal mengoreksi stok."

  );



  return result.data;

}



export async function transferProductStock(id, payload) {

  const result = await request(

    `${API_BASE_URL}/products/${id}/transfer`,

    {

      method: "POST",

      body: JSON.stringify(payload),

    },

    "Gagal mentransfer stok ke cabang tujuan."

  );



  return result.data;

}



export async function batchProcessStock(payload) {

  const result = await request(

    `${API_BASE_URL}/products/batch-stock`,

    {

      method: "POST",

      body: JSON.stringify(payload),

    },

    "Gagal memproses batch stok."

  );



  return result.data;

}



export async function deleteProduct(id) {

  const result = await request(

    `${API_BASE_URL}/products/${id}`,

    {

      method: "DELETE",

    },

    "Gagal menghapus produk."

  );



  return result;

}



/* =========================

   STOCK HISTORIES API

========================= */



export async function getStockHistories(params = {}) {

  const queryString = buildQueryParams(params);



  const url = queryString

    ? `${API_BASE_URL}/stock-histories?${queryString}`

    : `${API_BASE_URL}/stock-histories`;



  const result = await request(

    url,

    {

      method: "GET",

    },

    "Gagal mengambil riwayat stok."

  );



  return result.data;

}



/* =========================

   TRANSACTIONS API

========================= */



export async function checkoutTransaction(transactionData) {

  const result = await request(

    `${API_BASE_URL}/checkout`,

    {

      method: "POST",

      body: JSON.stringify(transactionData),

    },

    "Gagal memproses transaksi."

  );



  return result.data;

}



export async function getTransactions(params = {}) {

  const queryString = buildQueryParams(params);



  const url = queryString

    ? `${API_BASE_URL}/transactions?${queryString}`

    : `${API_BASE_URL}/transactions`;



  const result = await request(

    url,

    {

      method: "GET",

    },

    "Gagal mengambil data transaksi."

  );



  return result.data;

}



/* =========================

   EXPENSES API

========================= */



export async function getExpenses(params = {}) {

  const queryString = buildQueryParams(params);



  const url = queryString

    ? `${API_BASE_URL}/expenses?${queryString}`

    : `${API_BASE_URL}/expenses`;



  const result = await request(

    url,

    {

      method: "GET",

    },

    "Gagal mengambil data pengeluaran."

  );



  return result.data;

}



export async function getExpenseById(id) {

  const result = await request(

    `${API_BASE_URL}/expenses/${id}`,

    {

      method: "GET",

    },

    "Gagal mengambil detail pengeluaran."

  );



  return result.data;

}



export async function createExpense(expenseData) {

  const result = await request(

    `${API_BASE_URL}/expenses`,

    {

      method: "POST",

      body: JSON.stringify(expenseData),

    },

    "Gagal menambahkan pengeluaran."

  );




  return result.data;

}


/* =========================
   CACHED GLOBAL API
========================= */

export async function getBranchesCached(force = false) {
  if (force) apiCache.delete(`${API_BASE_URL}/branches`);
  const result = await cachedRequest(`${API_BASE_URL}/branches`, { method: "GET" }, "Gagal mengambil data cabang.", 300000);
  return result.data;
}

export async function getOwnerSettingsCached(force = false) {
  if (force) apiCache.delete(`${API_BASE_URL}/owner/settings`);
  const result = await cachedRequest(`${API_BASE_URL}/owner/settings`, { method: "GET" }, "Gagal mengambil data pengaturan owner.", 300000);
  return result.data;
}



export async function updateExpense(id, expenseData) {

  const result = await request(

    `${API_BASE_URL}/expenses/${id}`,

    {

      method: "PUT",

      body: JSON.stringify(expenseData),

    },

    "Gagal memperbarui pengeluaran."

  );



  return result.data;

}



export async function deleteExpense(id) {

  const result = await request(

    `${API_BASE_URL}/expenses/${id}`,

    {

      method: "DELETE",

    },

    "Gagal menghapus pengeluaran."

  );



  return result;

}



/* =========================

   SHIFTS API

========================= */



export async function getShifts(params = {}) {

  const queryString = buildQueryParams(params);



  const url = queryString

    ? `${API_BASE_URL}/shifts?${queryString}`

    : `${API_BASE_URL}/shifts`;



  const result = await request(

    url,

    {

      method: "GET",

    },

    "Gagal mengambil data shift."

  );



  return result.data;

}



export async function getCurrentShift(username) {

  const queryString = buildQueryParams({ username });



  const result = await request(

    `${API_BASE_URL}/shifts/current?${queryString}`,

    {

      method: "GET",

    },

    "Gagal mengambil shift berjalan."

  );



  return result.data;

}



export async function getActiveShift(params = {}) {

  const queryString = buildQueryParams(params);

  const url = queryString

    ? `${API_BASE_URL}/shifts/active?${queryString}`

    : `${API_BASE_URL}/shifts/active`;



  const result = await request(

    url,

    { method: "GET" },

    "Gagal mengambil status shift."

  );



  return result.data;

}



export async function openShift(shiftData) {

  const result = await request(

    `${API_BASE_URL}/shifts/open`,

    {

      method: "POST",

      body: JSON.stringify(shiftData),

    },

    "Gagal membuka shift."

  );



  return result.data;

}



export async function closeShift(id, closeData) {

  const result = await request(

    `${API_BASE_URL}/shifts/${id}/close`,

    {

      method: "PUT",

      body: JSON.stringify(closeData),

    },

    "Gagal menutup shift."

  );



  return result.data;

}



export async function updateShift(id, shiftData) {

  const result = await request(

    `${API_BASE_URL}/shifts/${id}`,

    {

      method: "PUT",

      body: JSON.stringify(shiftData),

    },

    "Gagal memperbarui shift."

  );



  return result.data;

}



export async function deleteShift(id) {

  const result = await request(

    `${API_BASE_URL}/shifts/${id}`,

    {

      method: "DELETE",

    },

    "Gagal menghapus shift."

  );



  return result;

}



/* =========================

   AUTH API

========================= */

export async function getMe() {
  const result = await request(
    `${API_BASE_URL}/me`,
    {
      method: "GET",
    },
    "Gagal mengambil sesi."
  );

  return result.data;
}

export async function loginUser(loginData) {

  const result = await request(

    `${API_BASE_URL}/login`,

    {

      method: "POST",

      body: JSON.stringify(loginData),

    },

    "Gagal login."

  );



  return result.data;

}



export async function logoutUser(logoutData) {

  const result = await request(

    `${API_BASE_URL}/logout`,

    {

      method: "POST",

      body: JSON.stringify(logoutData),

    },

    "Gagal logout."

  );



  return result;

}



/* =========================

   LOGIN ACTIVITIES API

========================= */



export async function getLoginActivities(params = {}) {

  const queryString = buildQueryParams(params);



  const url = queryString

    ? `${API_BASE_URL}/login-activities?${queryString}`

    : `${API_BASE_URL}/login-activities`;



  const result = await request(

    url,

    {

      method: "GET",

    },

    "Gagal mengambil data aktivitas login."

  );



  return result.data;

}



export async function getOwnerLoginActivities(params = {}) {

  const queryString = buildQueryParams(params);



  const url = queryString

    ? `${API_BASE_URL}/owner/login-activities?${queryString}`

    : `${API_BASE_URL}/owner/login-activities`;



  const result = await request(

    url,

    {

      method: "GET",

    },

    "Gagal mengambil data aktivitas login owner."

  );



  return result.data;

}



export async function forceLogoutActivity(id) {

  const result = await request(

    `${API_BASE_URL}/owner/login-activities/${id}/force-logout`,

    {

      method: "POST",

    },

    "Gagal melakukan force logout."

  );



  return result.data;

}



export async function deleteLoginActivity(id) {

  const result = await request(

    `${API_BASE_URL}/owner/login-activities/${id}`,

    {

      method: "DELETE",

    },

    "Gagal menghapus aktivitas login."

  );



  return result;

}



/* =========================

   USERS API

========================= */



export async function getUsers(params = {}) {

  const queryString = buildQueryParams(params);



  const url = queryString

    ? `${API_BASE_URL}/users?${queryString}`

    : `${API_BASE_URL}/users`;



  const result = await request(

    url,

    {

      method: "GET",

    },

    "Gagal mengambil data user."

  );



  return result.data;

}



export async function getUserById(id) {

  const result = await request(

    `${API_BASE_URL}/users/${id}`,

    {

      method: "GET",

    },

    "Gagal mengambil detail user."

  );



  return result.data;

}



export async function createUser(userData) {

  const result = await request(

    `${API_BASE_URL}/users`,

    {

      method: "POST",

      body: JSON.stringify(userData),

    },

    "Gagal menambahkan user."

  );



  return result.data;

}



export async function updateUser(id, userData) {

  const result = await request(

    `${API_BASE_URL}/users/${id}`,

    {

      method: "PUT",

      body: JSON.stringify(userData),

    },

    "Gagal memperbarui user."

  );



  return result.data;

}



export async function deleteUser(id) {

  const result = await request(

    `${API_BASE_URL}/users/${id}`,

    {

      method: "DELETE",

    },

    "Gagal menghapus user."

  );



  return result;

}



/* =========================

   SETTINGS API

========================= */



export async function getSettingsApi() {

  const result = await request(

    `${API_BASE_URL}/settings`,

    {

      method: "GET",

    },

    "Gagal mengambil data pengaturan."

  );



  return result.data;

}



export async function updateSettingsApi(settingsData) {

  const result = await request(

    `${API_BASE_URL}/settings`,

    {

      method: "PUT",

      body: JSON.stringify(settingsData),

    },

    "Gagal menyimpan data pengaturan."

  );



  return result.data;

}



export async function resetSettingsApi() {

  const result = await request(

    `${API_BASE_URL}/settings/reset`,

    {

      method: "POST",

    },

    "Gagal reset data pengaturan."

  );



  return result.data;

}



export async function getOwnerSettings() {

  const result = await request(

    `${API_BASE_URL}/owner/settings`,

    { method: "GET" },

    "Gagal mengambil pengaturan owner."

  );



  return result.data;

}



export async function updateOwnerSettings(payload) {

  const result = await request(

    `${API_BASE_URL}/owner/settings`,

    {

      method: "PUT",

      body: JSON.stringify(payload),

    },

    "Gagal menyimpan pengaturan owner."

  );



  return result.data;

}



const api = {

  getProducts,

  getProductById,

  createProduct,

  updateProduct,

  mutateProductStock,

  restockProduct,

  adjustProductStock,

  transferProductStock,

  batchProcessStock,

  deleteProduct,

  getStockHistories,

  checkoutTransaction,

  getTransactions,

  getExpenses,

  getExpenseById,

  createExpense,

  updateExpense,

  deleteExpense,

  getShifts,
  getCurrentShift,
  getActiveShift,
  openShift,
  closeShift,
  updateShift,
  deleteShift,
  getMe,
  loginUser,
  logoutUser,

  getLoginActivities,

  getOwnerLoginActivities,

  forceLogoutActivity,

  deleteLoginActivity,

  getUsers,

  getUserById,

  createUser,

  updateUser,

  deleteUser,

  getSettingsApi,

  updateSettingsApi,

  resetSettingsApi,

  getOwnerSettings,
  getOwnerSettingsCached,

  updateOwnerSettings,

  getBranches,
  getBranchesCached,

  getOwnerUsers,

  getOwnerDashboard,

  getOwnerReports,

  exportOwnerReports,

  getOwnerStocks,

  getOwnerExpenses,

};



export default api;



/* =========================

   HELPER

========================= */



export function getApiBaseUrl() {

  return API_BASE_URL;

}



/* =========================

   BRANCHES API

========================= */



export async function getBranches() {

  const result = await request(

    `${API_BASE_URL}/branches`,

    { method: "GET" },

    "Gagal mengambil data cabang."

  );



  return result.data;

}



export async function getAdminDashboard(params = {}) {

  const queryString = buildQueryParams(params);

  const url = queryString

    ? `${API_BASE_URL}/admin/dashboard?${queryString}`

    : `${API_BASE_URL}/admin/dashboard`;



  const result = await request(

    url,

    { method: "GET" },

    "Gagal mengambil data dashboard admin."

  );



  return result.data;

}

export async function getOwnerUsers(params = {}) {

  const queryString = buildQueryParams(params);

  const url = queryString

    ? `${API_BASE_URL}/owner/users?${queryString}`

    : `${API_BASE_URL}/owner/users`;



  const result = await request(

    url,

    { method: "GET" },

    "Gagal mengambil data user."

  );



  return result.data;

}



/* =========================

   OWNER DASHBOARD API

========================= */



export async function getOwnerDashboard(params = {}) {

  const queryString = buildQueryParams(params);

  const url = queryString

    ? `${API_BASE_URL}/owner/dashboard?${queryString}`

    : `${API_BASE_URL}/owner/dashboard`;



  const result = await request(

    url,

    { method: "GET" },

    "Gagal mengambil data dashboard owner."

  );



  return result.data;

}



export async function getOwnerReports(params = {}) {

  const queryString = buildQueryParams(params);

  const url = queryString

    ? `${API_BASE_URL}/owner/reports?${queryString}`

    : `${API_BASE_URL}/owner/reports`;



  const result = await request(

    url,

    { method: "GET" },

    "Gagal mengambil data laporan owner."

  );



  return result.data;

}









export async function exportOwnerReports(params = {}) {

  const qs = buildQueryParams({ ...params, format: "csv" });

  const url = qs

    ? API_BASE_URL + "/owner/reports/export?" + qs

    : API_BASE_URL + "/owner/reports/export";

  return requestBlob(url, { method: "GET" }, "Gagal export laporan.");

}



export async function getOwnerStocks(params = {}) {

  const queryString = buildQueryParams(params);

  const url = queryString

    ? `${API_BASE_URL}/owner/stocks?${queryString}`

    : `${API_BASE_URL}/owner/stocks`;



  const result = await request(

    url,

    { method: "GET" },

    "Gagal mengambil data barang dan stok owner."

  );



  return result.data;

}



export async function getOwnerExpenses(params = {}) {

  const queryString = buildQueryParams(params);

  const url = queryString

    ? `${API_BASE_URL}/owner/expenses?${queryString}`

    : `${API_BASE_URL}/owner/expenses`;



  const result = await request(

    url,

    { method: "GET" },

    "Gagal mengambil data pengeluaran owner."

  );



  return result.data;

}







