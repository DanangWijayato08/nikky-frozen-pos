<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockHistory;
use App\Models\Transaction;
use App\Models\Shift;
use App\Traits\ChecksBranchIsolation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    use ChecksBranchIsolation;

    public function index(Request $request)
    {
        $query = Transaction::with([
            'branch:id,name,code',
            'items',
        ])->orderBy('id', 'desc');

        $filteredBranchId = $this->getFilteredBranchId($request);
        if ($filteredBranchId) {
            $query->where('branch_id', $filteredBranchId);
        }

        $user = $request->user();
        if ($user && $user->role === 'cashier') {
            $query->where('username', $user->username);
        } elseif ($request->filled('username')) {
            $query->where('username', $request->username);
        }

        if ($request->filled('date')) {
            $query->whereDate('transaction_date', $request->date);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $perPage = $request->query('per_page', 10);
        $transactions = $query->get();

        $summaryQuery = clone $query;

        $totalReceipts = (clone $summaryQuery)->count();
        $totalSales = (clone $summaryQuery)->sum('grand_total');
        $cashTotal = (clone $summaryQuery)->where('payment_method', 'Tunai')->sum('grand_total');
        $qrisTotal = (clone $summaryQuery)->where('payment_method', 'QRIS')->sum('grand_total');
        $transferTotal = (clone $summaryQuery)->where('payment_method', 'Transfer')->sum('grand_total');
        $cashCount = (clone $summaryQuery)->where('payment_method', 'Tunai')->count();
        $qrisCount = (clone $summaryQuery)->where('payment_method', 'QRIS')->count();
        $transferCount = (clone $summaryQuery)->where('payment_method', 'Transfer')->count();

        return response()->json([
            'success' => true,
            'message' => 'Data transaksi berhasil diambil.',
            'data' => [
                'summary' => [
                    'total_receipts' => $totalReceipts,
                    'total_sales' => $totalSales,
                    'cash_total' => $cashTotal,
                    'qris_total' => $qrisTotal,
                    'transfer_total' => $transferTotal,
                    'cash_count' => $cashCount,
                    'qris_count' => $qrisCount,
                    'transfer_count' => $transferCount,
                ],
                'transactions' => $transactions,
            ],
        ]);
    }

    public function checkout(Request $request)
    {
        $validatedData = $request->validate([
            'apply_tax' => ['nullable', 'boolean'],
            'discount' => ['nullable', 'integer', 'min:0'],
            'payment_method' => ['required', 'string', 'max:50'],
            'paid_amount' => ['required', 'integer', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'integer', 'min:1'],
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $branchId = $user->branch_id;
        $username = $user->username;
        $cashierName = $user->name;

        // Ensure owner provides branch_id if they checkout, or just use their branch_id.
        if ($user->role === 'owner' && $request->filled('branch_id')) {
            $branchId = $request->branch_id;
        }

        // Fetch settings for Tax and Discount
        $receiptSetting = \App\Models\Setting::where('key', 'receipt_setting')->first()?->value ?? [];
        $isPpnActive = $receiptSetting['ppnActive'] ?? false;
        $ppnRate = $receiptSetting['ppnRate'] ?? 0;
        // Default max discount percentage is 0 if not set, but let's allow up to 100% if not configured, to be safe.
        // Actually, let's use the default from SettingController: 10%
        $maxDiscountPercent = $receiptSetting['maxDiscount'] ?? 10;

        try {
            $activeShift = Shift::where('username', $username)
                ->where('branch_id', $branchId)
                ->where('status', 'Berjalan')
                ->latest('id')
                ->first();

            if (!$activeShift) {
                // Business logic error: 422
                throw new \Exception('Anda belum membuka shift. Silakan buka shift terlebih dahulu sebelum melakukan transaksi.', 422);
            }

            // Combine duplicate product_ids by summing their quantities
            $combinedItems = [];
            foreach ($validatedData['items'] as $item) {
                $pid = $item['product_id'];
                if (isset($combinedItems[$pid])) {
                    $combinedItems[$pid]['quantity'] += (int) $item['quantity'];
                } else {
                    $combinedItems[$pid] = [
                        'product_id' => $pid,
                        'quantity' => (int) $item['quantity']
                    ];
                }
            }

            $transaction = DB::transaction(function () use ($validatedData, $user, $branchId, $username, $cashierName, $activeShift, $combinedItems, $isPpnActive, $ppnRate, $maxDiscountPercent) {
                $subtotal = 0;
                $totalItem = 0;
                $itemsPayload = [];

                // Sort product IDs to prevent deadlocks when locking multiple rows
                $productIds = array_keys($combinedItems);
                sort($productIds);

                foreach ($productIds as $pid) {
                    $item = $combinedItems[$pid];
                    $quantity = $item['quantity'];

                    $product = Product::where('id', $pid)
                        ->where('branch_id', $branchId)
                        ->lockForUpdate()
                        ->first();

                    if (!$product) {
                        // Resource not found in scope: 404
                        throw new \Exception("Produk dengan ID {$pid} tidak ditemukan pada cabang ini.", 404);
                    }

                    if ($product->status && strtolower($product->status) !== 'aktif' && strtolower($product->status) !== 'active') {
                        // Conflict/Business rule: 422 or 409
                        throw new \Exception("Produk '{$product->name}' tidak aktif.", 422);
                    }

                    if ($product->stock < $quantity) {
                        // Conflict: 409
                        throw new \Exception("Stok produk '{$product->name}' tidak cukup. Tersedia: {$product->stock}, Diminta: {$quantity}", 409);
                    }

                    $itemSubtotal = (int) $product->price * $quantity;

                    $subtotal += $itemSubtotal;
                    $totalItem += $quantity;

                    $itemsPayload[] = [
                        'product' => $product,
                        'quantity' => $quantity,
                        'subtotal' => $itemSubtotal,
                    ];
                }

                $discount = (int) ($validatedData['discount'] ?? 0);

                if ($discount < 0) {
                    throw new \Exception('Diskon tidak boleh negatif.', 422);
                }

                if ($discount > $subtotal) {
                    throw new \Exception('Diskon tidak boleh lebih besar dari subtotal.', 422);
                }

                // Check max discount limit
                // Roles like 'owner' might bypass this, but for now we enforce it for everyone or just cashier
                if ($user->role !== 'owner' && $user->role !== 'admin') {
                    $maxAllowedDiscountNominal = (int) round($subtotal * ($maxDiscountPercent / 100));
                    if ($discount > $maxAllowedDiscountNominal) {
                        throw new \Exception("Diskon melebihi batas maksimal yang diizinkan ({$maxDiscountPercent}%). Maksimal nominal diskon: {$maxAllowedDiscountNominal}", 422);
                    }
                }

                $applyTax = $validatedData['apply_tax'] ?? true; // Apply by default if frontend doesn't send flag, but we follow settings
                $taxRate = ($applyTax && $isPpnActive) ? $ppnRate : 0;

                $taxableAmount = $subtotal - $discount;
                $tax = (int) round($taxableAmount * ($taxRate / 100));
                $grandTotal = $taxableAmount + $tax;

                $paidAmount = (int) $validatedData['paid_amount'];

                if ($paidAmount < $grandTotal) {
                    throw new \Exception('Nominal pembayaran belum mencukupi.', 422);
                }

                $invoiceNumber = $this->generateInvoiceNumber();

                $transaction = Transaction::create([
                    'branch_id' => $branchId,
                    'invoice_number' => $invoiceNumber,
                    'cashier_name' => $cashierName,
                    'username' => $username,
                    'shift_name' => $activeShift->shift_name ?? '-',
                    'total_item' => $totalItem,
                    'subtotal' => $subtotal,
                    'discount' => $discount,
                    'tax' => $tax,
                    'tax_rate' => $taxRate,
                    'grand_total' => $grandTotal,
                    'payment_method' => $validatedData['payment_method'],
                    'paid_amount' => $paidAmount,
                    'change_amount' => $paidAmount - $grandTotal,
                    'status' => 'Berhasil',
                    'transaction_date' => now(),
                ]);

                foreach ($itemsPayload as $itemPayload) {
                    $product = $itemPayload['product'];
                    $quantity = $itemPayload['quantity'];

                    $transaction->items()->create([
                        'product_id' => $product->id,
                        'product_code' => $product->code,
                        'product_name' => $product->name,
                        'category' => $product->category,
                        'price' => $product->price,
                        'quantity' => $quantity,
                        'subtotal' => $itemPayload['subtotal'],
                    ]);

                    $beforeStock = $product->stock;
                    $product->decrement('stock', $quantity);

                    StockHistory::create([
                        'product_id' => $product->id,
                        'branch_id' => $product->branch_id,
                        'user_id' => $user->id,
                        'type' => 'sale',
                        'quantity' => $quantity,
                        'before_store_stock' => $beforeStock,
                        'after_store_stock' => $product->stock,
                        'before_warehouse_stock' => $product->warehouse_stock,
                        'after_warehouse_stock' => $product->warehouse_stock,
                        'note' => 'Penjualan kasir',
                    ]);
                }

                return $transaction->load([
                    'branch:id,name,code',
                    'items',
                ]);
            });

            return response()->json([
                'success' => true,
                'message' => 'Transaksi berhasil disimpan.',
                'data' => $transaction,
            ], 201);
        } catch (\Exception $error) {
            $statusCode = $error->getCode();
            if ($statusCode < 100 || $statusCode > 599) {
                $statusCode = 500;
            }

            $message = $error->getMessage();
            if ($statusCode === 500 && !config('app.debug')) {
                $message = 'Terjadi kesalahan internal pada server saat memproses transaksi.';
                // Log the actual error safely
                \Illuminate\Support\Facades\Log::error('Checkout Error: ' . $error->getMessage(), [
                    'trace' => $error->getTraceAsString()
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => $message,
            ], $statusCode);
        }
    }

    private function generateInvoiceNumber()
    {
        $date = now()->format('Ymd');
        $lastTransaction = Transaction::whereDate('created_at', now()->toDateString())
            ->latest('id')
            ->first();

        $nextNumber = $lastTransaction ? $lastTransaction->id + 1 : 1;

        return 'INV-' . $date . '-' . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }
}


