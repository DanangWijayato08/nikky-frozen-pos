<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Traits\ChecksBranchIsolation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    use ChecksBranchIsolation;

    public function index(Request $request)
    {
        $query = Expense::with('branch:id,name,code')
            ->orderBy('expense_date', 'desc')
            ->orderBy('id', 'desc');

        $filteredBranchId = $this->getFilteredBranchId($request);
        if ($filteredBranchId) {
            $query->where('branch_id', $filteredBranchId);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('date')) {
            $query->whereDate('expense_date', $request->date);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('expense_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('expense_date', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($item) use ($search) {
                $item->where('description', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhere('user_name', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%");
            });
        }

        $perPage = $request->query('per_page', 10);
        $expenses = $query->get();

        return response()->json([
            'success' => true,
            'message' => 'Data pengeluaran berhasil diambil.',
            'data' => $expenses,
        ]);
    }

    public function show(Request $request, $id)
    {
        $expense = Expense::with('branch:id,name,code')->find($id);

        if (!$expense || !$this->authorizeBranchAccess($request, $expense->branch_id)) {
            return response()->json([
                'success' => false,
                'message' => 'Data pengeluaran tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail pengeluaran berhasil diambil.',
            'data' => $expense,
        ]);
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'expense_date' => ['required', 'date'],
            'category' => ['required', 'string', 'max:100'],
            'description' => ['required', 'string'],
            'amount' => ['required', 'integer', 'min:0'],
            'user_name' => ['nullable', 'string', 'max:255'],
            'username' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['Aktif', 'Dibatalkan'])],
        ]);

        $user = $request->user();
        if ($user && $user->role !== 'owner') {
            $validatedData['branch_id'] = $user->branch_id;
            $validatedData['user_name'] = $user->name;
            $validatedData['username'] = $user->username;
        }

        $validatedData['status'] = $validatedData['status'] ?? 'Aktif';

        $expense = Expense::create($validatedData);

        return response()->json([
            'success' => true,
            'message' => 'Pengeluaran berhasil ditambahkan.',
            'data' => $expense->load('branch:id,name,code'),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $expense = Expense::find($id);

        if (!$expense || !$this->authorizeBranchAccess($request, $expense->branch_id)) {
            return response()->json([
                'success' => false,
                'message' => 'Data pengeluaran tidak ditemukan.',
            ], 404);
        }

        $validatedData = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'expense_date' => ['required', 'date'],
            'category' => ['required', 'string', 'max:100'],
            'description' => ['required', 'string'],
            'amount' => ['required', 'integer', 'min:0'],
            'user_name' => ['nullable', 'string', 'max:255'],
            'username' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['Aktif', 'Dibatalkan'])],
        ]);

        $user = $request->user();
        if ($user && $user->role !== 'owner') {
            $validatedData['branch_id'] = $user->branch_id;
            $validatedData['user_name'] = $user->name;
            $validatedData['username'] = $user->username;
        }

        $validatedData['status'] = $validatedData['status'] ?? 'Aktif';

        $expense->update($validatedData);

        return response()->json([
            'success' => true,
            'message' => 'Pengeluaran berhasil diperbarui.',
            'data' => $expense->load('branch:id,name,code'),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $expense = Expense::find($id);

        if (!$expense || !$this->authorizeBranchAccess($request, $expense->branch_id)) {
            return response()->json([
                'success' => false,
                'message' => 'Data pengeluaran tidak ditemukan.',
            ], 404);
        }

        $expense->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengeluaran berhasil dihapus.',
        ]);
    }
}

