<?php

namespace App\Traits;

use Illuminate\Http\Request;

trait ChecksBranchIsolation
{
    /**
     * Get the effective branch ID for the query.
     * Returns user's branch for non-owners.
     * For owners, returns requested branch_id if provided, else null.
     */
    protected function getFilteredBranchId(Request $request)
    {
        $user = $request->user();
        if ($user && $user->role !== 'owner') {
            return $user->branch_id;
        }
        return $request->branch_id ?? null;
    }

    /**
     * Get the forced branch ID for writes/creates.
     * For non-owners, this forces the branch to be their own.
     * For owners, it trusts the request data.
     */
    protected function getForcedBranchId(Request $request)
    {
        $user = $request->user();
        if ($user && $user->role !== 'owner') {
            return $user->branch_id;
        }
        return $request->branch_id;
    }

    /**
     * Ensure the resource's branch_id matches the user's branch_id (if not owner).
     * Call this before updating or deleting a resource.
     * Returns true if authorized, false otherwise.
     */
    protected function authorizeBranchAccess(Request $request, $resourceBranchId)
    {
        $user = $request->user();
        if ($user && $user->role !== 'owner') {
            return $user->branch_id == $resourceBranchId;
        }
        return true;
    }
}
