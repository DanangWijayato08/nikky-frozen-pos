<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Branch::create([
            'name' => 'Cabang Test',
            'code' => 'TEST-01',
        ]);
    }

    public function test_owner_endpoint_accessible_by_owner()
    {
        $owner = User::factory()->create([
            'username' => 'owneruser',
            'role' => 'owner',
            'branch_id' => 1,
        ]);
        Sanctum::actingAs($owner, ['*']);

        $response = $this->getJson('/api/owner/dashboard');

        // We assert 200 because OwnerDashboardController@index should return 200 for owner
        $response->assertStatus(200);
    }

    public function test_owner_endpoint_returns_403_for_admin()
    {
        $admin = User::factory()->create([
            'username' => 'adminuser',
            'role' => 'admin',
            'branch_id' => 1,
        ]);
        Sanctum::actingAs($admin, ['*']);

        $response = $this->getJson('/api/owner/dashboard');

        $response->assertStatus(403)
                 ->assertJson([
                     'success' => false,
                     'message' => 'Anda tidak memiliki akses ke endpoint ini.'
                 ]);
    }

    public function test_owner_endpoint_returns_403_for_cashier()
    {
        $cashier = User::factory()->create([
            'username' => 'cashieruser',
            'role' => 'cashier',
            'branch_id' => 1,
        ]);
        Sanctum::actingAs($cashier, ['*']);

        $response = $this->getJson('/api/owner/dashboard');

        $response->assertStatus(403);
    }

    public function test_role_protected_endpoint_without_token_returns_401()
    {
        $response = $this->getJson('/api/owner/dashboard');

        $response->assertStatus(401);
    }

    public function test_cashier_can_access_allowed_cashier_endpoint()
    {
        $cashier = User::factory()->create([
            'username' => 'cashieruser',
            'role' => 'cashier',
            'branch_id' => 1,
        ]);
        Sanctum::actingAs($cashier, ['*']);

        // Cashiers are allowed to access /api/products
        $response = $this->getJson('/api/products');

        $response->assertStatus(200);
    }

    public function test_invalid_role_is_rejected()
    {
        // For example, if a user somehow has an invalid role in database
        $user = User::factory()->create([
            'username' => 'invaliduser',
            'role' => 'invalid_role',
            'branch_id' => 1,
        ]);
        Sanctum::actingAs($user, ['*']);

        // Only owner can access owner routes
        $response = $this->getJson('/api/owner/dashboard');
        $response->assertStatus(403);

        // Only admin can access admin routes
        $response = $this->getJson('/api/admin/dashboard');
        $response->assertStatus(403);
    }

    public function test_middleware_uses_authenticated_user_role_not_request_input()
    {
        $cashier = User::factory()->create([
            'username' => 'cashieruser',
            'role' => 'cashier',
            'branch_id' => 1,
        ]);
        Sanctum::actingAs($cashier, ['*']);

        // Malicious cashier tries to pass role=owner in input body to trick middleware
        // But the middleware uses $request->user()->role
        // the owner/dashboard is GET, let's try an owner POST endpoint if available,
        // or just pass it in query params for GET
        $response = $this->getJson('/api/owner/dashboard?role=owner');

        $response->assertStatus(403);
    }
}
