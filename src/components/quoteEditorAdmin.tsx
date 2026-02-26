type Mode = "AIR" | "SEA";
type Currency = "USD" | "EUR";

type CostState = {
  c_fruit: number;     // precio por caja (o unidad) según tu lógica
  c_othf: number;      // OTHF fijo
  c_freight: number;   // flete manual (si aplica)
  c_handling: number;  // handling por kg
  c_origin: number;    // gastos origen
  c_aduana: number;    // aduana
  c_insp: number;      // inspección
  c_itbms: number;     // %
  c_others: number;    // ✅ otros gastos (nuevo)
};

type PLRow = { key: string; label: string; cost: number; sale: number; profit: number };

function safeNum(v: any) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function computePL(params: {
  mode: Mode;
  marginPct: number;
  boxes: number;
  weightKg: number;
  destination: string; // código destino
  costs: CostState;
  airRates: Record<string, { rates: Record<number, number> }>;
  seaRates: Record<string, { flat: number }>;
}) {
  const { mode, marginPct, boxes, weightKg, destination, costs, airRates, seaRates } = params;

  const margin = safeNum(marginPct) / 100;
  const w = Math.max(0, safeNum(weightKg));
  const b = Math.max(0, safeNum(boxes));

  // 1) Valor de la fruta (FOB/FCA)
  const p1 = b * safeNum(costs.c_fruit);

  // 2) Logística internacional
  let p2 = 0;
  if (mode === "AIR") {
    const r = airRates[destination];
    const rate = r ? (w >= 2500 ? r.rates[2500] : r.rates[1000]) : 0;
    p2 = w * safeNum(rate) + safeNum(costs.c_othf) + safeNum(costs.c_freight); // ✅ flete editable también suma si lo usas en AIR
  } else {
    const flat = seaRates[destination]?.flat ?? 0;
    // en marítimo normalmente el flete es flat, pero si quieres que el campo "Flete" sea editable, lo sumamos igual:
    p2 = safeNum(flat) + safeNum(costs.c_othf) + safeNum(costs.c_freight);
  }

  // 3) Gastos en origen y aduana
  const handling = w * safeNum(costs.c_handling);
  const itbms = (safeNum(costs.c_origin) + handling) * (safeNum(costs.c_itbms) / 100);
  const p3 = safeNum(costs.c_aduana) + safeNum(costs.c_origin) + handling + itbms;

  // 4) Inspección y calidad
  const p4 = safeNum(costs.c_insp);

  // 5) ✅ Otros gastos (nuevo)
  const p5 = safeNum(costs.c_others);

  const lines = [
    { key: "fruit_value", label: "1. Valor de la fruta (FOB/FCA)", cost: p1 },
    { key: "intl_logistics", label: "2. Logística internacional", cost: p2 },
    { key: "origin_customs", label: "3. Gastos en origen y aduana", cost: p3 },
    { key: "inspection_quality", label: "4. Inspección y calidad", cost: p4 },
    { key: "other_expenses", label: "5. Otros gastos", cost: p5 },
  ];

  const rows: PLRow[] = lines.map((x) => {
    const sale = x.cost * (1 + margin);
    const profit = sale - x.cost;
    return { ...x, sale, profit };
  });

  const totalCost = rows.reduce((acc, r) => acc + r.cost, 0);
  const totalSale = rows.reduce((acc, r) => acc + r.sale, 0);
  const totalProfit = totalSale - totalCost;

  const realMarginPct = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;

  const unitPerBox = b > 0 ? totalSale / b : 0;
  const unitPerKg = w > 0 ? totalSale / w : 0;

  return { rows, totalCost, totalSale, totalProfit, realMarginPct, unitPerBox, unitPerKg };
}