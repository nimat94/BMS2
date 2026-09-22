export type Profile = {
  id: string;
  full_name: string;
  position: string;
  phone: string;
  role: 'admin' | 'engineer' | 'installer';
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
