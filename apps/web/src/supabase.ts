import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const usesSupabase = Boolean(url && publishableKey)
export const supabase = createClient(
  url || 'https://not-configured.invalid',
  publishableKey || 'not-configured',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
)

type Row = Record<string, any>

const nullable = (value: unknown) => value === '' || value === undefined ? null : value
const parseBody = (options?: RequestInit) => options?.body ? JSON.parse(String(options.body)) as Record<string, any> : {}

function fail(error: { code?: string; message: string } | null): never {
  if (error?.code === '23505') throw new Error('Запись с такими данными уже существует')
  if (error?.code === '23503') throw new Error('Запись используется в связанных данных')
  throw new Error(error?.message || 'Не удалось выполнить запрос к Supabase')
}

const helperDto = (row: Row) => ({
  id: row.id, fullName: row.full_name, phone: row.phone, comment: row.comment,
  isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at,
})

const orderDto = (row: Row, participants: Row[] = []) => {
  const own = participants.filter(item => item.work_order_id === row.id)
  return {
    id: row.id, number: row.number, startsOn: row.starts_on, endsOn: row.ends_on,
    eventName: row.event_name, venue: row.venue, filledByName: row.filled_by_name,
    transport: row.transport, lightAmount: row.light_amount, soundAmount: row.sound_amount,
    structuresAmount: row.structures_amount, totalAmount: row.total_amount, status: row.status,
    comment: row.comment, participantCount: own.length,
    payrollTotal: own.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
  }
}

const participantDto = (row: Row, helperName: unknown) => ({
  id: row.id, helperId: row.helper_id, fullName: helperName,
  loading: row.loading, loadingAmount: row.loading_amount,
  unloading: row.unloading, unloadingAmount: row.unloading_amount,
  installation: row.installation, installationAmount: row.installation_amount,
  dismantling: row.dismantling, dismantlingAmount: row.dismantling_amount,
  flatRate: row.flat_rate, flatRateAmount: row.flat_rate_amount,
  totalAmount: row.total_amount, comment: row.comment,
})

async function findOrder(id: string) {
  const [orderResult, participantsResult, helpersResult] = await Promise.all([
    supabase.from('work_orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('work_order_helpers').select('*').eq('work_order_id', id).order('created_at'),
    supabase.from('helpers').select('id,full_name'),
  ])
  if (orderResult.error) fail(orderResult.error)
  if (participantsResult.error) fail(participantsResult.error)
  if (helpersResult.error) fail(helpersResult.error)
  if (!orderResult.data) return null
  const names = new Map((helpersResult.data || []).map(item => [item.id, item.full_name]))
  const participants = participantsResult.data || []
  return {
    ...orderDto(orderResult.data, participants),
    participants: participants.map(item => participantDto(item, names.get(item.helper_id))),
  }
}

const orderPayload = (body: Record<string, any>) => ({
  number: body.number, starts_on: body.startsOn, ends_on: body.endsOn,
  event_name: nullable(body.eventName), venue: nullable(body.venue), filled_by_name: body.filledByName,
  transport: nullable(body.transport), light_amount: nullable(body.lightAmount),
  sound_amount: nullable(body.soundAmount), structures_amount: nullable(body.structuresAmount),
  status: body.status || 'draft', comment: nullable(body.comment), updated_at: new Date().toISOString(),
})

const participantPayload = (orderId: string, body: Record<string, any>) => ({
  work_order_id: orderId, helper_id: body.helperId,
  loading: Boolean(body.loading), loading_amount: body.loading ? nullable(body.loadingAmount) : null,
  unloading: Boolean(body.unloading), unloading_amount: body.unloading ? nullable(body.unloadingAmount) : null,
  installation: Boolean(body.installation), installation_amount: body.installation ? nullable(body.installationAmount) : null,
  dismantling: Boolean(body.dismantling), dismantling_amount: body.dismantling ? nullable(body.dismantlingAmount) : null,
  flat_rate: Boolean(body.flatRate), flat_rate_amount: body.flatRate ? nullable(body.flatRateAmount) : null,
  comment: nullable(body.comment), updated_at: new Date().toISOString(),
})

export async function supabaseApi<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method || 'GET'
  const body = parseBody(options)

  if (path === '/helpers' && method === 'GET') {
    const result = await supabase.from('helpers').select('*').order('is_active', { ascending: false }).order('full_name')
    if (result.error) fail(result.error)
    return (result.data || []).map(helperDto) as T
  }
  if (path === '/helpers' && method === 'POST') {
    const result = await supabase.from('helpers').insert({ full_name: body.fullName, phone: nullable(body.phone), comment: nullable(body.comment) }).select('*').single()
    if (result.error) fail(result.error)
    return helperDto(result.data) as T
  }

  const helperMatch = path.match(/^\/helpers\/([^/]+)$/)
  if (helperMatch && method === 'PATCH') {
    const patch: Row = { updated_at: new Date().toISOString() }
    if ('fullName' in body) patch.full_name = body.fullName
    if ('phone' in body) patch.phone = nullable(body.phone)
    if ('comment' in body) patch.comment = nullable(body.comment)
    if ('isActive' in body) patch.is_active = body.isActive
    const result = await supabase.from('helpers').update(patch).eq('id', helperMatch[1]).select('*').single()
    if (result.error) fail(result.error)
    return helperDto(result.data) as T
  }
  if (helperMatch && method === 'DELETE') {
    const result = await supabase.from('helpers').delete().eq('id', helperMatch[1])
    if (result.error) fail(result.error)
    return { id: helperMatch[1] } as T
  }

  if (path === '/work-orders' && method === 'GET') {
    const [ordersResult, participantsResult] = await Promise.all([
      supabase.from('work_orders').select('*').order('starts_on', { ascending: false }).order('number', { ascending: false }),
      supabase.from('work_order_helpers').select('work_order_id,total_amount'),
    ])
    if (ordersResult.error) fail(ordersResult.error)
    if (participantsResult.error) fail(participantsResult.error)
    return (ordersResult.data || []).map(item => orderDto(item, participantsResult.data || [])) as T
  }
  if (path === '/work-orders' && method === 'POST') {
    const result = await supabase.from('work_orders').insert(orderPayload(body)).select('id').single()
    if (result.error) fail(result.error)
    return await findOrder(result.data.id) as T
  }

  const participantMatch = path.match(/^\/work-orders\/([^/]+)\/participant\/([^/]+)$/)
  if (participantMatch && method === 'DELETE') {
    const result = await supabase.from('work_order_helpers').delete().eq('work_order_id', participantMatch[1]).eq('helper_id', participantMatch[2])
    if (result.error) fail(result.error)
    return await findOrder(participantMatch[1]) as T
  }

  const upsertMatch = path.match(/^\/work-orders\/([^/]+)\/participant$/)
  if (upsertMatch && method === 'PUT') {
    const result = await supabase.from('work_order_helpers').upsert(participantPayload(upsertMatch[1], body), { onConflict: 'work_order_id,helper_id' })
    if (result.error) fail(result.error)
    return await findOrder(upsertMatch[1]) as T
  }

  const orderMatch = path.match(/^\/work-orders\/([^/]+)$/)
  if (orderMatch && method === 'GET') {
    const order = await findOrder(orderMatch[1])
    if (!order) throw new Error('Заказ-наряд не найден')
    return order as T
  }
  if (orderMatch && method === 'PATCH') {
    const result = await supabase.from('work_orders').update(orderPayload(body)).eq('id', orderMatch[1])
    if (result.error) fail(result.error)
    return await findOrder(orderMatch[1]) as T
  }
  if (orderMatch && method === 'DELETE') {
    const result = await supabase.from('work_orders').delete().eq('id', orderMatch[1])
    if (result.error) fail(result.error)
    return { id: orderMatch[1] } as T
  }

  if (path === '/calculations' && method === 'GET') {
    const [helpersResult, ordersResult, participantsResult] = await Promise.all([
      supabase.from('helpers').select('id,full_name').order('full_name'),
      supabase.from('work_orders').select('id,number,event_name,venue,starts_on,ends_on'),
      supabase.from('work_order_helpers').select('*'),
    ])
    if (helpersResult.error) fail(helpersResult.error)
    if (ordersResult.error) fail(ordersResult.error)
    if (participantsResult.error) fail(participantsResult.error)
    const orderMap = new Map((ordersResult.data || []).map(item => [item.id, item]))
    return (helpersResult.data || []).map(helper => {
      const work = (participantsResult.data || []).filter(item => item.helper_id === helper.id)
      return {
        id: helper.id, fullName: helper.full_name, orderCount: work.length,
        totalAmount: work.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
        orders: work.map(item => {
          const order = orderMap.get(item.work_order_id) || {} as Row
          return {
            ...participantDto(item, helper.full_name), orderId: order.id, orderNumber: order.number,
            eventName: order.event_name, venue: order.venue, startsOn: order.starts_on, endsOn: order.ends_on,
          }
        }),
      }
    }) as T
  }

  throw new Error('Неизвестный запрос')
}
