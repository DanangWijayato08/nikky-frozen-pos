<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Product;
use App\Models\Shift;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CheckoutAndStockTest extends TestCase
{
    use RefreshDatabase;

    protected $branchA;
    protected $branchB;
    protected $cashierA;
    protected $adminA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->branchA = Branch::create(['name' => 'Cabang A', 'code' => 'CBA']);
        $this->branchB = Branch::create(['name' => 'Cabang B', 'code' => 'CBB']);

        $this->cashierA = User::factory()->create([
            'name' => 'Cashier A',
            'username' => 'cashier_a',
            'role' => 'cashier',
            'branch_id' => $this->branchA->id,
        ]);

        $this->adminA = User::factory()->create([
            'username' => 'admin_a',
            'role' => 'admin',
            'branch_id' => $this->branchA->id,
        ]);

        Shift::create([
            'branch_id' => $this->branchA->id,
            'username' => 'cashier_a',
            'cashier_name' => 'Cashier A',
            'shift_name' => 'Pagi',
            'opening_cash' => 100000,
            'opened_at' => now(),
            'status' => 'Berjalan'
        ]);
    }

    public function test_checkout_berhasil_membuat_transaction_dan_mengurangi_stok()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 20000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2]
            ]
        ]);

        $response->assertStatus(201);
        $this->assertEquals(48, $product->fresh()->stock);
        $this->assertDatabaseHas('transactions', ['total_item' => 2, 'grand_total' => 20000]);
        $this->assertDatabaseHas('transaction_items', ['product_id' => $product->id, 'quantity' => 2]);
    }

    public function test_harga_palsu_diabaikan()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 20000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2, 'price' => 5000, 'subtotal' => 10000] // palsu
            ]
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('transactions', ['grand_total' => 20000]); // Dihitung ulang jadi 20000
    }

    public function test_checkout_produk_cabang_lain_ditolak()
    {
        $productB = Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'P-B',
            'name' => 'Produk B',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 10000,
            'items' => [
                ['product_id' => $productB->id, 'quantity' => 1]
            ]
        ]);

        $response->assertStatus(404);
    }

    public function test_quantity_nol_atau_negatif_ditolak()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 10000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 0]
            ]
        ]);
        $response->assertStatus(422);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 10000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => -5]
            ]
        ]);
        $response->assertStatus(422);
    }

    public function test_stok_tidak_cukup_ditolak()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 5,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 100000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 10]
            ]
        ]);
        $response->assertStatus(409);
        $this->assertEquals(5, $product->fresh()->stock); // Stok utuh
    }

    public function test_pembayaran_kurang_dari_total_ditolak()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 5000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1]
            ]
        ]);
        $response->assertStatus(422);
        $this->assertStringContainsString('Nominal pembayaran belum mencukupi', $response->json('message'));
    }

    public function test_duplicate_product_id_digabung_secara_aman()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 30000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
                ['product_id' => $product->id, 'quantity' => 2],
            ]
        ]);

        $response->assertStatus(201);
        $this->assertEquals(47, $product->fresh()->stock);
        $this->assertDatabaseHas('transactions', ['total_item' => 3, 'grand_total' => 30000]);
    }

    public function test_jika_satu_item_gagal_seluruh_transaction_rollback()
    {
        $product1 = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        $product2 = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P2',
            'name' => 'Produk 2',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 5, // Stok kurang
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 200000,
            'items' => [
                ['product_id' => $product1->id, 'quantity' => 2],
                ['product_id' => $product2->id, 'quantity' => 10], // Akan gagal
            ]
        ]);

        $response->assertStatus(409);
        // Pastikan tidak ada transaksi
        $this->assertDatabaseMissing('transactions', ['cashier_name' => 'Cashier A']);
        $this->assertDatabaseMissing('transaction_items', ['product_id' => $product1->id]);
        $this->assertDatabaseMissing('stock_histories', ['product_id' => $product1->id, 'type' => 'sale']);
        // Pastikan stok utuh (rollback)
        $this->assertEquals(50, $product1->fresh()->stock);
        $this->assertEquals(5, $product2->fresh()->stock);
    }

    // B. Restock dan adjustment
    public function test_restock_positif_berhasil()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 10,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson("/api/products/{$product->id}/restock", [
            'amount' => 5
        ]);

        $response->assertStatus(200);
        $this->assertEquals(15, $product->fresh()->stock);
        $this->assertDatabaseHas('stock_histories', ['type' => 'restock', 'quantity' => 5]);
    }

    public function test_adjustment_negatif_melebihi_stok_ditolak_karena_min_0()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 10,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson("/api/products/{$product->id}/adjust", [
            'stock' => -5,
            'user_id' => $this->adminA->id,
        ]);

        // Ditolak validation rule min:0
        $response->assertStatus(422);
        $this->assertEquals(10, $product->fresh()->stock);
    }

    // C. Transfer stock
    public function test_transfer_berhasil_mengurangi_stok_sumber_dan_menambah_tujuan()
    {
        $productSource = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
        ]);

        $productTarget = Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'P1-B',
            'name' => 'Produk 1', // Nama harus sama
            'category' => 'Kat 1', // Kategori harus sama
            'price' => 10000,
            'stock' => 10,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson("/api/products/{$productSource->id}/transfer", [
            'target_branch_id' => $this->branchB->id,
            'amount' => 20,
            'user_id' => $this->adminA->id,
        ]);

        $response->assertStatus(200);
        $this->assertEquals(30, $productSource->fresh()->stock);
        $this->assertEquals(30, $productTarget->fresh()->stock);
    }

    public function test_transfer_dengan_stok_tidak_cukup_ditolak()
    {
        $productSource = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 10, // Hanya ada 10
        ]);

        $productTarget = Product::create([
            'branch_id' => $this->branchB->id,
            'code' => 'P1-B',
            'name' => 'Produk 1', // Nama sama
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 10,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson("/api/products/{$productSource->id}/transfer", [
            'target_branch_id' => $this->branchB->id,
            'amount' => 20, // Meminta 20
            'user_id' => $this->adminA->id,
        ]);

        $response->assertStatus(422);
        $this->assertEquals(10, $productSource->fresh()->stock);
        // Pastikan tidak ada histori transfer out jika gagal
        $this->assertDatabaseMissing('stock_histories', [
            'product_id' => $productSource->id,
            'type' => 'transfer_out'
        ]);
    }

    public function test_checkout_tanpa_token_menghasilkan_401()
    {
        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 10000,
            'items' => [
                ['product_id' => 1, 'quantity' => 1]
            ]
        ]);
        $response->assertStatus(401);
    }

    public function test_produk_tidak_aktif_ditolak()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1-IN',
            'name' => 'Produk Tidak Aktif',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Nonaktif' // Tidak aktif
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 10000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1]
            ]
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('tidak aktif', $response->json('message'));
    }

    public function test_cashier_username_branch_palsu_diabaikan()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1-FA',
            'name' => 'Produk A',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']); // Role cashierA ada di branchA

        $response = $this->postJson('/api/checkout', [
            'branch_id' => $this->branchB->id, // Palsu
            'cashier_name' => 'Penyusup', // Palsu
            'username' => 'hacker', // Palsu
            'payment_method' => 'Tunai',
            'paid_amount' => 10000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1]
            ]
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('transactions', [
            'branch_id' => $this->branchA->id, // Kembali ke branchA milik user asli
            'cashier_name' => 'Cashier A',     // Kembali ke nama user asli
            'username' => 'cashier_a'          // Kembali ke username user asli
        ]);
    }

    public function test_restock_nol_atau_negatif_ditolak()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1-RE',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 10,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson("/api/products/{$product->id}/restock", ['amount' => 0]);
        $response->assertStatus(422);

        $response = $this->postJson("/api/products/{$product->id}/restock", ['amount' => -10]);
        $response->assertStatus(422);
    }

    public function test_transfer_nol_atau_negatif_ditolak()
    {
        $productSource = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1-TR',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson("/api/products/{$productSource->id}/transfer", [
            'target_branch_id' => $this->branchB->id,
            'amount' => 0,
            'user_id' => $this->adminA->id,
        ]);
        $response->assertStatus(422);

        $response = $this->postJson("/api/products/{$productSource->id}/transfer", [
            'target_branch_id' => $this->branchB->id,
            'amount' => -5,
            'user_id' => $this->adminA->id,
        ]);
        $response->assertStatus(422);
    }

    public function test_transfer_ke_cabang_sama_ditolak()
    {
        $productSource = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1-SM',
            'name' => 'Produk 1',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
        ]);

        Sanctum::actingAs($this->adminA, ['*']);

        $response = $this->postJson("/api/products/{$productSource->id}/transfer", [
            'target_branch_id' => $this->branchA->id, // Cabang yang sama
            'amount' => 10,
            'user_id' => $this->adminA->id,
        ]);
        $response->assertStatus(422);
    }

    public function test_manipulasi_diskon()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1-DSC',
            'name' => 'Produk D',
            'category' => 'Kat 1',
            'price' => 20000,
            'stock' => 10,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        // Diskon melebihi subtotal
        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 20000,
            'discount' => 30000, // Subtotal 20k, diskon 30k
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1]
            ]
        ]);
        $response->assertStatus(422);

        // Diskon melebihi batas setting (default max_discount = 10%)
        // Subtotal = 20000. 10% = 2000.
        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 20000,
            'discount' => 5000, // Diskon 5k melebihi max 2k
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1]
            ]
        ]);
        $response->assertStatus(422);
        $this->assertStringContainsString('melebihi batas maksimal', $response->json('message'));

        // Diskon normal dalam batas (10% dari 20k = 2000)
        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 20000,
            'discount' => 1500, // Aman
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1]
            ]
        ]);
        $response->assertStatus(201);
        $this->assertDatabaseHas('transactions', ['grand_total' => 18500, 'discount' => 1500]);
    }

    public function test_quantity_pecahan_dan_non_numerik_ditolak()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1-Q',
            'name' => 'Produk Q',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        Sanctum::actingAs($this->cashierA, ['*']);

        // 1. Pecahan (1.5)
        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 20000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1.5]
            ]
        ]);
        $response->assertStatus(422);

        // 2. String ('dua')
        $response = $this->postJson('/api/checkout', [
            'payment_method' => 'Tunai',
            'paid_amount' => 20000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 'dua']
            ]
        ]);
        $response->assertStatus(422);
    }

    public function test_perhitungan_pajak_menggunakan_setting_database()
    {
        $product = Product::create([
            'branch_id' => $this->branchA->id,
            'code' => 'P1-TAX',
            'name' => 'Produk Pajak',
            'category' => 'Kat 1',
            'price' => 10000,
            'stock' => 50,
            'status' => 'Aktif'
        ]);

        // Aktifkan pajak 11% di setting
        \App\Models\Setting::updateOrCreate(
            ['key' => 'receipt_setting'],
            ['value' => ['ppnActive' => true, 'ppnRate' => 11, 'maxDiscount' => 10]]
        );

        Sanctum::actingAs($this->cashierA, ['*']);

        // Kasir sengaja kirim tax_rate palsu, apply_tax true
        $response = $this->postJson('/api/checkout', [
            'apply_tax' => true,
            'tax_rate' => 0, // Akan diabaikan
            'payment_method' => 'Tunai',
            'paid_amount' => 20000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1]
            ]
        ]);

        $response->assertStatus(201);
        // Subtotal = 10000. Tax = 11% dari 10000 = 1100. Grand = 11100.
        $this->assertDatabaseHas('transactions', ['tax' => 1100, 'grand_total' => 11100, 'tax_rate' => 11]);

        // Kasir nonaktifkan pajak lewat flag apply_tax = false (bila diizinkan bisnis)
        $response = $this->postJson('/api/checkout', [
            'apply_tax' => false, // Pajak dimatikan untuk transaksi ini
            'payment_method' => 'Tunai',
            'paid_amount' => 20000,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1]
            ]
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('transactions', ['tax' => 0, 'grand_total' => 10000, 'tax_rate' => 0]);
    }
}
