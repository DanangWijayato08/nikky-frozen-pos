<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\Transaction;
use App\Traits\ChecksBranchIsolation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ShiftController extends Controller
{
    use ChecksBranchIsolation;

    public function index(Request $request)
    {
        $query = Shift::with('branch:id,name,code')
            ->orderBy('id', 'desc');

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

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('date')) {
            $query->whereDate('opened_at', $request->date);
        }

        $shifts = $query->get();

        return response()->json([
            'success' => true,
            'message' => 'Data shift berhasil diambil.',
            'data' => $shifts,
        ]);
    }

    public function active(Request $request)
    {
        $request->validate([
            'username' => ['required', 'string'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $user = $request->user();
        $username = ($user && $user->role === 'cashier') ? $user->username : $request->username;

        $query = Shift::with('branch:id,name,code')
            ->where('username', $username)
            ->where('status', 'Berjalan')
            ->whereNull('closed_at');

        $branchId = $this->getFilteredBranchId($request);
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $shift = $query->latest('id')->first();

        return response()->json([
            'success' => true,
            'data' => [
                'has_active_shift' => (bool) $shift,
                'shift' => $shift,
            ],
        ]);
    }

    public function current(Request $request)
    {
        $request->validate([
            'username' => ['required', 'string'],
        ]);

        $user = $request->user();
        $username = ($user && $user->role === 'cashier') ? $user->username : $request->username;

        $query = Shift::with('branch:id,name,code')
            ->where('username', $username)
            ->where('status', 'Berjalan');

        $branchId = $this->getFilteredBranchId($request);
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $shift = $query->latest('id')->first();

        return response()->json([
            'success' => true,
            'message' => $shift
                ? 'Shift berjalan berhasil ditemukan.'
                : 'Tidak ada shift berjalan.',
            'data' => $shift,
        ]);
    }

    public function open(Request $request)
    {
        $validatedData = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'cashier_name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:100'],
            'shift_name' => ['required', 'string', 'max:100'],
            'opening_cash' => ['required', 'integer', 'min:0'],
            'note' => ['nullable', 'string'],
        ]);

        $user = $request->user();
        if ($user && $user->role !== 'owner') {
            $validatedData['branch_id'] = $user->branch_id;
            $validatedData['cashier_name'] = $user->name;
            $validatedData['username'] = $user->username;
        }

        $runningShift = Shift::where('username', $validatedData['username'])
            ->where('status', 'Berjalan')
            ->first();

        if ($runningShift) {
            return response()->json([
                'success' => false,
                'message' => 'Kasir ini masih memiliki shift yang berjalan. Tutup shift terlebih dahulu.',
            ], 422);
        }

        $shift = Shift::create([
            'branch_id' => $validatedData['branch_id'],
            'cashier_name' => $validatedData['cashier_name'],
            'username' => $validatedData['username'],
            'shift_name' => $validatedData['shift_name'],
            'opening_cash' => $validatedData['opening_cash'],
            'opened_at' => now(),
            'note' => $validatedData['note'] ?? null,
            'status' => 'Berjalan',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Shift berhasil dibuka.',
            'data' => $shift->load('branch:id,name,code'),
        ], 201);
    }

    private function canModifyShift(Request $request, Shift $shift)
    {
        if (!$this->authorizeBranchAccess($request, $shift->branch_id)) {
            return false;
        }

        $user = $request->user();
        if ($user && $user->role === 'cashier' && $shift->username !== $user->username) {
            return false;
        }

        return true;
    }

    public function close(Request $request, $id)
    {
        $shift = Shift::find($id);

        if (!$shift || !$this->canModifyShift($request, $shift)) {
            return response()->json([
                'success' => false,
                'message' => 'Data shift tidak ditemukan atau Anda tidak berhak mengaksesnya.',
            ], 404);
        }

        if ($shift->status === 'Selesai') {
            return response()->json([
                'success' => false,
                'message' => 'Shift ini sudah ditutup.',
            ], 422);
        }

        $validatedData = $request->validate([
            'closing_cash' => ['required', 'integer', 'min:0'],
            'note' => ['nullable', 'string'],
        ]);

        $transactions = Transaction::where('branch_id', $shift->branch_id)
            ->where('username', $shift->username)
            ->where('status', 'Berhasil')
            ->where('transaction_date', '>=', $shift->opened_at)
            ->where(function ($query) use ($shift) {
                if ($shift->closed_at) {
                    $query->where('transaction_date', '<=', $shift->closed_at);
                }
            })
            ->get();

        $totalSales = $transactions->sum('grand_total');
        $totalTransactions = $transactions->count();

        $expectedCash = $shift->opening_cash + $totalSales;
        $cashDifference = $validatedData['closing_cash'] - $expectedCash;

        $shift->update([
            'closing_cash' => $validatedData['closing_cash'],
            'closed_at' => now(),
            'total_sales' => $totalSales,
            'total_transactions' => $totalTransactions,
            'expected_cash' => $expectedCash,
            'cash_difference' => $cashDifference,
            'note' => $validatedData['note'] ?? $shift->note,
            'status' => 'Selesai',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Shift berhasil ditutup.',
            'data' => $shift->load('branch:id,name,code'),
        ]);
    }

    public function show(Request $request, $id)
    {
        $shift = Shift::with('branch:id,name,code')->find($id);

        if (!$shift || !$this->canModifyShift($request, $shift)) {
            return response()->json([
                'success' => false,
                'message' => 'Data shift tidak ditemukan atau Anda tidak berhak mengaksesnya.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail shift berhasil diambil.',
            'data' => $shift,
        ]);
    }

    public function update(Request $request, $id)
    {
        $shift = Shift::find($id);

        if (!$shift || !$this->canModifyShift($request, $shift)) {
            return response()->json([
                'success' => false,
                'message' => 'Data shift tidak ditemukan atau Anda tidak berhak mengubahnya.',
            ], 404);
        }

        $validatedData = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'cashier_name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:100'],
            'shift_name' => ['required', 'string', 'max:100'],
            'opening_cash' => ['required', 'integer', 'min:0'],
            'closing_cash' => ['nullable', 'integer', 'min:0'],
            'note' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['Berjalan', 'Selesai'])],
        ]);

        $user = $request->user();
        if ($user && $user->role !== 'owner') {
            $validatedData['branch_id'] = $user->branch_id;
            $validatedData['cashier_name'] = $shift->cashier_name;
            $validatedData['username'] = $shift->username;
        }

        $shift->update($validatedData);

        return response()->json([
            'success' => true,
            'message' => 'Shift berhasil diperbarui.',
            'data' => $shift->load('branch:id,name,code'),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $shift = Shift::find($id);

        if (!$shift || !$this->canModifyShift($request, $shift)) {
            return response()->json([
                'success' => false,
                'message' => 'Data shift tidak ditemukan atau Anda tidak berhak menghapusnya.',
            ], 404);
        }

        $shift->delete();

        return response()->json([
            'success' => true,
            'message' => 'Shift berhasil dihapus.',
        ]);
    }
}
