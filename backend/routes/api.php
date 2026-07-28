<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\LoginActivityController;
use App\Http\Controllers\Api\OwnerLoginActivityController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\OwnerSettingController;
use App\Http\Controllers\Api\StockHistoryController;
use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\OwnerDashboardController;
use App\Http\Controllers\Api\OwnerExpenseController;
use App\Http\Controllers\Api\OwnerReportController;
use App\Http\Controllers\Api\OwnerStockController;
use App\Http\Controllers\Api\OwnerUserController;

/*
|--------------------------------------------------------------------------
| AUTH API
|--------------------------------------------------------------------------
*/

Route::get('/health', [\App\Http\Controllers\Api\HealthController::class, 'index']);

Route::post('/login', [AuthController::class, 'login']);
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', function (\Illuminate\Http\Request $request) {
        return response()->json([
            'success' => true,
            'data' => $request->user()->load('branch'),
        ]);
    });

    Route::post('/logout', [AuthController::class, 'logout']);

    // Owner only endpoints
    Route::middleware('role:owner')->group(function () {
        Route::get('/owner/dashboard', [OwnerDashboardController::class, 'index']);
        Route::get('/owner/reports', [OwnerReportController::class, 'index']);
        Route::get('/owner/reports/export', [OwnerReportController::class, 'export']);
        Route::get('/owner/stocks', [OwnerStockController::class, 'index']);
        Route::get('/owner/expenses', [OwnerExpenseController::class, 'index']);
        Route::get('/owner/users', [OwnerUserController::class, 'index']);
        Route::get('/owner/login-activities', [OwnerLoginActivityController::class, 'index']);
        Route::post('/owner/login-activities/{id}/force-logout', [OwnerLoginActivityController::class, 'forceLogout']);
        Route::delete('/owner/login-activities/{id}', [OwnerLoginActivityController::class, 'destroy']);
        Route::get('/owner/settings', [OwnerSettingController::class, 'index']);
        Route::put('/owner/settings', [OwnerSettingController::class, 'update']);
        Route::put('/settings', [SettingController::class, 'update']);
        Route::post('/settings/reset', [SettingController::class, 'reset']);

        Route::get('/login-activities', [LoginActivityController::class, 'index']);
        Route::put('/login-activities/{id}/force-logout', [LoginActivityController::class, 'forceLogout']);
        Route::delete('/login-activities/{id}', [LoginActivityController::class, 'destroy']);

        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/{id}', [UserController::class, 'show']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
    });

    // Admin only endpoints
    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/dashboard', [AdminDashboardController::class, 'index']);
    });

    // Admin and Owner endpoints
    Route::middleware('role:owner,admin')->group(function () {
        Route::post('/products', [ProductController::class, 'store']);
        Route::post('/products/batch-stock', [ProductController::class, 'batchStock']);
        Route::put('/products/{id}', [ProductController::class, 'update']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
        Route::post('/products/{id}/mutate', [ProductController::class, 'mutateStock']);
        Route::post('/products/{id}/restock', [ProductController::class, 'restockWarehouse']);
        Route::post('/products/{id}/adjust', [ProductController::class, 'adjustStock']);
        Route::post('/products/{id}/transfer', [ProductController::class, 'transferStock']);

        Route::get('/stock-histories', [StockHistoryController::class, 'index']);

        Route::post('/expenses', [ExpenseController::class, 'store']);
        Route::put('/expenses/{id}', [ExpenseController::class, 'update']);
        Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy']);


        Route::put('/shifts/{id}', [ShiftController::class, 'update']);
        Route::delete('/shifts/{id}', [ShiftController::class, 'destroy']);
    });

    // Endpoints for Cashier, Admin, Owner (Requires valid token)
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{id}', [ProductController::class, 'show']);

    Route::get('/branches', function () {
        return response()->json([
            'success' => true,
            'data' => \App\Models\Branch::all(),
        ]);
    });

    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::post('/checkout', [TransactionController::class, 'checkout']);

    Route::get('/expenses', [ExpenseController::class, 'index']);
    Route::get('/expenses/{id}', [ExpenseController::class, 'show']);

    Route::get('/shifts', [ShiftController::class, 'index']);
    Route::get('/shifts/active', [ShiftController::class, 'active']);
    Route::get('/shifts/current', [ShiftController::class, 'current']);
    Route::get('/shifts/{id}', [ShiftController::class, 'show']);
    Route::post('/shifts/open', [ShiftController::class, 'open']);
    Route::put('/shifts/{id}/close', [ShiftController::class, 'close']);

    Route::get('/settings', [SettingController::class, 'index']);
});
