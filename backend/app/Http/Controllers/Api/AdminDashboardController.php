<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockHistory;
use App\Traits\ChecksBranchIsolation;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AdminDashboardController extends Controller
{
    use ChecksBranchIsolation;

    public function index(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $branchId = $this->getFilteredBranchId($request);
        $today = Carbon::today();
        $soonUntil = Carbon::today()->addDays(30);

        $productQuery = Product::query()
            ->with('branch:id,name,code');

        if ($branchId) {
            $productQuery->where('branch_id', $branchId);
        }

        if (Schema::hasColumn('products', 'status')) {
            $productQuery->where(function ($query) {
                $query->whereNull('status')
                    ->orWhereRaw('LOWER(status) = ?', ['active'])
                    ->orWhereRaw('LOWER(status) = ?', ['aktif']);
            });
        }

        $products = $productQuery->orderBy('id', 'desc')->get();

        $formattedProducts = $products->map(function ($product) {
            return $this->formatProduct($product);
        })->values();

        $summary = [
            'total_products' => $formattedProducts->count(),
            'total_stock' => $formattedProducts->sum('stock'),
            'empty_stock_count' => $formattedProducts->where('stock', '<=', 0)->count(),
            'low_stock_count' => $formattedProducts->where('stock', '>', 0)->where('stock', '<=', 5)->count(),
            'expired_count' => $formattedProducts->filter(function ($product) use ($today) {
                if (empty($product['expired_date'])) {
                    return false;
                }

                try {
                    return Carbon::parse($product['expired_date'])->lt($today);
                } catch (\Throwable $e) {
                    return false;
                }
            })->count(),
            'expiring_soon_count' => $formattedProducts->filter(function ($product) use ($today, $soonUntil) {
                if (empty($product['expired_date'])) {
                    return false;
                }

                try {
                    $expiredDate = Carbon::parse($product['expired_date']);
                    return $expiredDate->betweenIncluded($today, $soonUntil);
                } catch (\Throwable $e) {
                    return false;
                }
            })->count(),
        ];

        $lowestStock = $formattedProducts
            ->sortBy(function ($product) {
                return $product['stock'] ?? 0;
            })
            ->take(5)
            ->values();

        $emptyStockProducts = $formattedProducts
            ->where('stock', '<=', 0)
            ->take(5)
            ->values();

        $lowStockProducts = $formattedProducts
            ->where('stock', '>', 0)
            ->where('stock', '<=', 5)
            ->take(5)
            ->values();

        $expiredProducts = $formattedProducts->filter(function ($product) use ($today) {
            if (empty($product['expired_date'])) {
                return false;
            }

            try {
                return Carbon::parse($product['expired_date'])->lt($today);
            } catch (\Throwable $e) {
                return false;
            }
        })->values();

        $expiringSoonProducts = $formattedProducts->filter(function ($product) use ($today, $soonUntil) {
            if (empty($product['expired_date'])) {
                return false;
            }

            try {
                $expiredDate = Carbon::parse($product['expired_date']);
                return $expiredDate->betweenIncluded($today, $soonUntil);
            } catch (\Throwable $e) {
                return false;
            }
        })->values();

        $recentActivitiesQuery = StockHistory::with(['product:id,name,code,category,branch_id', 'user:id,name,username'])
            ->orderBy('id', 'desc');

        if ($branchId) {
            $recentActivitiesQuery->where('branch_id', $branchId);
        }

        $recentActivities = $recentActivitiesQuery->take(5)->get()->map(function ($activity) {
            return [
                'id' => $activity->id,
                'product_id' => $activity->product_id,
                'branch_id' => $activity->branch_id,
                'type' => $activity->type,
                'quantity' => $activity->quantity,
                'before_store_stock' => $activity->before_store_stock,
                'after_store_stock' => $activity->after_store_stock,
                'before_warehouse_stock' => $activity->before_warehouse_stock,
                'after_warehouse_stock' => $activity->after_warehouse_stock,
                'note' => $activity->note,
                'created_at' => $activity->created_at,
                'updated_at' => $activity->updated_at,
                'product' => $activity->product ? [
                    'id' => $activity->product->id,
                    'name' => $activity->product->name,
                    'code' => $activity->product->code,
                    'category' => $activity->product->category,
                    'branch_id' => $activity->product->branch_id,
                ] : null,
                'user' => $activity->user ? [
                    'id' => $activity->user->id,
                    'name' => $activity->user->name,
                    'username' => $activity->user->username,
                ] : null,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $summary,
                'lowest_stock' => $lowestStock,
                'products' => $formattedProducts,
                'recent_activities' => $recentActivities,
                'empty_stock_products' => $emptyStockProducts,
                'low_stock_products' => $lowStockProducts,
                'expired_products' => $expiredProducts,
                'expiring_soon_products' => $expiringSoonProducts,
            ],
        ]);
    }

    private function formatProduct(Product $product): array
    {
        return [
            'id' => $product->id,
            'branch_id' => $product->branch_id,
            'branch' => $product->branch ? [
                'id' => $product->branch->id,
                'name' => $product->branch->name,
            ] : null,
            'code' => $product->code,
            'name' => $product->name,
            'category' => $product->category,
            'stock' => (int) ($product->stock ?? 0),
            'warehouse_stock' => (int) ($product->warehouse_stock ?? 0),
            'store_stock' => (int) ($product->store_stock ?? 0),
            'price' => (int) ($product->price ?? 0),
            'expired_date' => $product->expired_date,
            'storage_location' => $product->storage_location,
            'image' => $product->image,
            'status' => $product->status,
        ];
    }
}
