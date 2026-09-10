interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  ASSETS: { fetch(request: Request): Promise<Response> }
}

type Row = Record<string, unknown>

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
})

const parseBody = async (request: Request) => request.json() as Promise<Record<string, unknown>>
const nullable = (value: unknown) => value === '' || value === undefined ? null : value

async function supabase<T>(env: Env, path: string, init: RequestInit = {}, prefer?: string): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(prefer ? { prefer } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { code?: string; message?: string }
    if (error.code === '23505') throw new Error('CONFLICT')
    if (error.code === '23503') throw new Error('REFERENCE')
    throw new Error(error.message || `Supabase: ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
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

async function findOrder(env: Env, id: string) {
  const [orders, participants, helpers] = await Promise.all([
    supabase<Row[]>(env, `work_orders?id=eq.${encodeURIComponent(id)}&select=*`),
    supabase<Row[]>(env, `work_order_helpers?work_order_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`),
    supabase<Row[]>(env, 'helpers?select=id,full_name'),
  ])
  if (!orders.length) return null
  const names = new Map(helpers.map(item => [item.id, item.full_name]))
  return {
    ...orderDto(orders[0], participants),
    participants: participants.map(item => participantDto(item, names.get(item.helper_id))),
  }
}

const orderPayload = (body: Record<string, unknown>) => ({
  number: body.number, starts_on: body.startsOn, ends_on: body.endsOn,
  event_name: nullable(body.eventName), venue: nullable(body.venue), filled_by_name: body.filledByName,
  transport: nullable(body.transport), light_amount: nullable(body.lightAmount),
  sound_amount: nullable(body.soundAmount), structures_amount: nullable(body.structuresAmount),
  status: body.status || 'draft', comment: nullable(body.comment), updated_at: new Date().toISOString(),
})

const participantPayload = (orderId: string, body: Record<string, unknown>) => ({
  work_order_id: orderId, helper_id: body.helperId,
  loading: Boolean(body.loading), loading_amount: body.loading ? nullable(body.loadingAmount) : null,
  unloading: Boolean(body.unloading), unloading_amount: body.unloading ? nullable(body.unloadingAmount) : null,
  installation: Boolean(body.installation), installation_amount: body.installation ? nullable(body.installationAmount) : null,
  dismantling: Boolean(body.dismantling), dismantling_amount: body.dismantling ? nullable(body.dismantlingAmount) : null,
  flat_rate: Boolean(body.flatRate), flat_rate_amount: body.flatRate ? nullable(body.flatRateAmount) : null,
  comment: nullable(body.comment), updated_at: new Date().toISOString(),
})

async function handleApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url)
  const path = url.pathname

  if (path === '/health' && request.method === 'GET') {
    await supabase<Row[]>(env, 'app_metadata?select=key&limit=1')
    return json({ status: 'ok', database: 'up', provider: 'supabase' })
  }

  if (path === '/helpers' && request.method === 'GET') {
    const rows = await supabase<Row[]>(env, 'helpers?select=*&order=is_active.desc,full_name.asc')
    return json(rows.map(helperDto))
  }
  if (path === '/helpers' && request.method === 'POST') {
    const body = await parseBody(request)
    const rows = await supabase<Row[]>(env, 'helpers', { method: 'POST', body: JSON.stringify({ full_name: body.fullName, phone: nullable(body.phone), comment: nullable(body.comment) }) }, 'return=representation')
    return json(helperDto(rows[0]), 201)
  }
  const helperMatch = path.match(/^\/helpers\/([^/]+)$/)
  if (helperMatch && request.method === 'PATCH') {
    const body = await parseBody(request)
    const patch: Row = { updated_at: new Date().toISOString() }
    if ('fullName' in body) patch.full_name = body.fullName
    if ('phone' in body) patch.phone = nullable(body.phone)
    if ('comment' in body) patch.comment = nullable(body.comment)
    if ('isActive' in body) patch.is_active = body.isActive
    const rows = await supabase<Row[]>(env, `helpers?id=eq.${encodeURIComponent(helperMatch[1])}`, { method: 'PATCH', body: JSON.stringify(patch) }, 'return=representation')
    if (!rows.length) return json({ message: 'Хелпер не найден' }, 404)
    return json(helperDto(rows[0]))
  }
  if (helperMatch && request.method === 'DELETE') {
    await supabase(env, `helpers?id=eq.${encodeURIComponent(helperMatch[1])}`, { method: 'DELETE' }, 'return=minimal')
    return json({ id: helperMatch[1] })
  }

  if (path === '/work-orders' && request.method === 'GET') {
    const [orders, participants] = await Promise.all([
      supabase<Row[]>(env, 'work_orders?select=*&order=starts_on.desc,number.desc'),
      supabase<Row[]>(env, 'work_order_helpers?select=work_order_id,total_amount'),
    ])
    return json(orders.map(item => orderDto(item, participants)))
  }
  if (path === '/work-orders' && request.method === 'POST') {
    const body = await parseBody(request)
    const rows = await supabase<Row[]>(env, 'work_orders', { method: 'POST', body: JSON.stringify(orderPayload(body)) }, 'return=representation')
    return json(await findOrder(env, String(rows[0].id)), 201)
  }
  const participantMatch = path.match(/^\/work-orders\/([^/]+)\/participant\/([^/]+)$/)
  if (participantMatch && request.method === 'DELETE') {
    await supabase(env, `work_order_helpers?work_order_id=eq.${encodeURIComponent(participantMatch[1])}&helper_id=eq.${encodeURIComponent(participantMatch[2])}`, { method: 'DELETE' }, 'return=minimal')
    return json(await findOrder(env, participantMatch[1]))
  }
  const upsertMatch = path.match(/^\/work-orders\/([^/]+)\/participant$/)
  if (upsertMatch && request.method === 'PUT') {
    const body = await parseBody(request)
    await supabase(env, 'work_order_helpers?on_conflict=work_order_id,helper_id', { method: 'POST', body: JSON.stringify(participantPayload(upsertMatch[1], body)) }, 'resolution=merge-duplicates,return=minimal')
    return json(await findOrder(env, upsertMatch[1]))
  }
  const orderMatch = path.match(/^\/work-orders\/([^/]+)$/)
  if (orderMatch && request.method === 'GET') {
    const order = await findOrder(env, orderMatch[1])
    return order ? json(order) : json({ message: 'Заказ-наряд не найден' }, 404)
  }
  if (orderMatch && request.method === 'PATCH') {
    const body = await parseBody(request)
    const rows = await supabase<Row[]>(env, `work_orders?id=eq.${encodeURIComponent(orderMatch[1])}`, { method: 'PATCH', body: JSON.stringify(orderPayload(body)) }, 'return=representation')
    if (!rows.length) return json({ message: 'Заказ-наряд не найден' }, 404)
    return json(await findOrder(env, orderMatch[1]))
  }
  if (orderMatch && request.method === 'DELETE') {
    await supabase(env, `work_orders?id=eq.${encodeURIComponent(orderMatch[1])}`, { method: 'DELETE' }, 'return=minimal')
    return json({ id: orderMatch[1] })
  }

  if (path === '/calculations' && request.method === 'GET') {
    const [helpers, orders, participants] = await Promise.all([
      supabase<Row[]>(env, 'helpers?select=id,full_name&order=full_name.asc'),
      supabase<Row[]>(env, 'work_orders?select=id,number,event_name,venue,starts_on,ends_on'),
      supabase<Row[]>(env, 'work_order_helpers?select=*'),
    ])
    const orderMap = new Map(orders.map(item => [item.id, item]))
    return json(helpers.map(helper => {
      const work = participants.filter(item => item.helper_id === helper.id)
      return {
        id: helper.id, fullName: helper.full_name, orderCount: work.length,
        totalAmount: work.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
        orders: work.map(item => {
          const order = orderMap.get(item.work_order_id) || {}
          return {
            ...participantDto(item, helper.full_name), orderId: order.id, orderNumber: order.number,
            eventName: order.event_name, venue: order.venue, startsOn: order.starts_on, endsOn: order.ends_on,
          }
        }),
      }
    }))
  }

  return null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const response = await handleApi(request, env)
      if (response) return response
      return env.ASSETS.fetch(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
      if (message === 'CONFLICT') return json({ message: 'Запись с такими данными уже существует' }, 409)
      if (message === 'REFERENCE') return json({ message: 'Запись используется в связанных данных' }, 409)
      return json({ message: `Ошибка облачной базы: ${message}` }, 500)
    }
  },
}
