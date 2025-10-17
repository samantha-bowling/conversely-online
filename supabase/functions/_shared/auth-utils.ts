import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

/**
 * Extracts and validates user from JWT in Edge Function context
 * 
 * CRITICAL: In Edge Functions using SERVICE_ROLE_KEY, getUser() MUST
 * receive the JWT explicitly or it defaults to service context and fails.
 * 
 * @param supabase - Supabase client initialized with SERVICE_ROLE_KEY
 * @param jwt - User's access token from Authorization header
 * @returns User object
 * @throws Error if JWT is invalid or user not found
 */
export async function getUserFromJwt(
  supabase: SupabaseClient,
  jwt: string
) {
  if (!jwt) {
    throw new Error('[getUserFromJwt] Missing JWT - cannot validate user');
  }

  console.log('[getUserFromJwt] Validating JWT...');
  
  const { data, error } = await supabase.auth.getUser(jwt);
  
  if (error) {
    console.error('[getUserFromJwt] JWT validation failed:', error.message);
    throw new Error(`Invalid JWT: ${error.message}`);
  }
  
  if (!data.user) {
    throw new Error('[getUserFromJwt] No user found for provided JWT');
  }
  
  console.log(`[getUserFromJwt] ✓ Validated user ${data.user.id}`);
  return data.user;
}
