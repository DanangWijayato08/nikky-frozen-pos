<?php

namespace Tests\Feature;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class TransactionTimezoneTest extends TestCase
{
    use RefreshDatabase;

    public function test_transaction_timezone_filter()
    {
        $owner = User::factory()->create(['role' => 'owner', 'username' => 'owner_test']);
        \App\Models\Branch::create(['id' => 1, 'name' => 'Test Branch', 'code' => 'TB-1']);

        // Transaksi 1: 2026-07-28 20:03:00 UTC (Ini sama dengan 2026-07-29 03:03:00 WIB)
        Transaction::create([
            'branch_id' => 1,
            'invoice_number' => 'INV-01',
            'cashier_name' => 'Cashier',
            'username' => 'cashier',
            'shift_name' => 'Pagi',
            'total_item' => 1,
            'subtotal' => 100,
            'discount' => 0,
            'tax' => 0,
            'tax_rate' => 0,
            'grand_total' => 100,
            'payment_method' => 'Tunai',
            'paid_amount' => 100,
            'change_amount' => 0,
            'status' => 'Berhasil',
            'transaction_date' => Carbon::createFromFormat('Y-m-d H:i:s', '2026-07-28 20:03:00', 'UTC'),
            'created_at' => Carbon::createFromFormat('Y-m-d H:i:s', '2026-07-28 20:03:00', 'UTC'),
        ]);

        // Transaksi 2: 2026-07-28 05:00:00 UTC (Ini sama dengan 2026-07-28 12:00:00 WIB)
        Transaction::create([
            'branch_id' => 1,
            'invoice_number' => 'INV-02',
            'cashier_name' => 'Cashier',
            'username' => 'cashier',
            'shift_name' => 'Pagi',
            'total_item' => 1,
            'subtotal' => 100,
            'discount' => 0,
            'tax' => 0,
            'tax_rate' => 0,
            'grand_total' => 100,
            'payment_method' => 'Tunai',
            'paid_amount' => 100,
            'change_amount' => 0,
            'status' => 'Berhasil',
            'transaction_date' => Carbon::createFromFormat('Y-m-d H:i:s', '2026-07-28 05:00:00', 'UTC'),
            'created_at' => Carbon::createFromFormat('Y-m-d H:i:s', '2026-07-28 05:00:00', 'UTC'),
        ]);

        // Test filter 2026-07-28 (Lokal WIB)
        // Harusnya hanya mendapat Transaksi 2
        $response28 = $this->actingAs($owner, 'sanctum')->getJson('/api/transactions?date=2026-07-28');
        $response28->assertStatus(200);
        
        $data28 = $response28->json('data.transactions');
        $this->assertCount(1, $data28);
        $this->assertEquals('2026-07-28T05:00:00.000000Z', $data28[0]['transaction_date']);

        // Test filter 2026-07-29 (Lokal WIB)
        // Harusnya mendapat Transaksi 1
        $response29 = $this->actingAs($owner, 'sanctum')->getJson('/api/transactions?date=2026-07-29');
        $response29->assertStatus(200);
        
        $data29 = $response29->json('data.transactions');
        $this->assertCount(1, $data29);
        $this->assertEquals('2026-07-28T20:03:00.000000Z', $data29[0]['transaction_date']);
    }
}
