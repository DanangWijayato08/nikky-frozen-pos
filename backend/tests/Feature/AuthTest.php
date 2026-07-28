<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

    public function test_login_with_correct_credentials_generates_token()
    {
        $branch = Branch::create([
            'name' => 'Cabang Test',
            'code' => 'TEST-01',
        ]);

        $user = User::factory()->create([
            'username' => 'testuser',
            'password' => Hash::make('password123'),
            'status' => 'Aktif',
            'role' => 'admin',
            'branch_id' => $branch->id,
        ]);

        $response = $this->postJson('/api/login', [
            'username' => 'testuser',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'success',
                     'message',
                     'data' => [
                         'token',
                         'user' => [
                             'id',
                             'username',
                         ],
                     ],
                 ]);

        $this->assertNotEmpty($response->json('data.token'));
    }

    public function test_login_with_wrong_password_returns_error()
    {
        $user = User::factory()->create([
            'username' => 'testuser',
            'password' => Hash::make('password123'),
            'status' => 'Aktif',
        ]);

        $response = $this->postJson('/api/login', [
            'username' => 'testuser',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401)
                 ->assertJson([
                     'success' => false,
                     'message' => 'Username atau password salah.',
                 ]);
    }

    public function test_private_endpoint_without_token_returns_401()
    {
        $response = $this->getJson('/api/me');

        $response->assertStatus(401);
    }

    public function test_private_endpoint_with_valid_token_is_accessible()
    {
        $branch = Branch::create([
            'name' => 'Cabang Test',
            'code' => 'TEST-01',
        ]);

        $user = User::factory()->create([
            'username' => 'testuser',
            'branch_id' => $branch->id,
        ]);
        Sanctum::actingAs($user, ['*']);

        $response = $this->getJson('/api/me');

        $response->assertStatus(200);
    }

    public function test_api_me_returns_logged_in_user()
    {
        $branch = Branch::create([
            'name' => 'Cabang Test',
            'code' => 'TEST-01',
        ]);

        $user = User::factory()->create([
            'username' => 'testuser',
            'branch_id' => $branch->id,
        ]);

        Sanctum::actingAs($user, ['*']);

        $response = $this->getJson('/api/me');

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'data' => [
                         'id' => $user->id,
                         'username' => 'testuser',
                         'branch' => [
                             'id' => $branch->id,
                             'name' => 'Cabang Test',
                         ]
                     ]
                 ]);
    }

    public function test_logout_deletes_current_access_token()
    {
        $branch = Branch::create([
            'name' => 'Cabang Test',
            'code' => 'TEST-01',
        ]);

        $user = User::factory()->create([
            'username' => 'testuser',
            'password' => Hash::make('password123'),
            'status' => 'Aktif',
            'branch_id' => $branch->id,
        ]);

        // Login to get a real token
        $loginResponse = $this->postJson('/api/login', [
            'username' => 'testuser',
            'password' => 'password123',
        ]);

        $token = $loginResponse->json('data.token');

        $this->assertDatabaseCount('personal_access_tokens', 1);

        // Logout
        $logoutResponse = $this->postJson('/api/logout', [], [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $logoutResponse->assertStatus(200);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_logged_out_token_cannot_be_used()
    {
        $branch = Branch::create([
            'name' => 'Cabang Test',
            'code' => 'TEST-01',
        ]);

        $user = User::factory()->create([
            'username' => 'testuser',
            'password' => Hash::make('password123'),
            'status' => 'Aktif',
            'branch_id' => $branch->id,
        ]);

        // Login
        $loginResponse = $this->postJson('/api/login', [
            'username' => 'testuser',
            'password' => 'password123',
        ]);

        $token = $loginResponse->json('data.token');

        // Logout
        $logoutResponse = $this->postJson('/api/logout', [], [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $logoutResponse->assertStatus(200);

        // Clear cached auth guards between requests in testing
        app('auth')->forgetGuards();

        // Access private route again
        $response = $this->getJson('/api/me', [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $response->assertStatus(401);
    }
}
