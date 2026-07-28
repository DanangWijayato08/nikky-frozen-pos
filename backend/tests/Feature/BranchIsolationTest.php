<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Expense;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BranchIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected $branchA;
    protected $branchB;
    protected $adminA;
    protected $adminB;
    protected $cashierA;
    protected $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->branchA = Branch::create(['name' => 'Cabang A', 'code' => 'CBA']);
        $this->branchB = Branch::create(['name' => 'Cabang B', 'code' => 'CBB']);

        $this->owner = User::factory()->create([
            'username' => 'owner',
            'role' => 'owner',
            'branch_id' => $this->branchA->id,
        ]);

        $this->adminA = User::factory()->create([
            'username' => 'admin_a',
            'role' => 'admin',
            'branch_id' => $this->branchA->id,
        ]);

        $this->adminB = User::factory()->create([
            'username' => 'admin_b',
            'role' => 'admin',
            'branch_id' => $this->branchB->id,
        ]);

        $this->cashierA = User::factory()->create([
            'username' => 'cashier_a',
            'name' => 'Cashier A',
            'role' => 'cashier',
            'branch_id' => $this->branchA->id,
        ]);
    }

    public function test_admin_cabang_a_hanya_melihat_produk_cabang_a()
    {
        Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'PRD-A',
            'name' => 'Produk A',
            'category' => 'Makanan',
            'price' => 10000,
            'stock' => 10,
        ]);
        Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'PRD-B',
            'name' => 'Produk B',
            'category' => 'Minuman',
            'price' => 5000,
            'stock' => 5,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->getJson('/api/products');
        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Produk A', $data[0]['name']);
    }

    public function test_admin_cabang_a_tidak_dapat_melihat_detail_produk_cabang_b()
    {
        $productB = Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'PRD-B',
            'name' => 'Produk B',
            'category' => 'Minuman',
            'price' => 5000,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->getJson("/api/products/{$productB->id}");
        $response->assertStatus(404);
    }

    public function test_admin_cabang_a_tidak_dapat_mengubah_atau_menghapus_produk_cabang_b()
    {
        $productB = Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'PRD-B',
            'name' => 'Produk B',
            'category' => 'Minuman',
            'price' => 5000,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $responseUpdate = $this->putJson("/api/products/{$productB->id}", [
            'branch_id' => $this->branchB->id,
            'code' => 'PRD-B2',
            'name' => 'Produk B2',
            'category' => 'Minuman',
            'price' => 6000,
        ]);
        $responseUpdate->assertStatus(403);

        $responseDelete = $this->deleteJson("/api/products/{$productB->id}");
        $responseDelete->assertStatus(403);
    }

    public function test_input_branch_id_cabang_b_saat_admin_membuat_produk_dipaksa_menjadi_cabang_a()
    {
        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson('/api/products', [
            'branch_id' => $this->branchB->id, // Attempt to create for branch B
            'code' => 'PRD-NEW',
            'name' => 'Produk Baru',
            'category' => 'Makanan',
            'price' => 15000,
            'stock' => 10,
        ]);

        $response->assertStatus(201);
        $this->assertEquals($this->branchA->id, $response->json('data.branch_id'));
    }

    public function test_cashier_cabang_a_tidak_dapat_checkout_produk_cabang_b()
    {
        $productB = Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'PRD-B',
            'name' => 'Produk B',
            'category' => 'Minuman',
            'price' => 5000,
            'stock' => 100,
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        // Buka shift untuk cashier A
        Shift::create([
            'branch_id' => $this->branchA->id,
            'username' => 'cashier_a',
            'cashier_name' => 'Cashier A',
            'shift_name' => 'Pagi',
            'opening_cash' => 100000,
            'opened_at' => now(),
            'status' => 'Berjalan'
        ]);

        $response = $this->postJson('/api/checkout', [
            'branch_id' => $this->branchB->id, // Trying to checkout as branch B
            'cashier_name' => 'Cashier B',
            'username' => 'cashier_b',
            'payment_method' => 'Tunai',
            'paid_amount' => 10000,
            'items' => [
                [
                    'product_id' => $productB->id,
                    'quantity' => 1,
                ]
            ]
        ]);

        // Karena branch_id dipaksa menjadi branchA (milik cashierA), produk cabang B tidak akan ditemukan
        $response->assertStatus(404);
        $this->assertStringContainsString('tidak ditemukan pada cabang ini', $response->json('message'));
    }

    public function test_cashier_cabang_a_tidak_dapat_melihat_transaksi_cabang_b()
    {
        Transaction::create([
            'branch_id' => $this->branchA->id,
            'invoice_number' => 'INV-001',
            'cashier_name' => 'Cashier A',
            'username' => 'cashier_a',
            'total_item' => 1,
            'subtotal' => 5000,
            'grand_total' => 5000,
            'payment_method' => 'Tunai',
            'paid_amount' => 5000,
            'status' => 'Berhasil',
            'transaction_date' => now()
        ]);

        Transaction::create([
            'branch_id' => $this->branchB->id,
            'invoice_number' => 'INV-002',
            'cashier_name' => 'Cashier B',
            'username' => 'cashier_b',
            'total_item' => 1,
            'subtotal' => 5000,
            'grand_total' => 5000,
            'payment_method' => 'Tunai',
            'paid_amount' => 5000,
            'status' => 'Berhasil',
            'transaction_date' => now()
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->getJson('/api/transactions');
        $response->assertStatus(200);

        $data = $response->json('data.transactions');
        $this->assertCount(1, $data);
        $this->assertEquals($this->branchA->id, $data[0]['branch_id']);
    }

    public function test_cashier_cabang_a_tidak_dapat_melihat_expense_cabang_b()
    {
        Expense::create([
            'branch_id' => $this->branchA->id,
            'expense_date' => now(),
            'category' => 'Operasional',
            'description' => 'Listrik A',
            'amount' => 50000,
        ]);
        Expense::create([
            'branch_id' => $this->branchB->id,
            'expense_date' => now(),
            'category' => 'Operasional',
            'description' => 'Listrik B',
            'amount' => 50000,
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->getJson('/api/expenses');
        $response->assertStatus(200);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Listrik A', $data[0]['description']);
    }

    public function test_cashier_tidak_dapat_menutup_shift_milik_user_atau_cabang_lain()
    {
        $shiftB = Shift::create([
            'branch_id' => $this->branchB->id,
            'username' => 'cashier_b',
            'cashier_name' => 'Cashier B',
            'shift_name' => 'Pagi',
            'opening_cash' => 100000,
            'opened_at' => now(),
            'status' => 'Berjalan'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->putJson("/api/shifts/{$shiftB->id}/close", [
            'closing_cash' => 100000,
        ]);

        $response->assertStatus(404);
    }

    public function test_admin_tidak_dapat_melakukan_stock_adjustment_pada_cabang_lain()
    {
        $productB = Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'PRD-B',
            'name' => 'Produk B',
            'category' => 'Minuman',
            'price' => 5000,
            'stock' => 5,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson("/api/products/{$productB->id}/adjust", [
            'stock' => 10,
            'user_id' => $this->adminA->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_admin_tidak_dapat_mentransfer_stok_dari_cabang_lain()
    {
        $productB = Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'PRD-B',
            'name' => 'Produk B',
            'category' => 'Minuman',
            'price' => 5000,
            'stock' => 50,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson("/api/products/{$productB->id}/transfer", [
            'target_branch_id' => $this->branchA->id,
            'amount' => 10,
            'user_id' => $this->adminA->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_owner_tetap_dapat_mengakses_data_lintas_cabang()
    {
        Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'PRD-B',
            'name' => 'Produk B',
            'category' => 'Minuman',
            'price' => 5000,
            'stock' => 50,
        ]);

        Sanctum::actingAs($this->owner, ['*']);

        // Owner can view product in branch B
        $response = $this->getJson('/api/products?branch_id=' . $this->branchB->id);
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));

        // Owner can access owner reports which might hit AdminDashboardController logic as well depending on implementation
        // But for isolation tests, let's test AdminDashboard via owner
        $responseDashboard = $this->getJson('/api/owner/dashboard');
        $responseDashboard->assertStatus(200);
    }

    public function test_manipulasi_branch_id_dari_query_tidak_dapat_melewati_pembatasan()
    {
        Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'PRD-B',
            'name' => 'Produk B',
            'category' => 'Minuman',
            'price' => 5000,
            'stock' => 50,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->getJson('/api/products?branch_id=' . $this->branchB->id);
        $response->assertStatus(200);

        // Akan di-override oleh trait menjadi branchA, sehingga kosong
        $data = $response->json('data');
        $this->assertCount(0, $data);
    }
}
