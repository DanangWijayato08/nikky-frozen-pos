<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockHistory;
use App\Traits\ChecksBranchIsolation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    use ChecksBranchIsolation;

    public function index(Request $request)
    {
        $query = Product::with('branch:id,name,code')
            ->orderBy('id', 'desc');

        $filteredBranchId = $this->getFilteredBranchId($request);
        if ($filteredBranchId) {
            $query->where('branch_id', $filteredBranchId);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($item) use ($search) {
                $item->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $products = $query->get();

        $products->transform(function ($product) use ($request) {
            $product->image_url = $product->image ? $request->getSchemeAndHttpHost() . Storage::url($product->image) : null;
            return $product;
        });

        return response()->json([
            'success' => true,
            'message' => 'Data produk berhasil diambil.',
            'data' => $products,
        ]);
    }

    public function show(Request $request, $id)
    {
        $product = Product::with('branch:id,name,code')->find($id);

        if (!$product || !$this->authorizeBranchAccess($request, $product->branch_id)) {
            return response()->json([
                'success' => false,
                'message' => 'Produk tidak ditemukan.',
            ], 404);
        }

        $product->image_url = $product->image ? $request->getSchemeAndHttpHost() . Storage::url($product->image) : null;

        return response()->json([
            'success' => true,
            'message' => 'Detail produk berhasil diambil.',
            'data' => $product,
        ]);
    }

    public function store(Request $request)
    {
        try {
            $validatedData = $request->validate([
                'branch_id' => ['required', 'exists:branches,id'],
                'code' => ['required', 'string', 'max:50', 'unique:products,code'],
                'name' => ['required', 'string', 'max:255'],
                'category' => ['required', 'string', 'max:100'],
                'stock' => ['nullable', 'integer', 'min:0'],
                'store_stock' => ['nullable', 'integer', 'min:0'],
                'warehouse_stock' => ['nullable', 'integer', 'min:0'],
                'price' => ['required', 'integer', 'min:0'],
                'expired_date' => ['nullable', 'date'],
                'storage_location' => ['nullable', 'string', 'max:100'],
                'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
                'status' => ['nullable', 'string', 'max:50'],
            ]);

            // Force branch_id for non-owners
            $validatedData['branch_id'] = $this->getForcedBranchId($request) ?? $validatedData['branch_id'];

            if ($request->hasFile('image')) {
                $path = $request->file('image')->store('products', 'public');
                $validatedData['image'] = $path;
            }

            $validatedData['status'] = $validatedData['status'] ?? 'Aktif';

            if (isset($validatedData['stock'])) {
                $validatedData['stock'] = (int) $validatedData['stock'];
            } else {
                $validatedData['stock'] = (int) ($validatedData['store_stock'] ?? 0) + (int) ($validatedData['warehouse_stock'] ?? 0);
            }

            $validatedData['store_stock'] = $validatedData['stock'];
            $validatedData['warehouse_stock'] = $validatedData['stock'];
            $validatedData['min_stock'] = 0;

            $product = Product::create($validatedData);

            StockHistory::create([
                'product_id' => $product->id,
                'branch_id' => $product->branch_id,
                'user_id' => auth()->id(),
                'type' => 'product_created',
                'quantity' => $product->stock,
                'before_store_stock' => 0,
                'after_store_stock' => $product->stock,
                'before_warehouse_stock' => 0,
                'after_warehouse_stock' => $product->stock,
                'note' => 'Produk baru ditambahkan',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Produk berhasil ditambahkan.',
                'data' => $product->load('branch:id,name,code'),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menyimpan produk. Periksa data produk dan coba lagi.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Produk tidak ditemukan.',
            ], 404);
        }

        if (!$this->authorizeBranchAccess($request, $product->branch_id)) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses untuk mengubah data cabang lain.',
            ], 403);
        }

        $validatedData = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('products', 'code')->ignore($product->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:100'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'store_stock' => ['nullable', 'integer', 'min:0'],
            'warehouse_stock' => ['nullable', 'integer', 'min:0'],
            'price' => ['required', 'integer', 'min:0'],
            'expired_date' => ['nullable', 'date'],
            'storage_location' => ['nullable', 'string', 'max:100'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'status' => ['nullable', 'string', 'max:50'],
        ]);

        $validatedData['branch_id'] = $this->getForcedBranchId($request) ?? $validatedData['branch_id'];

        if ($request->hasFile('image')) {
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $path = $request->file('image')->store('products', 'public');
            $validatedData['image'] = $path;
        }

        $validatedData['status'] = $validatedData['status'] ?? 'Aktif';

        if (isset($validatedData['stock'])) {
            $validatedData['stock'] = (int) $validatedData['stock'];
        } else {
            $validatedData['stock'] = (int) ($validatedData['store_stock'] ?? 0) + (int) ($validatedData['warehouse_stock'] ?? 0);
        }

        $beforeStock = $product->stock;
        $product->update($validatedData);

        if ($beforeStock != $product->stock) {
            StockHistory::create([
                'product_id' => $product->id,
                'branch_id' => $product->branch_id,
                'user_id' => $request->user_id ?? auth()->id(),
                'type' => 'product_updated',
                'quantity' => $product->stock - $beforeStock,
                'before_store_stock' => $beforeStock,
                'after_store_stock' => $product->stock,
                'before_warehouse_stock' => $product->warehouse_stock,
                'after_warehouse_stock' => $product->warehouse_stock,
                'note' => 'Update data produk',
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Produk berhasil diperbarui.',
            'data' => $product->load('branch:id,name,code'),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Produk tidak ditemukan.',
            ], 404);
        }

        if (!$this->authorizeBranchAccess($request, $product->branch_id)) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses untuk menghapus data cabang lain.',
            ], 403);
        }

        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }

        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Produk berhasil dihapus.',
        ]);
    }

    public function mutateStock(Request $request, $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Mutasi ke toko sudah tidak digunakan karena stok gudang dan toko sudah digabung menjadi stok cabang.',
        ], 422);
    }

    public function restockWarehouse(Request $request, $id)
    {
        $validatedData = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
        ]);

        $amount = $validatedData['amount'];

        try {
            $product = \Illuminate\Support\Facades\DB::transaction(function () use ($id, $amount, $request) {
                $product = Product::lockForUpdate()->find($id);

                if (!$product) {
                    throw new \Exception('Produk tidak ditemukan.', 404);
                }

                if (!$this->authorizeBranchAccess($request, $product->branch_id)) {
                    throw new \Exception('Anda tidak memiliki akses untuk menambah stok cabang lain.', 403);
                }

                $beforeStock = $product->stock;
                $product->stock += $amount;
                $product->save();

                StockHistory::create([
                    'product_id' => $product->id,
                    'branch_id' => $product->branch_id,
                    'user_id' => $request->user_id ?? auth()->id(),
                    'type' => 'restock',
                    'quantity' => $amount,
                    'before_store_stock' => $beforeStock,
                    'after_store_stock' => $product->stock,
                    'before_warehouse_stock' => $product->warehouse_stock,
                    'after_warehouse_stock' => $product->warehouse_stock,
                    'note' => 'Restock stok',
                ]);

                return $product;
            });

            return response()->json([
                'success' => true,
                'message' => "Restock sebesar {$amount} berhasil ditambahkan.",
                'data' => $product,
            ]);
        } catch (\Exception $e) {
            $code = $e->getCode() ?: 422;
            if ($code < 100 || $code > 599) $code = 422;
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], $code);
        }
    }

    public function adjustStock(Request $request, $id)
    {
        $validatedData = $request->validate([
            'stock' => ['required', 'integer', 'min:0'],
            'note' => ['nullable', 'string', 'max:255'],
            'user_id' => ['required']
        ]);

        $newStock = $validatedData['stock'];

        try {
            $product = \Illuminate\Support\Facades\DB::transaction(function () use ($id, $newStock, $validatedData, $request) {
                $product = Product::lockForUpdate()->find($id);

                if (!$product) {
                    throw new \Exception('Produk tidak ditemukan.', 404);
                }

                if (!$this->authorizeBranchAccess($request, $product->branch_id)) {
                    throw new \Exception('Anda tidak memiliki akses untuk mengoreksi stok cabang lain.', 403);
                }

                $beforeStock = $product->stock;

                if ($beforeStock != $newStock) {
                    $product->stock = $newStock;
                    $product->save();

                    $quantityDiff = $newStock - $beforeStock;

                    StockHistory::create([
                        'product_id' => $product->id,
                        'branch_id' => $product->branch_id,
                        'user_id' => $validatedData['user_id'],
                        'type' => 'stock_adjustment',
                        'quantity' => $quantityDiff,
                        'before_store_stock' => $beforeStock,
                        'after_store_stock' => $newStock,
                        'before_warehouse_stock' => $product->warehouse_stock,
                        'after_warehouse_stock' => $product->warehouse_stock,
                        'note' => $validatedData['note'] ?? 'Koreksi Stok Fisik',
                    ]);
                }

                return $product;
            });

            return response()->json([
                'success' => true,
                'message' => 'Koreksi stok berhasil disimpan.',
                'data' => $product,
            ]);
        } catch (\Exception $e) {
            $code = $e->getCode() ?: 422;
            if ($code < 100 || $code > 599) $code = 422;
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], $code);
        }
    }

    public function transferStock(Request $request, $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Produk asal tidak ditemukan.',
            ], 404);
        }

        if (!$this->authorizeBranchAccess($request, $product->branch_id)) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses untuk mentransfer stok cabang lain.',
            ], 403);
        }

        $validatedData = $request->validate([
            'target_branch_id' => ['required', 'exists:branches,id'],
            'amount' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:255'],
            'user_id' => ['required']
        ]);

        $amount = $validatedData['amount'];

        $sourceProductUnlocked = Product::find($id);
        if (!$sourceProductUnlocked) {
            return response()->json([
                'success' => false,
                'message' => 'Produk asal tidak ditemukan.',
            ], 404);
        }

        if ($validatedData['target_branch_id'] == $sourceProductUnlocked->branch_id) {
            return response()->json([
                'success' => false,
                'message' => 'Cabang tujuan tidak boleh sama dengan cabang asal.',
            ], 422);
        }

        try {
            \Illuminate\Support\Facades\DB::beginTransaction();

            // First find them without locking to know their IDs
            $sourceProductUnlocked = Product::find($id);
            if (!$sourceProductUnlocked) {
                throw new \Exception('Produk tidak ditemukan.', 404);
            }

            if (!$this->authorizeBranchAccess($request, $sourceProductUnlocked->branch_id)) {
                throw new \Exception('Anda tidak memiliki akses untuk mentransfer stok cabang lain.', 403);
            }

            if ($sourceProductUnlocked->stock < $amount) {
                throw new \Exception('Stok tidak mencukupi untuk transfer sejumlah ' . $amount);
            }

            $targetProductUnlocked = Product::where('name', $sourceProductUnlocked->name)
                ->where('category', $sourceProductUnlocked->category)
                ->where('branch_id', $validatedData['target_branch_id'])
                ->first();

            if (!$targetProductUnlocked) {
                throw new \Exception('Produk belum tersedia di cabang tujuan. Tambahkan produk terlebih dahulu.');
            }

            // Lock in order of ID to prevent deadlock
            $productsToLock = [$sourceProductUnlocked->id, $targetProductUnlocked->id];
            sort($productsToLock);

            $lockedProducts = [];
            foreach ($productsToLock as $pidToLock) {
                $lockedProducts[$pidToLock] = Product::lockForUpdate()->find($pidToLock);
            }

            $product = $lockedProducts[$sourceProductUnlocked->id];
            $targetProduct = $lockedProducts[$targetProductUnlocked->id];

            // Re-check stock after lock
            if ($product->stock < $amount) {
                throw new \Exception('Stok tidak mencukupi untuk transfer.');
            }

            $sourceBeforeStock = $product->stock;
            $targetBeforeStock = $targetProduct->stock;

            $product->stock -= $amount;
            $product->save();

            $targetProduct->stock += $amount;
            $targetProduct->save();

            StockHistory::create([
                'product_id' => $product->id,
                'branch_id' => $product->branch_id,
                'user_id' => $validatedData['user_id'],
                'type' => 'transfer_out',
                'quantity' => $amount,
                'before_store_stock' => $sourceBeforeStock,
                'after_store_stock' => $product->stock,
                'before_warehouse_stock' => $product->warehouse_stock,
                'after_warehouse_stock' => $product->warehouse_stock,
                'note' => $validatedData['note'] ?? 'Transfer keluar ke cabang tujuan',
            ]);

            StockHistory::create([
                'product_id' => $targetProduct->id,
                'branch_id' => $targetProduct->branch_id,
                'user_id' => $validatedData['user_id'],
                'type' => 'transfer_in',
                'quantity' => $amount,
                'before_store_stock' => $targetBeforeStock,
                'after_store_stock' => $targetProduct->stock,
                'before_warehouse_stock' => $targetProduct->warehouse_stock,
                'after_warehouse_stock' => $targetProduct->warehouse_stock,
                'note' => $validatedData['note'] ?? 'Transfer masuk dari cabang asal',
            ]);

            \Illuminate\Support\Facades\DB::commit();
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => "Transfer sebesar {$amount} berhasil dikirim ke cabang tujuan.",
            'data' => $product,
        ]);
    }

    public function batchStock(Request $request)
    {
        $validatedData = $request->validate([
            'branch_id' => ['required'],
            'user_id' => ['required'],
            'action' => ['required', 'in:batch_restock,batch_mutation_to_store,batch_transfer_branch,batch_stock_adjustment'],
            'target_branch_id' => ['required_if:action,batch_transfer_branch', 'exists:branches,id'],
            'note' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.amount' => ['required_if:action,batch_restock,batch_mutation_to_store,batch_transfer_branch', 'integer', 'min:1'],
            'items.*.stock' => ['required_if:action,batch_stock_adjustment', 'integer', 'min:0'],
        ]);

        // Branch Isolation for batch operation
        $branchId = $this->getForcedBranchId($request) ?? $validatedData['branch_id'];
        $action = $validatedData['action'];
        $userId = $validatedData['user_id'];
        $items = $validatedData['items'];
        $targetBranchId = $validatedData['target_branch_id'] ?? null;
        $note = $validatedData['note'] ?? null;

        if ($action === 'batch_mutation_to_store') {
            return response()->json([
                'success' => false,
                'message' => 'Mutasi ke toko sudah tidak digunakan karena stok gudang dan toko sudah digabung menjadi stok cabang.',
            ], 422);
        }

        \Illuminate\Support\Facades\DB::beginTransaction();

        try {
            foreach ($items as $item) {
                $product = Product::lockForUpdate()->find($item['product_id']);

                if (!$product) {
                    throw new \Exception("Produk dengan ID {$item['product_id']} tidak ditemukan.");
                }

                if (!$this->authorizeBranchAccess($request, $product->branch_id) || $product->branch_id != $branchId) {
                    throw new \Exception("Anda tidak memiliki akses untuk memproses produk '{$product->name}'.");
                }

                $beforeStock = $product->stock;

                if ($action === 'batch_stock_adjustment') {
                    $newStock = (int) $item['stock'];
                    $product->stock = $newStock;
                    $product->save();

                    StockHistory::create([
                        'product_id' => $product->id,
                        'branch_id' => $product->branch_id,
                        'user_id' => $userId,
                        'type' => 'stock_adjustment',
                        'quantity' => $newStock - $beforeStock,
                        'before_store_stock' => $beforeStock,
                        'after_store_stock' => $product->stock,
                        'before_warehouse_stock' => $product->warehouse_stock,
                        'after_warehouse_stock' => $product->warehouse_stock,
                        'note' => $note ?? 'Batch Koreksi Stok',
                    ]);

                } elseif ($action === 'batch_transfer_branch') {
                    $amount = (int) $item['amount'];

                    if ($product->stock < $amount) {
                        throw new \Exception("Stok '{$product->name}' tidak mencukupi untuk ditransfer. Tersedia: {$product->stock}, Diminta: {$amount}");
                    }

                    $targetProduct = Product::where('name', $product->name)
                        ->where('category', $product->category)
                        ->where('branch_id', $targetBranchId)
                        ->first();

                    if (!$targetProduct) {
                        throw new \Exception("Produk '{$product->name}' belum tersedia di cabang tujuan.");
                    }

                    $targetBeforeStock = $targetProduct->stock;

                    $product->stock -= $amount;
                    $product->save();

                    $targetProduct->stock += $amount;
                    $targetProduct->save();

                    StockHistory::create([
                        'product_id' => $product->id,
                        'branch_id' => $product->branch_id,
                        'user_id' => $userId,
                        'type' => 'transfer_out',
                        'quantity' => $amount,
                        'before_store_stock' => $beforeStock,
                        'after_store_stock' => $product->stock,
                        'before_warehouse_stock' => $product->warehouse_stock,
                        'after_warehouse_stock' => $product->warehouse_stock,
                        'note' => $note ?? 'Batch Transfer Keluar',
                    ]);

                    StockHistory::create([
                        'product_id' => $targetProduct->id,
                        'branch_id' => $targetProduct->branch_id,
                        'user_id' => $userId,
                        'type' => 'transfer_in',
                        'quantity' => $amount,
                        'before_store_stock' => $targetBeforeStock,
                        'after_store_stock' => $targetProduct->stock,
                        'before_warehouse_stock' => $targetProduct->warehouse_stock,
                        'after_warehouse_stock' => $targetProduct->warehouse_stock,
                        'note' => $note ? ($note . " (dari cabang asal)") : 'Batch Transfer Masuk',
                    ]);

                } elseif ($action === 'batch_restock') {
                    $amount = (int) $item['amount'];
                    $product->stock += $amount;
                    $product->save();

                    StockHistory::create([
                        'product_id' => $product->id,
                        'branch_id' => $product->branch_id,
                        'user_id' => $userId,
                        'type' => 'restock',
                        'quantity' => $amount,
                        'before_store_stock' => $beforeStock,
                        'after_store_stock' => $product->stock,
                        'before_warehouse_stock' => $product->warehouse_stock,
                        'after_warehouse_stock' => $product->warehouse_stock,
                        'note' => $note ?? 'Batch Restok Stok',
                    ]);
                }
            }

            \Illuminate\Support\Facades\DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Proses batch stok berhasil.',
            ]);

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}

