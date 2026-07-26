// Per-set display metadata: full name, official signature color (from the SWU
// media kit's SWH_Color swatches), and the vendored logo in /public/sets/.
// IBH ships a logo but no official color; TS26 has neither.

export interface SetMeta {
  code: string;
  name: string;
  color: string | null;
  logo: string | null;
}

const SETS: Record<string, Omit<SetMeta, 'code'>> = {
  // Main numbered sets ("set 1" through "set 9"), release order.
  SOR: { name: 'Spark of Rebellion', color: '#e10600', logo: '/sets/sor.png' },
  SHD: { name: 'Shadows of the Galaxy', color: '#3b3fb6', logo: '/sets/shd.png' },
  TWI: { name: 'Twilight of the Republic', color: '#7c2529', logo: '/sets/twi.png' },
  JTL: { name: 'Jump to Lightspeed', color: '#f2a900', logo: '/sets/jtl.png' },
  LOF: { name: 'Legends of the Force', color: '#00a3e0', logo: '/sets/lof.png' },
  SEC: { name: 'Secrets of Power', color: '#68177f', logo: '/sets/sec.png' },
  LAW: { name: 'A Lawless Time', color: '#ff6900', logo: '/sets/law.png' },
  ASH: { name: 'Ashes of the Empire', color: '#425563', logo: '/sets/ash.png' },
  HMW: { name: 'HomeWorlds', color: null, logo: null },
  // Sub sets (supplemental products), release order.
  IBH: { name: 'Intro Battle: Hoth', color: null, logo: '/sets/ibh.png' },
  TS26: { name: '2026 Twin Suns', color: null, logo: null },
  IC27: { name: 'Icons 2027 Edition', color: null, logo: null },
};

// Unknown codes degrade to a text-only header with the neutral accent.
export function setMeta(code: string): SetMeta {
  const key = code.toUpperCase();
  const entry = SETS[key];
  return entry ? { code: key, ...entry } : { code: key, name: key, color: null, logo: null };
}
