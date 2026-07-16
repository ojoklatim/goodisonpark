import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function(req) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { clientIds, messageBody } = await req.json();

    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      throw new Error('clientIds array is required');
    }
    if (!messageBody || typeof messageBody !== 'string') {
      throw new Error('messageBody is required');
    }

    // 1. Initialize Supabase Client with Auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_INSFORGE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_INSFORGE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing database environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 2. Get User Profile and verify role
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profile not found');
    
    if (profile.role !== 'company_admin' && profile.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only company admins can send SMS' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const companyId = profile.company_id;

    // 3. Fetch Company Name for Prefix/SenderID
    const { data: company, error: compError } = await supabaseClient
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();
    
    if (compError) throw compError;
    const prefix = `[${company.name}]: `;
    const fullMessage = prefix + messageBody;

    // 4. Fetch Client Phone Numbers
    const { data: clients, error: clientsError } = await supabaseClient
      .from('clients')
      .select('id, phone')
      .in('id', clientIds)
      .eq('company_id', companyId); // Extra security check

    if (clientsError || !clients || clients.length === 0) {
      throw new Error('No valid clients found');
    }

    // 5. Send SMS via Twilio API
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioFrom = Deno.env.get('TWILIO_FROM_NUMBER') || 'InsForge'; 

    if (!twilioSid || !twilioToken) {
      // Mock mode if Twilio credentials are not set
      console.warn("TWILIO SECRETS NOT SET. Mocking SMS sending...");
      
      const logs = clients.filter(c => c.phone).map(c => ({
        company_id: companyId,
        sender_id: user.id,
        client_id: c.id,
        recipient_phone: c.phone,
        message_body: fullMessage,
        twilio_sid: 'mock_' + Math.random().toString(36).substring(7),
        status: 'sent',
        segments: Math.ceil(fullMessage.length / 160) || 1,
        cost: 0
      }));

      if (logs.length > 0) {
        // Must use service role to bypass RLS for logging, or since they are admins they might pass insert policy.
        await supabaseClient.from('sms_logs').insert(logs);
      }

      return new Response(JSON.stringify({ success: true, mocked: true, count: logs.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Actual Twilio Send Loop (using standard fetch to avoid dependencies)
    const encodedCredentials = btoa(`${twilioSid}:${twilioToken}`);
    let successCount = 0;
    const logsToInsert = [];

    for (const client of clients) {
      if (!client.phone) continue;

      const body = new URLSearchParams({
        To: client.phone,
        From: twilioFrom,
        Body: fullMessage
      });

      try {
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        });

        const result = await response.json();
        
        logsToInsert.push({
          company_id: companyId,
          sender_id: user.id,
          client_id: client.id,
          recipient_phone: client.phone,
          message_body: fullMessage,
          twilio_sid: result.sid || null,
          status: response.ok ? 'sent' : 'failed',
          segments: result.num_segments || Math.ceil(fullMessage.length / 160) || 1,
          cost: parseFloat(result.price || 0)
        });

        if (response.ok) successCount++;
      } catch (err) {
        console.error("Twilio send error for client", client.id, err);
      }
    }

    // Insert Logs
    if (logsToInsert.length > 0) {
      await supabaseClient.from('sms_logs').insert(logsToInsert);
    }

    return new Response(JSON.stringify({ success: true, count: successCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}
