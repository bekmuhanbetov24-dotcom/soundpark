import { useEffect, useMemo, useState } from 'react'
import {
  Alert, AppBar, Autocomplete, Avatar, Box, Button, Card, CardContent, Checkbox, Chip, CssBaseline,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControlLabel,
  FormControl, IconButton, InputLabel, List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Select, Snackbar, Stack, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ThemeProvider,
  Toolbar, Tooltip, Typography, createTheme, useMediaQuery,
} from '@mui/material'
import {
  AddRounded, AssessmentOutlined, ChevronLeftRounded, ChevronRightRounded,
  DarkModeOutlined, DashboardOutlined, EditOutlined, EventNoteOutlined, LightModeOutlined,
  CloseRounded, DeleteOutlined, LogoutRounded, MenuRounded, PeopleAltOutlined, SettingsOutlined,
} from '@mui/icons-material'
import './App.css'
import { supabase, supabaseApi, usesSupabase } from './supabase'

const localHosts = new Set(['localhost', '127.0.0.1'])
const API_URL = import.meta.env.VITE_API_URL ?? (localHosts.has(window.location.hostname) ? 'http://127.0.0.1:3000' : '')
const ASSET_BASE = import.meta.env.BASE_URL
const drawerWidth = 260
const collapsedWidth = 76

type Page = 'dashboard' | 'orders' | 'helpers' | 'calculations' | 'settings'
type Helper = { id: string; fullName: string; phone: string | null; comment: string | null; isActive: boolean }
type Order = {
  id: string; number: string; startsOn: string; endsOn: string; eventName: string | null; venue: string | null;
  filledByName: string; transport: string | null; lightAmount: string | null; soundAmount: string | null;
  structuresAmount: string | null; totalAmount: string; payrollTotal: string; participantCount: number;
  status: string; comment: string | null;
}
type Participant = {
  id: string; helperId: string; fullName: string; loading: boolean; loadingAmount: string | null;
  unloading: boolean; unloadingAmount: string | null; installation: boolean; installationAmount: string | null;
  dismantling: boolean; dismantlingAmount: string | null; flatRate: boolean; flatRateAmount: string | null;
  totalAmount: string; comment: string | null;
}
type OrderDetails = Order & { participants: Participant[] }
type CalculationOrder = Omit<Participant, 'id' | 'helperId' | 'fullName'> & { orderId: string; orderNumber: string; eventName: string | null; venue: string | null; startsOn: string; endsOn: string }
type Calculation = { id: string; fullName: string; orderCount: number; totalAmount: string; orders: CalculationOrder[] }

const menuItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Обзор', icon: <DashboardOutlined /> },
  { id: 'orders', label: 'Заказ-наряды', icon: <EventNoteOutlined /> },
  { id: 'calculations', label: 'Расчёты', icon: <AssessmentOutlined /> },
  { id: 'helpers', label: 'Хелперы', icon: <PeopleAltOutlined /> },
  { id: 'settings', label: 'Настройки', icon: <SettingsOutlined /> },
]

const pageTitles: Record<Page, string> = { dashboard: 'Обзор', orders: 'Заказ-наряды', helpers: 'Хелперы', calculations: 'Расчёты', settings: 'Настройки' }
const statusLabels: Record<string, string> = { draft: 'Черновик', in_progress: 'В работе', completed: 'Завершён', calculated: 'Рассчитан', closed: 'Закрыт' }
const statusColors: Record<string, 'default' | 'warning' | 'info' | 'success' | 'primary'> = { draft: 'default', in_progress: 'warning', completed: 'info', calculated: 'success', closed: 'primary' }
const formatMoney = (value: string | number | null | undefined) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(value ?? 0))
const formatDate = (value: string) => {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? 'Дата не указана' : new Intl.DateTimeFormat('ru-RU').format(date)
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  if (usesSupabase) return supabaseApi<T>(path, options)
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(payload?.message ?? 'Не удалось выполнить запрос')
  }
  return response.json() as Promise<T>
}

function AdminApp({ onLogout }: { onLogout?: () => void }) {
  const [mode, setMode] = useState<'light' | 'dark'>(() => localStorage.getItem('soundpark-theme') === 'dark' ? 'dark' : 'light')
  const [page, setPage] = useState<Page>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [helpers, setHelpers] = useState<Helper[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [calculations, setCalculations] = useState<Calculation[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ text: string; severity: 'success' | 'error' } | null>(null)
  const desktop = useMediaQuery('(min-width:900px)')

  const theme = useMemo(() => createTheme({
    palette: { mode, primary: { main: mode === 'light' ? '#315a77' : '#8fb7d3' }, background: { default: mode === 'light' ? '#f5f7f9' : '#111519', paper: mode === 'light' ? '#ffffff' : '#192027' } },
    shape: { borderRadius: 10 },
    typography: { fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', button: { textTransform: 'none', fontWeight: 600 } },
    components: {
      MuiCard: { styleOverrides: { root: { boxShadow: 'none', border: `1px solid ${mode === 'light' ? '#e1e6ea' : '#2b343d'}` } } },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiTableCell: { styleOverrides: { head: { fontWeight: 700, whiteSpace: 'nowrap' } } },
      MuiInputLabel: { defaultProps: { shrink: true }, styleOverrides: { shrink: { backgroundColor: mode === 'light' ? '#fff' : '#192027', paddingInline: 5 } } },
      MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: mode === 'light' ? '#fff' : '#192027' } } },
    },
  }), [mode])

  const loadData = async () => {
    setLoading(true)
    try {
      const [helperData, orderData, calculationData] = await Promise.all([api<Helper[]>('/helpers'), api<Order[]>('/work-orders'), api<Calculation[]>('/calculations')])
      setHelpers(helperData); setOrders(orderData); setCalculations(calculationData)
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : 'API недоступно', severity: 'error' }) }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadData() }, [])
  useEffect(() => { localStorage.setItem('soundpark-theme', mode); document.documentElement.dataset.theme = mode }, [mode])

  const drawer = <Box className="sidebar-inner">
    <Box className={`brand ${collapsed && desktop ? 'brand-collapsed' : ''}`}><img src={`${ASSET_BASE}brand/soundpark-logo.png`} alt="SoundPark" /></Box>
    <Divider />
    <List className="nav-list">{menuItems.map(item => <Tooltip key={item.id} title={collapsed && desktop ? item.label : ''} placement="right"><ListItemButton selected={page === item.id} onClick={() => { setPage(item.id); setMobileOpen(false) }}><ListItemIcon>{item.icon}</ListItemIcon>{(!collapsed || !desktop) && <ListItemText primary={item.label} />}</ListItemButton></Tooltip>)}</List>
    <Box className="sidebar-user"><Avatar>ПЮ</Avatar>{(!collapsed || !desktop) && <Box><Typography variant="body2" sx={{ fontWeight: 700 }}>Присс Юрий</Typography><Typography variant="caption" color="text.secondary">Администратор</Typography></Box>}</Box>
  </Box>
  const currentWidth = collapsed ? collapsedWidth : drawerWidth

  return <ThemeProvider theme={theme}><CssBaseline /><Box className="layout">
    <AppBar position="fixed" color="inherit" className="topbar" sx={{ ml: desktop ? `${currentWidth}px` : 0, width: desktop ? `calc(100% - ${currentWidth}px)` : '100%' }}><Toolbar>
      {!desktop && <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Открыть меню"><MenuRounded /></IconButton>}
      {desktop && <IconButton onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}>{collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}</IconButton>}
      <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>{pageTitles[page]}</Typography>
      <Tooltip title={mode === 'light' ? 'Тёмная тема' : 'Светлая тема'}><IconButton onClick={() => setMode(value => value === 'light' ? 'dark' : 'light')} aria-label="Переключить тему">{mode === 'light' ? <DarkModeOutlined /> : <LightModeOutlined />}</IconButton></Tooltip>
      {onLogout && <Tooltip title="Выйти"><IconButton onClick={onLogout} aria-label="Выйти"><LogoutRounded /></IconButton></Tooltip>}
    </Toolbar></AppBar>
    <Drawer variant={desktop ? 'permanent' : 'temporary'} open={desktop || mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: desktop ? currentWidth : drawerWidth } }}>{drawer}</Drawer>
    <Box component="main" className="main-content" sx={{ ml: desktop ? `${currentWidth}px` : 0 }}><Toolbar /><Box className="page-content">
      {page === 'dashboard' && <Dashboard orders={orders} helpers={helpers} loading={loading} onOpenOrders={() => setPage('orders')} />}
      {page === 'orders' && <OrdersManagerPage orders={orders} helpers={helpers} loading={loading} onChanged={loadData} notify={setNotice} />}
      {page === 'helpers' && <HelpersPage helpers={helpers} loading={loading} onChanged={loadData} notify={setNotice} />}
      {page === 'calculations' && <CalculationCards calculations={calculations} />}
      {page === 'settings' && <SettingsPage />}
    </Box></Box>
  </Box><Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}><Alert severity={notice?.severity ?? 'success'} variant="filled" onClose={() => setNotice(null)}>{notice?.text}</Alert></Snackbar></ThemeProvider>
}

function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = async () => {
    setLoading(true); setError('')
    const result = await supabase.auth.signInWithPassword({ email: 'admin@soundpark.local', password })
    if (result.error) setError('Неверный пароль')
    setLoading(false)
  }
  return <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7f9', display: 'grid', placeItems: 'center', p: 2 }}>
    <Card sx={{ width: 'min(420px, 100%)' }}><CardContent sx={{ p: 4 }}>
      <Box className="brand" sx={{ width: 190, mb: 3 }}><img src={`${ASSET_BASE}brand/soundpark-logo.png`} alt="SoundPark" /></Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Вход администратора</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Введите пароль для доступа к заказ-нарядам и расчётам.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TextField fullWidth autoFocus label="Пароль" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && password) void login() }} />
      <Button fullWidth variant="contained" sx={{ mt: 2 }} disabled={!password || loading} onClick={() => void login()}>{loading ? 'Вход…' : 'Войти'}</Button>
    </CardContent></Card>
  </Box>
}

function App() {
  const [ready, setReady] = useState(!usesSupabase)
  const [authenticated, setAuthenticated] = useState(!usesSupabase)

  useEffect(() => {
    if (!usesSupabase) return
    void supabase.auth.getSession().then(({ data }) => { setAuthenticated(Boolean(data.session)); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setAuthenticated(Boolean(session)); setReady(true) })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Typography>Загрузка…</Typography></Box>
  if (!authenticated) return <LoginPage />
  return <AdminApp onLogout={usesSupabase ? () => { void supabase.auth.signOut() } : undefined} />
}

function Dashboard({ orders, helpers, loading, onOpenOrders }: { orders: Order[]; helpers: Helper[]; loading: boolean; onOpenOrders: () => void }) {
  const cards = [['Всего заказов', orders.length, 'Заказ-наряды'], ['Активные хелперы', helpers.filter(helper => helper.isActive).length, 'В справочнике'], ['Требуют расчёта', orders.filter(order => order.status === 'draft' || order.status === 'completed').length, 'Черновики и завершённые'], ['Начислено', formatMoney(orders.reduce((sum, order) => sum + Number(order.payrollTotal), 0)), 'По всем заказам']]
  return <Stack spacing={3}><Box className="page-heading"><Box><Typography variant="h4">Рабочий обзор</Typography><Typography color="text.secondary">Заказы, команда и текущие расчёты</Typography></Box><Button variant="contained" startIcon={<EventNoteOutlined />} onClick={onOpenOrders}>Перейти к заказам</Button></Box><Box className="metric-grid">{cards.map(([label, value, hint]) => <Card key={label}><CardContent><Typography color="text.secondary" variant="body2">{label}</Typography><Typography className="metric-value">{loading ? '—' : value}</Typography><Typography color="text.secondary" variant="caption">{hint}</Typography></CardContent></Card>)}</Box><Card><CardContent><Typography variant="h6" gutterBottom>Последние заказ-наряды</Typography><OrderTable orders={orders.slice(0, 5)} compact /></CardContent></Card></Stack>
}

export function OrdersPage({ orders, helpers, loading, onChanged, notify }: { orders: Order[]; helpers: Helper[]; loading: boolean; onChanged: () => Promise<void>; notify: (value: { text: string; severity: 'success' | 'error' }) => void }) {
  const blank = { number: '', startsOn: '', endsOn: '', eventName: '', venue: '', filledByName: '', transport: '', lightAmount: '', soundAmount: '', structuresAmount: '', comment: '' }
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<OrderDetails | null>(null)
  const [form, setForm] = useState(blank)
  const submit = async () => { try { const amount = (value: string) => value === '' ? undefined : Number(value); await api('/work-orders', { method: 'POST', body: JSON.stringify({ ...form, lightAmount: amount(form.lightAmount), soundAmount: amount(form.soundAmount), structuresAmount: amount(form.structuresAmount) }) }); setOpen(false); setForm(blank); await onChanged(); notify({ text: 'Заказ-наряд создан', severity: 'success' }) } catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось создать заказ', severity: 'error' }) } }
  const showDetails = async (id: string) => { try { setSelected(await api<OrderDetails>(`/work-orders/${id}`)) } catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось открыть заказ', severity: 'error' }) } }
  return <><Box className="page-heading"><Box><Typography variant="h4">Заказ-наряды</Typography><Typography color="text.secondary">Периоды работ, расходы и участники</Typography></Box><Button variant="contained" startIcon={<AddRounded />} onClick={() => setOpen(true)}>Добавить заказ</Button></Box><Card><CardContent>{loading ? <Typography color="text.secondary">Загрузка…</Typography> : <OrderTable orders={orders} onSelect={showDetails} />}</CardContent></Card>
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth><DialogTitle>Новый заказ-наряд</DialogTitle><DialogContent><Box className="form-grid"><TextField label="Номер" required value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} /><TextField label="Название концерта" value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} /><TextField label="Дата с" type="date" required slotProps={{ inputLabel: { shrink: true } }} value={form.startsOn} onChange={e => setForm({ ...form, startsOn: e.target.value })} /><TextField label="Дата по" type="date" required slotProps={{ inputLabel: { shrink: true } }} value={form.endsOn} onChange={e => setForm({ ...form, endsOn: e.target.value })} /><TextField label="Место проведения" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} /><TextField label="Транспорт" value={form.transport} onChange={e => setForm({ ...form, transport: e.target.value })} /><Autocomplete freeSolo options={helpers.map(helper => helper.fullName)} value={form.filledByName} onInputChange={(_, value) => setForm({ ...form, filledByName: value })} renderInput={params => <TextField {...params} label="Кто заполнил" required />} /><Box /><TextField label="Свет, ₽" type="number" value={form.lightAmount} onChange={e => setForm({ ...form, lightAmount: e.target.value })} /><TextField label="Звук, ₽" type="number" value={form.soundAmount} onChange={e => setForm({ ...form, soundAmount: e.target.value })} /><TextField label="Конструкции, ₽" type="number" value={form.structuresAmount} onChange={e => setForm({ ...form, structuresAmount: e.target.value })} /><TextField label="Комментарий" multiline minRows={2} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} /></Box></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Отмена</Button><Button variant="contained" disabled={!form.number || !form.startsOn || !form.endsOn || !form.filledByName} onClick={() => void submit()}>Создать</Button></DialogActions></Dialog>
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="lg" fullWidth><DialogTitle>Заказ-наряд №{selected?.number}</DialogTitle><DialogContent>{selected && <Stack spacing={3}><Box className="detail-grid"><Detail label="Период" value={`${formatDate(selected.startsOn)} — ${formatDate(selected.endsOn)}`} /><Detail label="Место" value={selected.venue || 'Не указано'} /><Detail label="Заполнил" value={selected.filledByName} /><Detail label="Транспорт" value={selected.transport || 'Не указан'} /><Detail label="Общая сумма" value={formatMoney(selected.totalAmount)} /></Box><Divider /><Typography variant="h6">Хелперы ({selected.participants.length})</Typography><TableContainer><Table size="small"><TableHead><TableRow><TableCell>ФИО</TableCell><TableCell>Работы</TableCell><TableCell align="right">Сумма</TableCell></TableRow></TableHead><TableBody>{selected.participants.map(person => { const works = [['Погрузка', person.loading], ['Разгрузка', person.unloading], ['Монтаж', person.installation], ['Демонтаж', person.dismantling], ['Ставка', person.flatRate]].filter(([, active]) => active).map(([name]) => name); return <TableRow key={person.id}><TableCell>{person.fullName}</TableCell><TableCell>{works.length ? works.join(', ') : 'Не заполнено'}</TableCell><TableCell align="right">{formatMoney(person.totalAmount)}</TableCell></TableRow> })}</TableBody></Table></TableContainer></Stack>}</DialogContent><DialogActions><Button onClick={() => setSelected(null)}>Закрыть</Button></DialogActions></Dialog></>
}

function OrderTable({ orders, compact = false, onSelect, onDelete }: { orders: Order[]; compact?: boolean; onSelect?: (id: string) => void; onDelete?: (order: Order) => void }) {
  if (!orders.length) return <Box className="empty-state"><EventNoteOutlined /><Typography>Заказов пока нет</Typography></Box>
  return <TableContainer><Table size={compact ? 'small' : 'medium'}><TableHead><TableRow><TableCell>№</TableCell><TableCell>Период</TableCell><TableCell>Концерт / место</TableCell><TableCell>Хелперы</TableCell><TableCell>Статус</TableCell><TableCell align="right">Сумма</TableCell>{onDelete && <TableCell align="right">Действия</TableCell>}</TableRow></TableHead><TableBody>{orders.map(order => <TableRow key={order.id} hover={Boolean(onSelect)} className={onSelect ? 'clickable-row' : ''} onClick={() => onSelect?.(order.id)}><TableCell><Typography sx={{ fontWeight: 700 }}>№{order.number}</Typography></TableCell><TableCell>{formatDate(order.startsOn)} — {formatDate(order.endsOn)}</TableCell><TableCell>{order.eventName || order.venue || 'Не указано'}</TableCell><TableCell>{order.participantCount}</TableCell><TableCell><Chip size="small" color={statusColors[order.status] ?? 'default'} label={statusLabels[order.status] ?? order.status} /></TableCell><TableCell align="right">{formatMoney(order.totalAmount)}</TableCell>{onDelete && <TableCell align="right"><Tooltip title="Удалить заказ-наряд"><IconButton color="error" aria-label={`Удалить заказ-наряд №${order.number}`} onClick={event => { event.stopPropagation(); onDelete(order) }}><DeleteOutlined /></IconButton></Tooltip></TableCell>}</TableRow>)}</TableBody></Table></TableContainer>
}

function formatRussianPhone(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('8')) digits = digits.slice(1)
  if (digits.startsWith('7')) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (!digits) return ''
  let result = '+7'
  if (digits.length) result += ` (${digits.slice(0, 3)}`
  if (digits.length >= 3) result += ')'
  if (digits.length > 3) result += ` ${digits.slice(3, 6)}`
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`
  if (digits.length > 8) result += `-${digits.slice(8, 10)}`
  return result
}

function HelpersPage({ helpers, loading, onChanged, notify }: { helpers: Helper[]; loading: boolean; onChanged: () => Promise<void>; notify: (value: { text: string; severity: 'success' | 'error' }) => void }) {
  const [editing, setEditing] = useState<Helper | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ fullName: '', phone: '', comment: '' })
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU')
  const filteredHelpers = helpers.filter(helper => `${helper.fullName} ${helper.comment ?? ''}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery))
  const begin = (helper?: Helper) => { setEditing(helper ?? null); setForm({ fullName: helper?.fullName ?? '', phone: formatRussianPhone(helper?.phone ?? ''), comment: helper?.comment ?? '' }); setOpen(true) }
  const submit = async () => { try { await api(editing ? `/helpers/${editing.id}` : '/helpers', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(form) }); setOpen(false); await onChanged(); notify({ text: editing ? 'Данные хелпера обновлены' : 'Хелпер добавлен', severity: 'success' }) } catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось сохранить', severity: 'error' }) } }
  const toggleActive = async (helper: Helper) => { try { await api(`/helpers/${helper.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !helper.isActive }) }); await onChanged(); notify({ text: helper.isActive ? 'Хелпер перемещён в архив' : 'Хелпер восстановлен', severity: 'success' }) } catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось изменить статус', severity: 'error' }) } }
  const remove = async (helper: Helper) => { if (!window.confirm(`Удалить ${helper.fullName} из справочника?`)) return; try { await api(`/helpers/${helper.id}`, { method: 'DELETE' }); await onChanged(); notify({ text: 'Хелпер удалён', severity: 'success' }) } catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось удалить хелпера', severity: 'error' }) } }
  return <><Box className="page-heading helper-heading"><Box><Typography variant="h4">Хелперы</Typography><Typography color="text.secondary">Справочник помощников · найдено: {filteredHelpers.length}</Typography></Box><Box className="helper-actions"><TextField size="small" label="Поиск" placeholder="ФИО или комментарий" value={query} onChange={event => setQuery(event.target.value)} /><Button variant="contained" startIcon={<AddRounded />} onClick={() => begin()}>Добавить хелпера</Button></Box></Box><Card className="helper-registry"><CardContent>{loading ? <Typography color="text.secondary">Загрузка…</Typography> : filteredHelpers.length ? <TableContainer><Table size="small"><TableHead><TableRow><TableCell>ФИО</TableCell><TableCell>Телефон</TableCell><TableCell>Комментарий</TableCell><TableCell align="center">Активен</TableCell><TableCell align="right">Действия</TableCell></TableRow></TableHead><TableBody>{filteredHelpers.map(helper => <TableRow key={helper.id} sx={{ opacity: helper.isActive ? 1 : .6 }}><TableCell><Typography className="helper-name">{helper.fullName}</Typography></TableCell><TableCell>{helper.phone || '—'}</TableCell><TableCell className="comment-cell">{helper.comment || '—'}</TableCell><TableCell align="center"><Tooltip title={helper.isActive ? 'Исключить из выбора в заказах' : 'Вернуть в выбор'}><Checkbox size="small" checked={helper.isActive} onChange={() => void toggleActive(helper)} slotProps={{ input: { 'aria-label': `${helper.fullName}: активен` } }} /></Tooltip></TableCell><TableCell align="right"><Tooltip title="Редактировать"><IconButton size="small" onClick={() => begin(helper)}><EditOutlined fontSize="small" /></IconButton></Tooltip><Tooltip title="Удалить"><IconButton size="small" color="error" onClick={() => void remove(helper)}><DeleteOutlined fontSize="small" /></IconButton></Tooltip></TableCell></TableRow>)}</TableBody></Table></TableContainer> : <Box className="empty-state compact-empty"><PeopleAltOutlined /><Typography>Хелперы не найдены</Typography></Box>}</CardContent></Card><Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth><DialogTitle>{editing ? 'Редактировать хелпера' : 'Новый хелпер'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label="ФИО" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /><TextField label="Номер телефона" placeholder="+7 (999) 123-45-67" value={form.phone} onChange={e => setForm({ ...form, phone: formatRussianPhone(e.target.value) })} slotProps={{ htmlInput: { inputMode: 'tel', maxLength: 18 } }} /><TextField label="Комментарий" multiline minRows={3} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} /></Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Отмена</Button><Button variant="contained" disabled={!form.fullName.trim()} onClick={() => void submit()}>Сохранить</Button></DialogActions></Dialog></>
}

export function CalculationsPage({ calculations }: { calculations: Calculation[] }) { return <><Box className="page-heading"><Box><Typography variant="h4">Расчёты</Typography><Typography color="text.secondary">Начисления по каждому человеку</Typography></Box></Box><Card><CardContent><TableContainer><Table><TableHead><TableRow><TableCell>Хелпер</TableCell><TableCell align="right">Заказов</TableCell><TableCell align="right">Начислено</TableCell></TableRow></TableHead><TableBody>{calculations.map(item => <TableRow key={item.id}><TableCell><Typography sx={{ fontWeight: 600 }}>{item.fullName}</Typography></TableCell><TableCell align="right">{item.orderCount}</TableCell><TableCell align="right">{formatMoney(item.totalAmount)}</TableCell></TableRow>)}</TableBody></Table></TableContainer></CardContent></Card></> }
function SettingsPage() { return <><Box className="page-heading"><Box><Typography variant="h4">Настройки</Typography><Typography color="text.secondary">Доступ и параметры приложения</Typography></Box></Box><Card className="settings-card"><CardContent><Typography variant="h6">Ролевая модель</Typography><Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>В первой версии используется одна роль с полным доступом.</Typography><Box className="role-row"><Avatar>ПЮ</Avatar><Box sx={{ flexGrow: 1 }}><Typography sx={{ fontWeight: 700 }}>Присс Юрий</Typography><Typography variant="body2" color="text.secondary">Администратор · полный доступ</Typography></Box><Chip label="Активна" color="success" size="small" /></Box><Divider sx={{ my: 3 }} /><FormControlLabel control={<Switch defaultChecked disabled />} label="Разрешить редактирование завершённых заказов" /></CardContent></Card></> }
function Detail({ label, value }: { label: string; value: string }) { return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ fontWeight: 600 }}>{value}</Typography></Box> }

type OrderFormState = {
  number: string; startsOn: string; endsOn: string; eventName: string; venue: string;
  filledByName: string; transport: string; lightAmount: string; soundAmount: string;
  structuresAmount: string; status: string; comment: string;
}

const blankOrderForm: OrderFormState = {
  number: '', startsOn: '', endsOn: '', eventName: '', venue: '', filledByName: '', transport: '',
  lightAmount: '', soundAmount: '', structuresAmount: '', status: 'draft', comment: '',
}

const orderToForm = (order: Order): OrderFormState => ({
  number: order.number, startsOn: order.startsOn, endsOn: order.endsOn, eventName: order.eventName ?? '',
  venue: order.venue ?? '', filledByName: order.filledByName, transport: order.transport ?? '',
  lightAmount: order.lightAmount ?? '', soundAmount: order.soundAmount ?? '', structuresAmount: order.structuresAmount ?? '',
  status: order.status, comment: order.comment ?? '',
})

function WorkOrderForm({ open, order, helpers, onClose, onSaved, notify }: {
  open: boolean; order: OrderDetails | null; helpers: Helper[]; onClose: () => void;
  onSaved: (order: OrderDetails) => Promise<void>; notify: (value: { text: string; severity: 'success' | 'error' }) => void;
}) {
  const [form, setForm] = useState<OrderFormState>(() => order ? orderToForm(order) : blankOrderForm)
  const [saving, setSaving] = useState(false)
  const dateInvalid = Boolean(form.startsOn && form.endsOn && form.startsOn > form.endsOn)
  const set = (field: keyof OrderFormState, value: string) => setForm(current => ({ ...current, [field]: value }))
  const save = async () => {
    setSaving(true)
    try {
      const amount = (value: string) => value === '' ? undefined : Number(value)
      const payload = { ...form, lightAmount: amount(form.lightAmount), soundAmount: amount(form.soundAmount), structuresAmount: amount(form.structuresAmount) }
      const saved = await api<OrderDetails>(order ? `/work-orders/${order.id}` : '/work-orders', { method: order ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      await onSaved(saved)
      notify({ text: order ? 'Заказ-наряд обновлён' : 'Заказ-наряд создан', severity: 'success' })
    } catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось сохранить заказ', severity: 'error' }) }
    finally { setSaving(false) }
  }
  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle><Box className="dialog-title-row"><span>{order ? `Редактирование заказ-наряда №${order.number}` : 'Новый заказ-наряд'}</span><IconButton onClick={onClose} aria-label="Закрыть"><CloseRounded /></IconButton></Box></DialogTitle>
    <DialogContent><Box className="form-grid">
      <TextField label="Номер" required value={form.number} onChange={e => set('number', e.target.value)} />
      <TextField label="Название концерта" value={form.eventName} onChange={e => set('eventName', e.target.value)} />
      <TextField className="date-field" label="Дата с" type="date" required error={dateInvalid} value={form.startsOn} onChange={e => set('startsOn', e.target.value)} slotProps={{ htmlInput: { max: form.endsOn || undefined } }} helperText={dateInvalid ? 'Начало не может быть позже окончания' : form.endsOn ? `Не позже ${formatDate(form.endsOn)}` : 'Выберите начало периода'} />
      <TextField className="date-field" label="Дата по" type="date" required error={dateInvalid} value={form.endsOn} onChange={e => set('endsOn', e.target.value)} slotProps={{ htmlInput: { min: form.startsOn || undefined } }} helperText={dateInvalid ? 'Окончание не может быть раньше начала' : form.startsOn ? `Не раньше ${formatDate(form.startsOn)}` : 'Выберите окончание периода'} />
      <TextField label="Место проведения" value={form.venue} onChange={e => set('venue', e.target.value)} />
      <TextField label="Транспорт" value={form.transport} onChange={e => set('transport', e.target.value)} />
      <Autocomplete freeSolo options={helpers.map(helper => helper.fullName)} value={form.filledByName} onInputChange={(_, value) => set('filledByName', value)} renderInput={params => <TextField {...params} label="Кто заполнил" required />} />
      <FormControl><InputLabel>Статус</InputLabel><Select label="Статус" value={form.status} onChange={e => set('status', e.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
      <TextField label="Свет, ₽" type="number" value={form.lightAmount} onChange={e => set('lightAmount', e.target.value)} slotProps={{ htmlInput: { min: 0 } }} />
      <TextField label="Звук, ₽" type="number" value={form.soundAmount} onChange={e => set('soundAmount', e.target.value)} slotProps={{ htmlInput: { min: 0 } }} />
      <TextField label="Конструкции, ₽" type="number" value={form.structuresAmount} onChange={e => set('structuresAmount', e.target.value)} slotProps={{ htmlInput: { min: 0 } }} />
      <TextField label="Комментарий" multiline minRows={2} value={form.comment} onChange={e => set('comment', e.target.value)} />
    </Box></DialogContent>
    <DialogActions><Button onClick={onClose}>Отмена</Button><Button variant="contained" disabled={saving || dateInvalid || !form.number.trim() || !form.startsOn || !form.endsOn || !form.filledByName.trim()} onClick={() => void save()}>{saving ? 'Сохранение…' : 'Сохранить'}</Button></DialogActions>
  </Dialog>
}

type ParticipantFormState = {
  helperId: string; loading: boolean; loadingAmount: string; unloading: boolean; unloadingAmount: string;
  installation: boolean; installationAmount: string; dismantling: boolean; dismantlingAmount: string;
  flatRate: boolean; flatRateAmount: string; comment: string;
}

const blankParticipantForm: ParticipantFormState = {
  helperId: '', loading: false, loadingAmount: '', unloading: false, unloadingAmount: '',
  installation: false, installationAmount: '', dismantling: false, dismantlingAmount: '',
  flatRate: false, flatRateAmount: '', comment: '',
}

const participantToForm = (person: Participant): ParticipantFormState => ({
  helperId: person.helperId, loading: person.loading, loadingAmount: person.loadingAmount ?? '',
  unloading: person.unloading, unloadingAmount: person.unloadingAmount ?? '', installation: person.installation,
  installationAmount: person.installationAmount ?? '', dismantling: person.dismantling,
  dismantlingAmount: person.dismantlingAmount ?? '', flatRate: person.flatRate,
  flatRateAmount: person.flatRateAmount ?? '', comment: person.comment ?? '',
})

const workDefinitions = [
  ['loading', 'loadingAmount', 'Погрузка'], ['unloading', 'unloadingAmount', 'Разгрузка'],
  ['installation', 'installationAmount', 'Монтаж'], ['dismantling', 'dismantlingAmount', 'Демонтаж'],
  ['flatRate', 'flatRateAmount', 'Ставка'],
] as const

function ParticipantForm({ open, orderId, participant, helpers, participants, onClose, onSaved, notify }: {
  open: boolean; orderId: string; participant: Participant | null; helpers: Helper[]; participants: Participant[];
  onClose: () => void; onSaved: (order: OrderDetails) => Promise<void>;
  notify: (value: { text: string; severity: 'success' | 'error' }) => void;
}) {
  const [form, setForm] = useState<ParticipantFormState>(() => participant ? participantToForm(participant) : blankParticipantForm)
  const [saving, setSaving] = useState(false)
  const availableHelpers = helpers.filter(helper => helper.id === participant?.helperId || (helper.isActive && !participants.some(person => person.helperId === helper.id)))
  const total = workDefinitions.reduce((sum, [active, amount]) => sum + (form[active] ? Number(form[amount] || 0) : 0), 0)
  const save = async () => {
    setSaving(true)
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => key.endsWith('Amount') ? [key, value === '' ? undefined : Number(value)] : [key, value]))
      const saved = await api<OrderDetails>(`/work-orders/${orderId}/participant`, { method: 'PUT', body: JSON.stringify(payload) })
      await onSaved(saved); notify({ text: participant ? 'Работы хелпера обновлены' : 'Хелпер добавлен в заказ', severity: 'success' })
    } catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось сохранить работы', severity: 'error' }) }
    finally { setSaving(false) }
  }
  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle><Box className="dialog-title-row"><span>{participant ? `Работы: ${participant.fullName}` : 'Добавить хелпера в заказ'}</span><IconButton onClick={onClose} aria-label="Закрыть"><CloseRounded /></IconButton></Box></DialogTitle>
    <DialogContent><Stack spacing={2.2} sx={{ pt: 1 }}>
      <Autocomplete disabled={Boolean(participant)} options={availableHelpers} getOptionLabel={option => option.fullName} value={availableHelpers.find(helper => helper.id === form.helperId) ?? null} onChange={(_, value) => setForm(current => ({ ...current, helperId: value?.id ?? '' }))} renderInput={params => <TextField {...params} label="Хелпер" required />} />
      <Typography variant="subtitle2">Отметьте выполненные работы и укажите стоимость</Typography>
      <Box className="work-form-list">{workDefinitions.map(([active, amount, label]) => <Box className="work-form-row" key={active}>
        <FormControlLabel control={<Checkbox checked={form[active]} onChange={e => setForm(current => ({ ...current, [active]: e.target.checked, ...(!e.target.checked ? { [amount]: '' } : {}) }))} />} label={label} />
        <TextField size="small" label="Стоимость, ₽" type="number" disabled={!form[active]} value={form[amount]} onChange={e => setForm(current => ({ ...current, [amount]: e.target.value }))} slotProps={{ htmlInput: { min: 0 } }} />
      </Box>)}</Box>
      <TextField label="Комментарий" multiline minRows={2} value={form.comment} onChange={e => setForm(current => ({ ...current, comment: e.target.value }))} />
      <Box className="participant-total"><Typography color="text.secondary">Итого хелперу</Typography><Typography variant="h6">{formatMoney(total)}</Typography></Box>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Отмена</Button><Button variant="contained" disabled={saving || !form.helperId} onClick={() => void save()}>{saving ? 'Сохранение…' : 'Сохранить'}</Button></DialogActions>
  </Dialog>
}

function OrdersManagerPage({ orders, helpers, loading, onChanged, notify }: { orders: Order[]; helpers: Helper[]; loading: boolean; onChanged: () => Promise<void>; notify: (value: { text: string; severity: 'success' | 'error' }) => void }) {
  const [selected, setSelected] = useState<OrderDetails | null>(null)
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [participantFormOpen, setParticipantFormOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const showDetails = async (id: string) => { try { setSelected(await api<OrderDetails>(`/work-orders/${id}`)) } catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось открыть заказ', severity: 'error' }) } }
  const savedOrder = async (order: OrderDetails) => { setSelected(order); setOrderFormOpen(false); await onChanged() }
  const savedParticipant = async (order: OrderDetails) => { setSelected(order); setParticipantFormOpen(false); setEditingParticipant(null); await onChanged() }
  const removeOrder = async (order: Order) => {
    if (!window.confirm('Вы действительно хотите удалить заказ-наряд?')) return
    try { await api(`/work-orders/${order.id}`, { method: 'DELETE' }); if (selected?.id === order.id) setSelected(null); await onChanged(); notify({ text: `Заказ-наряд №${order.number} удалён`, severity: 'success' }) }
    catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось удалить заказ', severity: 'error' }) }
  }
  const removeParticipant = async (person: Participant) => {
    if (!selected || !window.confirm(`Удалить ${person.fullName} из заказ-наряда?`)) return
    try { const saved = await api<OrderDetails>(`/work-orders/${selected.id}/participant/${person.helperId}`, { method: 'DELETE' }); setSelected(saved); await onChanged(); notify({ text: 'Хелпер удалён из заказа', severity: 'success' }) }
    catch (error) { notify({ text: error instanceof Error ? error.message : 'Не удалось удалить хелпера', severity: 'error' }) }
  }
  return <>
    <Box className="page-heading"><Box><Typography variant="h4">Заказ-наряды</Typography><Typography color="text.secondary">Периоды работ, расходы и участники</Typography></Box><Button variant="contained" startIcon={<AddRounded />} onClick={() => { setSelected(null); setOrderFormOpen(true) }}>Добавить заказ</Button></Box>
    <Card><CardContent>{loading ? <Typography color="text.secondary">Загрузка…</Typography> : <OrderTable orders={orders} onSelect={showDetails} onDelete={order => void removeOrder(order)} />}</CardContent></Card>
    <Dialog open={Boolean(selected) && !orderFormOpen} onClose={() => setSelected(null)} maxWidth="lg" fullWidth>
      <DialogTitle><Box className="dialog-title-row"><Box><Typography variant="h6">Заказ-наряд №{selected?.number}</Typography><Typography variant="body2" color="text.secondary">{selected?.eventName || selected?.venue || 'Без названия'}</Typography></Box><Stack direction="row" spacing={1}><Button startIcon={<EditOutlined />} onClick={() => setOrderFormOpen(true)}>Редактировать</Button><IconButton onClick={() => setSelected(null)} aria-label="Закрыть"><CloseRounded /></IconButton></Stack></Box></DialogTitle>
      <DialogContent>{selected && <Stack spacing={3}>
        <Box className="detail-grid"><Detail label="Период" value={`${formatDate(selected.startsOn)} — ${formatDate(selected.endsOn)}`} /><Detail label="Место" value={selected.venue || 'Не указано'} /><Detail label="Заполнил" value={selected.filledByName} /><Detail label="Транспорт" value={selected.transport || 'Не указан'} /><Detail label="Расходы на людей" value={formatMoney(selected.totalAmount)} /></Box>
        <Box className="cost-summary"><Detail label="Свет" value={formatMoney(selected.lightAmount)} /><Detail label="Звук" value={formatMoney(selected.soundAmount)} /><Detail label="Конструкции" value={formatMoney(selected.structuresAmount)} /><Detail label="Начислено хелперам" value={formatMoney(selected.participants.reduce((sum, person) => sum + Number(person.totalAmount), 0))} /></Box>
        <Divider />
        <Box className="section-heading"><Box><Typography variant="h6">Хелперы</Typography><Typography variant="body2" color="text.secondary">Один выход за период, нужные виды работ отмечаются галочками</Typography></Box><Button variant="outlined" startIcon={<AddRounded />} onClick={() => { setEditingParticipant(null); setParticipantFormOpen(true) }}>Добавить хелпера</Button></Box>
        {selected.participants.length ? <Box className="participant-grid">{selected.participants.map(person => <Card key={person.id} className="participant-card"><CardContent>
          <Box className="participant-card-head"><Box><Typography sx={{ fontWeight: 700 }}>{person.fullName}</Typography><Typography variant="h6">{formatMoney(person.totalAmount)}</Typography></Box><Box><Tooltip title="Редактировать работы"><IconButton onClick={() => { setEditingParticipant(person); setParticipantFormOpen(true) }}><EditOutlined /></IconButton></Tooltip><Tooltip title="Удалить из заказа"><IconButton color="error" onClick={() => void removeParticipant(person)}><DeleteOutlined /></IconButton></Tooltip></Box></Box>
          <Divider sx={{ my: 1.5 }} /><Box className="active-work-grid">{workDefinitions.filter(([active]) => person[active]).map(([active, amount, label]) => <Box className="work-line active" key={active}><Box className="work-line-name"><Checkbox size="small" checked disabled /><Typography variant="body2">{label}</Typography></Box><Typography variant="body2" sx={{ fontWeight: 650 }}>{formatMoney(person[amount])}</Typography></Box>)}</Box>
          {person.comment && <Typography variant="caption" color="text.secondary" className="participant-comment">{person.comment}</Typography>}
        </CardContent></Card>)}</Box> : <Box className="empty-state"><PeopleAltOutlined /><Typography>Добавьте хелперов и отметьте выполненные работы</Typography></Box>}
      </Stack>}</DialogContent>
    </Dialog>
    <WorkOrderForm key={`${selected?.id ?? 'new'}-${orderFormOpen}`} open={orderFormOpen} order={selected} helpers={helpers} onClose={() => setOrderFormOpen(false)} onSaved={savedOrder} notify={notify} />
    {selected && <ParticipantForm key={`${editingParticipant?.id ?? 'new'}-${participantFormOpen}`} open={participantFormOpen} orderId={selected.id} participant={editingParticipant} helpers={helpers} participants={selected.participants} onClose={() => { setParticipantFormOpen(false); setEditingParticipant(null) }} onSaved={savedParticipant} notify={notify} />}
  </>
}

function workSummary(item: CalculationOrder) {
  return workDefinitions.filter(([active]) => item[active]).map(([, amount, label]) => ({ label, amount: item[amount] }))
}

function CalculationCards({ calculations }: { calculations: Calculation[] }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU')
  const active = calculations.filter(item => item.orderCount > 0 && item.fullName.toLocaleLowerCase('ru-RU').includes(normalizedQuery))
  return <><Box className="page-heading"><Box><Typography variant="h4">Расчёты</Typography><Typography color="text.secondary">Компактные карточки начислений для отправки хелперам</Typography></Box><TextField className="calculation-search" size="small" label="Поиск по ФИО" placeholder="Введите имя или фамилию" value={query} onChange={event => setQuery(event.target.value)} /></Box>
    {active.length ? <Box className="calculation-grid">{active.map(helper => <Card key={helper.id} className="calculation-card"><CardContent>
      <Box className="calculation-card-head"><Box><Typography variant="h6">{helper.fullName}</Typography><Typography variant="caption" color="text.secondary">Расчёт заработной платы · заказов: {helper.orderCount}</Typography></Box><Box className="salary-total"><Typography variant="caption" color="text.secondary">Итого</Typography><Typography variant="h5">{formatMoney(helper.totalAmount)}</Typography></Box></Box>
      <Divider sx={{ my: 1.5 }} /><Stack spacing={1}>{helper.orders.map(order => { const works = workSummary(order); return <Box key={order.orderId} className="calculation-order"><Box className="calculation-order-head"><Box><Typography sx={{ fontWeight: 700 }}>Заказ №{order.orderNumber}</Typography><Typography variant="caption" color="text.secondary">{order.eventName || order.venue || 'Без названия'} · {formatDate(order.startsOn)}–{formatDate(order.endsOn)}</Typography></Box><Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatMoney(order.totalAmount)}</Typography></Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>{works.length ? works.map(work => `${work.label} — ${formatMoney(work.amount)}`).join(' · ') : 'Работы пока не отмечены'}</Typography>
      </Box>})}</Stack>
    </CardContent></Card>)}</Box> : <Card><CardContent><Box className="empty-state"><AssessmentOutlined /><Typography>{query ? 'По вашему запросу начисления не найдены' : 'Начислений пока нет'}</Typography></Box></CardContent></Card>}
  </>
}

export default App
