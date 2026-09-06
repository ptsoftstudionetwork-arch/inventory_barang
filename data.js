/* =========================================================
   data.js — Data awal inventaris PT. Softstudio Network
   Harga satuan (Rp) sudah terpasang per 1 pcs / meter.
   ========================================================= */

const DEFAULT_SETTINGS = {
  company: "PT. SOFTSTUDIO NETWORK",
  logo: "",
  user: "admin",
  pass: "admin123"
};

const SEED_INVENTORY = [
  { sku: "KBL-001", name: "Kabel DC (Drop Cable) 1 Core", cat: "Kabel",             unit: "mtr", qty: 1578, min: 200, price: 1500  },
  { sku: "KBL-002", name: "Kabel DC 4 Core",              cat: "Kabel",             unit: "mtr", qty: 1000, min: 200, price: 2500  },
  { sku: "KBL-003", name: "Kabel LAN UTP Cat5e",          cat: "Kabel",             unit: "mtr", qty: 180,  min: 100, price: 2800  },
  { sku: "CLS-001", name: "Closure Fiber 12 Core",        cat: "Closure & FOT",     unit: "pcs", qty: 9,    min: 3,   price: 85000 },
  { sku: "CLS-002", name: "Closure Fiber 8 Core",         cat: "Closure & FOT",     unit: "pcs", qty: 2,    min: 3,   price: 65000 },
  { sku: "CLS-003", name: "Closure Kecil (Mini)",         cat: "Closure & FOT",     unit: "pcs", qty: 8,    min: 3,   price: 25000 },
  { sku: "ONT-001", name: "Router Sigma",                 cat: "Router / ONT",      unit: "pcs", qty: 34,   min: 5,   price: 250000 },
  { sku: "ONT-002", name: "Router ZTE F677",              cat: "Router / ONT",      unit: "pcs", qty: 1,    min: 2,   price: 550000 },
  { sku: "ONT-003", name: "Router ZTE F660",              cat: "Router / ONT",      unit: "pcs", qty: 1,    min: 2,   price: 275000 },
  { sku: "ONT-004", name: "Router ZTE F477",              cat: "Router / ONT",      unit: "pcs", qty: 1,    min: 1,   price: 450000 },
  { sku: "ONT-005", name: "Router ZTE F452",              cat: "Router / ONT",      unit: "pcs", qty: 3,    min: 2,   price: 300000 },
  { sku: "ONT-006", name: "Router ZTE F451",              cat: "Router / ONT",      unit: "pcs", qty: 2,    min: 2,   price: 275000 },
  { sku: "PCH-001", name: "Patchcord Kuning (SC/UPC)",    cat: "Patchcord",         unit: "pcs", qty: 5,    min: 5,   price: 15000 },
  { sku: "PCH-002", name: "Patchcord Hitam (SC/UPC)",     cat: "Patchcord",         unit: "pcs", qty: 3,    min: 5,   price: 15000 },
  { sku: "SPL-001", name: "Splitter 1:8",                 cat: "Splitter",          unit: "pcs", qty: 4,    min: 2,   price: 45000 },
  { sku: "SPL-002", name: "Splitter 1:4",                 cat: "Splitter",          unit: "pcs", qty: 4,    min: 2,   price: 25000 },
  { sku: "SPL-003", name: "Splitter 1:2",                 cat: "Splitter",          unit: "pcs", qty: 3,    min: 2,   price: 15000 },
  { sku: "ADP-001", name: "Adaptor 12V 1A",               cat: "Adaptor",           unit: "pcs", qty: 81,   min: 10,  price: 20000 },
  { sku: "KON-001", name: "Barrel / Fast Connector",      cat: "Konektor",          unit: "pcs", qty: 0,    min: 10,  price: 7500  },
  { sku: "KON-002", name: "Konektor RJ45",                cat: "Konektor",          unit: "pcs", qty: 62,   min: 20,  price: 1500  },
  { sku: "CSM-001", name: "Solasi / Isolasi Hitam",       cat: "Consumable",        unit: "pcs", qty: 2,    min: 5,   price: 10000 }
];

/* Kategori tambahan untuk saran input (datalist) */
const EXTRA_CATS = ["Alat", "Sparepart", "Lainnya"];