import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // FIX 4: Verify JWT — extract caller identity from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser()
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use JWT-verified identity — never trust body for user_id/email
    const user_id = callerUser.id
    const email = callerUser.email || ''
    const { full_name } = await req.json()

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if user record already exists (idempotency)
    const { data: existing } = await adminClient.from('users').select('id').eq('id', user_id).single()
    if (existing) {
      return new Response(JSON.stringify({ ok: true, message: 'already exists' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create organization
    const orgName = full_name ? `${full_name}'s Organization` : `${email}'s Organization`
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .insert({ name: orgName })
      .select()
      .single()

    if (orgError) throw orgError

    // Create user profile
    const { error: userError } = await adminClient.from('users').insert({
      id: user_id,
      email,
      full_name: full_name || '',
      org_id: org.id,
      role: 'admin',
      user_level: 'standard',
    })

    if (userError) throw userError

    return new Response(JSON.stringify({ ok: true, org_id: org.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // FIX 5: Log full error server-side, return generic message to client
    console.error('handle-signup error:', err)
    return new Response(
      JSON.stringify({ error: 'Signup processing failed. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
