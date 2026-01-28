// Web Push using @negrel/webpush
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { 
  ApplicationServer, 
  generateVapidKeys,
  exportVapidKeys,
  importVapidKeys
} from 'jsr:@negrel/webpush@0.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('[push-dispatch] v18 - Function invoked')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get VAPID keys in JWK format
    const vapidKeysJson = Deno.env.get('VAPID_KEYS_JWK')
    
    let appServer: ApplicationServer
    let newKeysGenerated = false

    if (vapidKeysJson) {
      console.log('[push-dispatch] Loading VAPID keys from JWK')
      const exportedKeys = JSON.parse(vapidKeysJson)
      const vapidKeys = await importVapidKeys(exportedKeys)
      appServer = await ApplicationServer.new({
        contactInformation: 'mailto:admin@nomadsync.app',
        vapidKeys,
      })
    } else {
      console.log('[push-dispatch] VAPID_KEYS_JWK not found, generating new keys...')
      const vapidKeys = await generateVapidKeys()
      const exportedKeys = await exportVapidKeys(vapidKeys)
      
      // Log the keys for saving
      console.log('[push-dispatch] === SAVE THESE VAPID KEYS ===')
      console.log('[push-dispatch] VAPID_KEYS_JWK:')
      console.log(JSON.stringify(exportedKeys))
      
      appServer = await ApplicationServer.new({
        contactInformation: 'mailto:admin@nomadsync.app',
        vapidKeys,
      })
      
      // Get public key for frontend
      const publicKeyRaw = await appServer.getVapidPublicKeyRaw()
      const publicKeyB64 = btoa(String.fromCharCode(...publicKeyRaw))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      console.log('[push-dispatch] VITE_VAPID_PUBLIC_KEY:', publicKeyB64)
      console.log('[push-dispatch] === END VAPID KEYS ===')
      newKeysGenerated = true
    }

    console.log('[push-dispatch] ApplicationServer ready')

    const payload = await req.json()
    console.log('[push-dispatch] Payload:', JSON.stringify(payload).substring(0, 200))

    let userIds: string[] = []
    let notificationData = {
      title: 'NomadSync Update',
      body: 'New activity in your mission.',
      url: '/',
      tag: 'general'
    }

    if (payload.type === 'INSERT' && payload.table === 'itinerary_items') {
      const record = payload.record
      const tripId = record.trip_id
      const creatorId = record.created_by
      console.log(`[push-dispatch] New Item: ${record.title}`)
      const { data: members } = await supabaseClient.from('trip_members').select('user_id').eq('trip_id', tripId)
      userIds = (members || []).map((m: any) => m.user_id).filter((uid: string) => uid !== creatorId)
      notificationData.title = 'New Mission Intel'
      notificationData.body = `New ${record.type}: ${record.title}`
      notificationData.url = `/trip/${tripId}`
      notificationData.tag = `trip-${tripId}`
    } else if (payload.type === 'INSERT' && payload.table === 'trip_members') {
      const record = payload.record
      const tripId = record.trip_id
      const newUserId = record.user_id
      const { data: trip } = await supabaseClient.from('trips').select('name').eq('id', tripId).single()
      userIds = [newUserId]
      notificationData.title = 'Mission Invite'
      notificationData.body = `You have been drafted for: ${trip?.name || 'a mission'}`
      notificationData.url = `/trip/${tripId}`
      notificationData.tag = `invite-${tripId}`
    }

    console.log(`[push-dispatch] Target users: ${userIds.length}`)

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ message: 'No target users' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: devices } = await supabaseClient.from('user_devices').select('device_id, subscription').in('user_id', userIds)
    console.log(`[push-dispatch] Devices found: ${devices?.length || 0}`)

    if (!devices || devices.length === 0) {
      return new Response(JSON.stringify({ message: 'No devices registered' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Send notifications
    const results = await Promise.allSettled(devices.map(async (device: any) => {
      try {
        console.log(`[push-dispatch] Sending to: ${device.device_id}`)
        
        const subscriber = appServer.subscribe({
          endpoint: device.subscription.endpoint,
          keys: {
            p256dh: device.subscription.keys.p256dh,
            auth: device.subscription.keys.auth,
          }
        })
        
        await subscriber.pushTextMessage(
          JSON.stringify(notificationData),
          { ttl: 86400 }
        )
        
        console.log(`[push-dispatch] Success: ${device.device_id}`)
        return { status: 'sent', deviceId: device.device_id }
      } catch (err: any) {
        console.error(`[push-dispatch] Failed ${device.device_id}:`, err.message || err)
        
        // Clean up expired subscriptions
        if (err.isGone?.() || String(err).includes('410') || String(err).includes('gone')) {
          await supabaseClient.from('user_devices').delete().eq('device_id', device.device_id)
          return { status: 'expired', deviceId: device.device_id }
        }
        
        return { status: 'error', deviceId: device.device_id, error: err.message }
      }
    }))

    const sent = results.filter((r: any) => r.status === 'fulfilled' && r.value?.status === 'sent').length
    console.log(`[push-dispatch] Complete: ${sent}/${results.length} sent`)
    
    return new Response(JSON.stringify({ 
      success: true, 
      sent,
      total: results.length,
      newKeysGenerated
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('[push-dispatch] Error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
