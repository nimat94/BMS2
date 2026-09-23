export type Profile = {
  id: string;
  full_name: string;
  position: string;
  phone: string;
  role: 'admin' | 'engineer' | 'installer';
  email?: string;
  created_at: string;
};

export type Cable = {
  id: number;
  section: string;
  system: string;
  tag: string;
  start_point: string | null;
  end_point: string | null;
  brand: string | null;
  wires: string | null;
  length: number;
  method: string | null;
  diam: string | null;
  disconnected: 'Да' | 'Нет' | 'Частично';
  installed?: number; // from cable_progress view
  last_completed?: boolean | null;
  last_stop_reason?: string | null;
};

export type Equipment = {
  id: number;
  section: string;
  group_name: string | null;
  pos: string | null;
  name: string | null;
  model: string | null;
  supplier: string | null;
  unit: string | null;
  qty: number;
  installed?: number; // from equipment_progress view
  last_date?: string | null;
  last_user_name?: string | null;
};

export type Shield = {
  id: number;
  section: string;
  type: string | null;
  tag: string;
  purpose: string | null;
  place: string | null;
  model: string | null;
  qty: number;
  postavlen: 'Да' | 'Нет' | 'Частично';
  ustanovlen: 'Да' | 'Нет' | 'Частично';
  k_prol: 'Да' | 'Нет' | 'Частично';
  k_raskl: 'Да' | 'Нет' | 'Частично';
  pnr: 'Да' | 'Нет' | 'Частично';
  resp_id: string | null;
  resp_date: string | null;
};

export type Point = {
  id: number;
  cabinet: string;
  num: string | null;
  io: string | null;
  signal: string | null;
  checked: 'Да' | 'Нет' | 'Частично';
  resp_id: string | null;
};

export type CableLog = {
  id: number;
  cable_id: number;
  qty: number;
  date: string;
  user_id: string | null;
  note: string;
  created_at: string;
};

export type EquipmentLog = {
  id: number;
  equipment_id: number;
  qty: number;
  date: string;
  user_id: string | null;
  note: string;
  created_at: string;
};

export type Attendance = {
  id: number;
  user_id: string;
  date: string;
  section: string | null;
  hours: number | null;
  note: string;
  created_at: string;
};

export const SECTIONS = ['АОВ-К00','АДИС','АЭС','АВК','АОВ-D','АОВ-C1','АОВ-C2','АОВ-C3'];
export const STATUS_OPTIONS = ['Нет', 'Частично', 'Да'] as const;
export const ROLE_LABEL: Record<string,string> = { admin: 'Администратор', engineer: 'Инженер', installer: 'Монтажник' };

export type Readiness = {
  id?: number;
  kind: 'cable' | 'equipment';
  section: string;
  front: string;
  stroy: 'Да' | 'Нет';
  smezh: 'Да' | 'Нет';
  materials: 'Да' | 'Нет';
  permit: 'Да' | 'Нет';
  docs: 'Да' | 'Нет';
  secured: 'Да' | 'Нет';
  note?: string;
  updated_by?: string | null;
  updated_at?: string | null;
};

// Маркеры допуска к монтажу (все должны быть «Да»)
export const READINESS_MARKERS: { key: keyof Readiness; label: string; short: string }[] = [
  { key: 'stroy',     label: 'Строительная готовность',                 short: 'Стройготовность' },
  { key: 'smezh',     label: 'Смежные разделы готовы',                  short: 'Смежники' },
  { key: 'materials', label: 'Оборудование и кабель на объекте',        short: 'Материал' },
  { key: 'permit',    label: 'Разрешение ИТР заказчика на монтаж',      short: 'Разрешение ИТР' },
  { key: 'docs',      label: 'Рабочая документация в порядке',          short: 'РД' },
  { key: 'secured',   label: 'Нет риска кражи (двери, контроль доступа)', short: 'Защищённость' },
];

// Причины, по которым трасса не проложена до конца
export const STOP_REASONS = [
  'Закончился кабель',
  'Мешают коммуникации смежных разделов',
  'Не готова трасса',
  'Отвлеклись на другую задачу',
  'Другое',
];
