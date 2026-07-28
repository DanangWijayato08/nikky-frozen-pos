<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockHistory;
use App\Traits\ChecksBranchIsolation;
use Illuminate\Http\Request;

class StockHistoryController extends Controller
{
    use ChecksBranchIsolation;

    public function index(Request $request)
    {
        $query = StockHistory::with(['product:id,name,code,category', 'user:id,name,username'])
            ->orderBy('id', 'desc');

        $typeMappings = [
            'restock' => ['restock', 'stock_restock', 'batch_restock'],
            'transfer' => ['transfer', 'transfer_in', 'transfer_out', 'branch_transfer', 'batch_transfer'],
            'correction' => ['correction', 'stock_correction', 'koreksi', 'adjustment', 'stock_adjustment'],
        ];

        $relevantTypes = array_values(array_unique(array_merge(
            $typeMappings['restock'],
            $typeMappings['transfer'],
            $typeMappings['correction']
        )));

        $resolveTypes = function (string $value) use ($typeMappings) {
            return $typeMappings[$value] ?? [$value];
        };

        $filteredBranchId = $this->getFilteredBranchId($request);
        if ($filteredBranchId) {
            $query->where('branch_id', $filteredBranchId);
        }

        if ($request->filled('type')) {
            $requestedTypes = collect(explode(',', $request->type))
                ->map(fn ($type) => trim($type))
                ->filter()
                ->flatMap(fn ($type) => $resolveTypes($type))
                ->unique()
                ->values()
                ->all();

            if (! empty($requestedTypes)) {
                $query->whereIn('type', $requestedTypes);
            }
        } else {
            $query->whereIn('type', $relevantTypes);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $histories = $query->get();

        return response()->json([
            'success' => true,
            'message' => 'Data riwayat stok berhasil diambil.',
            'data' => $histories,
        ]);
    }
}
