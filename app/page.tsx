'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  FlaskConical,
  Layers3,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  Download,
  Settings2,
  TrendingUp,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  createId,
  backtest,
  demoBars,
  parseCSV,
  starter,
  template,
  ruleNames,
  validateStrategy,
  type Bar,
  type Strategy,
  type Settings,
  type Result,
  type Rule,
} from '@/lib/engine';
const money = (n: number) =>
  new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
const date = (n: number) => new Date(n).toISOString().slice(0, 10);
const stamp = (n: number) =>
  new Date(n).toISOString().slice(0, 16).replace('T', ' ');
type Stored = { kind: 'strategy'; data: Strategy } | { kind: 'run'; data: Run };
type Run = {
  id: string;
  created: string;
  results: Result[];
  errors: string[];
  source: string;
};
function Choice({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(String(v))}
    >
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue>
          {options.find((x) => x[0] === value)?.[1] || value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isNaN(value) ? '' : value}
        min={min}
        max={max}
        step={step}
        onChange={(e) =>
          onChange(e.target.value === '' ? NaN : Number(e.target.value))
        }
      />
    </label>
  );
}
function description(r: Rule) {
  if (r.kind === 'ema' || r.kind === 'sma')
    return `Compra: ${r.kind.toUpperCase()} ${r.period} > ${r.slow}. Venta: media rápida < lenta.`;
  if (r.kind === 'rsi')
    return `Compra al recuperar ${r.level} desde abajo. Venta al perder ${100 - r.level} desde arriba. RSI de Wilder.`;
  if (r.kind === 'bos')
    return `Compra: cierre supera el máximo de las ${r.period} velas anteriores. Venta: cierre pierde el mínimo. BOS simplificado.`;
  return 'Compra: mínimo actual > máximo de hace 2 velas. Venta: máximo actual < mínimo de hace 2 velas. FVG de 3 velas, sin retesteo.';
}
async function api(method: string, payload?: unknown, id?: string) {
  const response = await fetch(
    '/api/records' + (id ? '?id=' + encodeURIComponent(id) : ''),
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    },
  );
  const data = (await response.json()) as { error?: string };
  if (!response.ok)
    throw Error(data.error || 'No se pudo completar la operación.');
  return data as unknown as Stored[];
}
function Curve({ result }: { result: Result }) {
  const points = [
    { time: result.start, equity: result.settings.capital },
    ...result.curve,
  ];
  const low = Math.min(...points.map((p) => p.equity)),
    high = Math.max(...points.map((p) => p.equity)),
    range = Math.max(high - low, 1);
  const y = (v: number) => 185 - ((v - low) / range) * 150;
  const path = points
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${54 + (i / (points.length - 1)) * 900},${y(p.equity)}`,
    )
    .join(' ');
  return (
    <svg
      aria-label={`Curva de capital, resultado ${money(result.net)}`}
      viewBox="0 0 1000 230"
      className="curve"
    >
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6bb6c" stopOpacity=".23" />
          <stop offset="1" stopColor="#e6bb6c" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line
            x1="54"
            x2="954"
            y1={35 + v * 150}
            y2={35 + v * 150}
            stroke="#2a3645"
            strokeDasharray="4 6"
          />
          <text x="0" y={40 + v * 150} fill="#9daec2" fontSize="12">
            {Math.round(high - v * (high - low))}
          </text>
        </g>
      ))}
      <path d={path + ' L954,185 L54,185 Z'} fill="url(#fill)" />
      <path d={path} fill="none" stroke="#e6bb6c" strokeWidth="2" />
      <text x="54" y="220" fill="#9daec2" fontSize="13">
        {date(result.start)}
      </text>
      <text x="954" y="220" textAnchor="end" fill="#9daec2" fontSize="13">
        {date(result.end)} · UTC
      </text>
    </svg>
  );
}
export default function Home() {
  const [tab, setTab] = useState('strategies'),
    [strategies, setStrategies] = useState<Strategy[]>([]),
    [draft, setDraft] = useState<Strategy | null>(null),
    [runs, setRuns] = useState<Run[]>([]),
    [activeRun, setActiveRun] = useState<Run | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [detail, setDetail] = useState(0),
    [message, setMessage] = useState(''),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [remove, setRemove] = useState<string | null>(null),
    [upload, setUpload] = useState<Bar[] | null>(null),
    [filename, setFilename] = useState(''),
    [source, setSource] = useState('demo'),
    [period, setPeriod] = useState('1'),
    [newKind, setNewKind] = useState('ema'),
    [page, setPage] = useState(0);
  const demo = useMemo(() => demoBars(), []);
  const bars = source === 'demo' ? demo : upload || [];
  const [settings, setSettings] = useState<Settings>({
    start: '2026-08-06',
    end: '2026-09-05',
    capital: 10000,
    spread: 0.3,
    slippage: 0.05,
    commission: 0,
    source: 'Demostración sintética',
  });
  useEffect(() => {
    api('GET')
      .then((data) => {
        const s = data.filter((x) => x.kind === 'strategy').map((x) => x.data);
        setStrategies(s);
        setSelected(s.map((x: Strategy) => x.id));
        const history = data.filter((x) => x.kind === 'run').map((x) => x.data);
        setRuns(history);
        setActiveRun(history[0] || null);
        setDraft(s[0] || starter());
      })
      .catch((e) => {
        setMessage(e.message);
        setDraft(starter());
      })
      .finally(() => setLoading(false));
  }, []);
  function preset(months: string, data: Bar[] = bars) {
    setPeriod(months);
    if (months === 'custom' || !data.length) return;
    const last = new Date(data.at(-1)!.time);
    const end = date(last.getTime());
    last.setUTCDate(1);
    last.setUTCMonth(last.getUTCMonth() - Number(months));
    const originalDay = new Date(data.at(-1)!.time).getUTCDate();
    last.setUTCDate(
      Math.min(
        originalDay,
        new Date(
          Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    );
    last.setUTCDate(last.getUTCDate() + 1);
    setSettings((s) => ({ ...s, start: date(last.getTime()), end }));
  }
  function edit(patch: Partial<Strategy>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  async function save() {
    if (!draft) return;
    try {
      validateStrategy(draft);
      setSaving(true);
      const old = strategies.find((x) => x.id === draft.id);
      const saved = {
        ...draft,
        name: draft.name.trim(),
        version: old ? old.version + 1 : 1,
      };
      await api('POST', { id: saved.id, kind: 'strategy', data: saved });
      setStrategies((s) => [saved, ...s.filter((x) => x.id !== saved.id)]);
      setSelected((s) => (s.includes(saved.id) ? s : [...s, saved.id]));
      setDraft(saved);
      setMessage('Estrategia guardada. Lista para probar.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function deleteStrategy() {
    if (!remove) return;
    try {
      await api('DELETE', undefined, remove);
      setStrategies((s) => s.filter((x) => x.id !== remove));
      setSelected((s) => s.filter((x) => x !== remove));
      if (draft?.id === remove) setDraft(starter());
      setMessage('Estrategia eliminada. Sus pruebas anteriores se conservan.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setRemove(null);
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 15000000) throw Error('El archivo supera 15 MB.');
      const b = parseCSV(await file.text());
      setUpload(b);
      setFilename(file.name);
      setSource('csv');
      preset(period, b);
      setMessage(
        `${b.length.toLocaleString()} velas importadas. Confirma que son XAUUSD H1 y están en UTC.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function run() {
    const chosen = strategies.filter((s) => selected.includes(s.id));
    if (!chosen.length) {
      setMessage('Guarda y selecciona al menos una estrategia.');
      return;
    }
    if (!bars.length) {
      setMessage('Importa primero un archivo CSV.');
      return;
    }
    if (chosen.length > 30) {
      setMessage('Selecciona hasta 30 estrategias por lote.');
      return;
    }
    setBusy(true);
    setProgress(0);
    setMessage('');
    const results: Result[] = [],
      errors: string[] = [];
    const config = {
      ...settings,
      source: source === 'demo' ? 'Demostración sintética' : filename,
    };
    for (let i = 0; i < chosen.length; i++) {
      await new Promise((r) => setTimeout(r, 20));
      try {
        results.push(backtest(bars, chosen[i], config));
      } catch (e) {
        errors.push(chosen[i].name + ': ' + (e as Error).message);
      }
      setProgress(((i + 1) / chosen.length) * 100);
    }
    results.sort((a, b) => b.net - a.net);
    const record: Run = {
      id: createId(),
      created: new Date().toISOString(),
      results,
      errors,
      source: config.source,
    };
    setActiveRun(record);
    setDetail(0);
    setPage(0);
    try {
      if (results.length) {
        const compact = {
          ...record,
          results: results.map((r) => ({
            ...r,
            curve: r.curve.filter(
              (_, i) =>
                i % Math.max(1, Math.ceil(r.curve.length / 400)) === 0 ||
                i === r.curve.length - 1,
            ),
          })),
        };
        await api('POST', { id: record.id, kind: 'run', data: compact });
        setRuns((s) => [compact, ...s]);
        setMessage(
          `${results.length} estrategias probadas y resultados guardados.${errors.length ? ' Algunas pruebas requieren revisar el período.' : ''}`,
        );
      } else
        setMessage('No se pudo completar ninguna prueba. Revisa los detalles.');
    } catch (e) {
      setMessage(
        'Pruebas calculadas, pero no guardadas: ' + (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!result) return;
    const csv =
      'entrada_utc,salida_utc,direccion,precio_entrada,precio_salida,onzas,pnl_usd,motivo\n' +
      result.trades
        .map((t) =>
          [
            stamp(t.entryTime),
            stamp(t.exitTime),
            t.side === 1 ? 'BUY' : 'SELL',
            t.entry,
            t.exit,
            t.quantity,
            t.pnl,
            t.reason,
          ].join(','),
        )
        .join('\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aurum-operaciones.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  const result = activeRun?.results[detail];
  return (
    <main className="workspace">
      <header>
        <div className="brand">
          ◈ <strong>AURUM</strong>
          <span>STRATEGY LAB</span>
        </div>
        <div className="header-right">
          <span className="badge">
            <span className="dot" /> Laboratorio · sin ejecución real
          </span>
          <span className="badge gold">XAUUSD</span>
        </div>
      </header>
      <section className="heading">
        <div>
          <p className="eyebrow">INVESTIGACIÓN / ORO</p>
          <h1>Tu ventaja empieza con una prueba.</h1>
          <p>Construye reglas, recorre el histórico y compara la evidencia.</p>
        </div>
        <div className="asset">
          <span>Au</span>
          <div>
            <strong>Oro / Dólar</strong>
            <p>XAUUSD · USD por onza</p>
          </div>
        </div>
      </section>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="main-tabs" variant="line">
          <TabsTrigger value="strategies">
            <Layers3 size={17} /> Estrategias <small>{strategies.length}</small>
          </TabsTrigger>
          <TabsTrigger value="backtest">
            <FlaskConical size={17} /> Backtesting
          </TabsTrigger>
          <TabsTrigger value="history">
            <Activity size={17} /> Historial
          </TabsTrigger>
        </TabsList>
        {message && (
          <output className="notice">
            {message}
            <button onClick={() => setMessage('')} aria-label="Cerrar mensaje">
              ×
            </button>
          </output>
        )}
        <TabsContent value="strategies">
          <div className="editor-grid">
            <section className="library panel">
              <div className="section-top">
                <h2>Mis estrategias</h2>
                <button
                  className="icon-button"
                  aria-label="Nueva estrategia"
                  onClick={() => setDraft(starter())}
                >
                  <Plus size={18} />
                </button>
              </div>
              {loading ? (
                <p>Cargando estrategias…</p>
              ) : !strategies.length ? (
                <div className="empty">
                  <Layers3 size={30} />
                  <h3>Tu primera hipótesis</h3>
                  <p>
                    Configura las condiciones y guarda una estrategia para
                    empezar.
                  </p>
                </div>
              ) : (
                strategies.map((s) => (
                  <button
                    key={s.id}
                    className={
                      'strategy-card ' + (draft?.id === s.id ? 'active' : '')
                    }
                    onClick={() => setDraft(structuredClone(s))}
                  >
                    <div>
                      <span className="mini-label">
                        {s.timeframe} · V{s.version}
                      </span>
                      <ChevronRight size={16} />
                    </div>
                    <strong>{s.name}</strong>
                    <p>
                      {s.rules.map((r) => r.kind.toUpperCase()).join(' + ')}
                    </p>
                    <span className="mini-label">
                      {s.direction === 'both'
                        ? 'Compra y venta'
                        : s.direction === 'long'
                          ? 'Solo compra'
                          : 'Solo venta'}{' '}
                      · {s.rr} R
                    </span>
                  </button>
                ))
              )}
              <div className="templates">
                <span className="mini-label">EMPEZAR CON UNA PLANTILLA</span>
                {[
                  'Tendencia con EMA',
                  'Reversión con RSI',
                  'Ruptura de estructura',
                ].map((t, i) => (
                  <button key={t} onClick={() => setDraft(starter(i))}>
                    <Plus size={15} />
                    {t}
                  </button>
                ))}
              </div>
            </section>
            <section className="panel editor">
              {draft && (
                <>
                  <div className="section-top">
                    <div>
                      <span className="mini-label">CONSTRUCTOR</span>
                      <h2>
                        {strategies.some((s) => s.id === draft.id)
                          ? 'Editar estrategia'
                          : 'Nueva estrategia'}
                      </h2>
                    </div>
                    <button
                      className="primary"
                      onClick={save}
                      disabled={saving || loading}
                    >
                      <Save size={16} />
                      {saving ? 'Guardando…' : 'Guardar estrategia'}
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field wide">
                      <span>Nombre</span>
                      <input
                        maxLength={80}
                        value={draft.name}
                        onChange={(e) => edit({ name: e.target.value })}
                      />
                    </label>
                    <div className="field">
                      <span>Temporalidad</span>
                      <Choice
                        label="Temporalidad"
                        value={draft.timeframe}
                        options={[
                          ['H1', '1 hora'],
                          ['H4', '4 horas'],
                          ['D1', '1 día'],
                        ]}
                        onChange={(v) =>
                          edit({ timeframe: v as Strategy['timeframe'] })
                        }
                      />
                    </div>
                    <div className="field">
                      <span>Dirección</span>
                      <Choice
                        label="Dirección"
                        value={draft.direction}
                        options={[
                          ['both', 'Compra y venta'],
                          ['long', 'Solo compra'],
                          ['short', 'Solo venta'],
                        ]}
                        onChange={(v) =>
                          edit({ direction: v as Strategy['direction'] })
                        }
                      />
                    </div>
                  </div>
                  <div className="rule-heading">
                    <h3>Condiciones de entrada</h3>
                    <span className="badge">Todas deben cumplirse · AND</span>
                  </div>
                  {draft.rules.map((r, i) => (
                    <div className="rule" key={i}>
                      <div className="section-top">
                        <strong>
                          <span className="rule-number">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          {ruleNames[r.kind]}
                        </strong>
                        <button
                          className="icon-button"
                          aria-label={'Quitar condición ' + (i + 1)}
                          onClick={() =>
                            edit({
                              rules: draft.rules.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="rule-fields">
                        {r.kind !== 'fvg' && (
                          <NumberField
                            label={
                              ['ema', 'sma'].includes(r.kind)
                                ? 'Período rápido'
                                : 'Período'
                            }
                            value={r.period}
                            min={2}
                            max={200}
                            step={1}
                            onChange={(v) =>
                              edit({
                                rules: draft.rules.map((x, j) =>
                                  j === i ? { ...x, period: v } : x,
                                ),
                              })
                            }
                          />
                        )}
                        {['ema', 'sma'].includes(r.kind) && (
                          <NumberField
                            label="Período lento"
                            value={r.slow}
                            min={2}
                            max={400}
                            step={1}
                            onChange={(v) =>
                              edit({
                                rules: draft.rules.map((x, j) =>
                                  j === i ? { ...x, slow: v } : x,
                                ),
                              })
                            }
                          />
                        )}
                        {r.kind === 'rsi' && (
                          <NumberField
                            label="Sobreventa (compra)"
                            value={r.level}
                            min={1}
                            max={49}
                            step={1}
                            onChange={(v) =>
                              edit({
                                rules: draft.rules.map((x, j) =>
                                  j === i ? { ...x, level: v } : x,
                                ),
                              })
                            }
                          />
                        )}
                      </div>
                      <p>{description(r)}</p>
                    </div>
                  ))}
                  <div className="add-rule">
                    <Choice
                      label="Indicador a añadir"
                      value={newKind}
                      options={Object.entries(ruleNames)}
                      onChange={setNewKind}
                    />
                    <button
                      className="secondary"
                      disabled={draft.rules.length >= 6}
                      onClick={() =>
                        edit({
                          rules: [
                            ...draft.rules,
                            template(newKind as Rule['kind']),
                          ],
                        })
                      }
                    >
                      <Plus size={16} /> Añadir condición
                    </button>
                  </div>
                  <div className="rule-heading">
                    <h3>Salidas y tamaño de posición</h3>
                    <Settings2 size={17} />
                  </div>
                  <div className="form-grid three">
                    <NumberField
                      label="Stop loss · % del precio"
                      value={draft.stop}
                      min={0.01}
                      max={20}
                      onChange={(v) => edit({ stop: v })}
                    />
                    <NumberField
                      label="Objetivo · múltiplo R"
                      value={draft.rr}
                      min={0.1}
                      max={20}
                      onChange={(v) => edit({ rr: v })}
                    />
                    <NumberField
                      label="Riesgo máximo · % capital"
                      value={draft.risk}
                      min={0.01}
                      max={10}
                      onChange={(v) => edit({ risk: v })}
                    />
                  </div>
                  <p className="fine">
                    Señales al cierre; entrada en la apertura siguiente. Una
                    posición por estrategia. Cierre por stop, objetivo, señal
                    opuesta o fin de prueba. Exposición limitada a 1× el
                    capital, sin apalancamiento.
                  </p>
                  <div className="section-top bottom">
                    <span className="mini-label">
                      SMC: BOS y FVG definidos arriba; no incluye order blocks
                      ni CHoCH.
                    </span>
                    {strategies.some((s) => s.id === draft.id) && (
                      <button
                        className="danger"
                        onClick={() => setRemove(draft.id)}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </TabsContent>
        <TabsContent value="backtest">
          <div className="backtest-grid">
            <section className="panel config">
              <div className="section-top">
                <h2>Configurar prueba</h2>
                <FlaskConical size={19} />
              </div>
              <div className="field">
                <span>Fuente de datos</span>
                <Choice
                  label="Fuente de datos"
                  value={source}
                  options={[
                    ['demo', 'Demostración · datos sintéticos'],
                    ['csv', 'Histórico importado · CSV H1'],
                  ]}
                  onChange={(v) => {
                    setSource(v);
                    preset(period, v === 'demo' ? demo : upload || []);
                  }}
                />
              </div>
              {source === 'csv' && (
                <label className="upload">
                  <Upload size={18} />
                  <span>{filename || 'Importar CSV de XAUUSD H1'}</span>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={(e) =>
                      e.target.files?.[0] && importFile(e.target.files[0])
                    }
                  />
                </label>
              )}
              <p className="fine">
                {source === 'demo'
                  ? 'Serie ficticia para explorar el motor. No representa cotizaciones ni rentabilidad histórica de XAUUSD.'
                  : 'CSV: time,open,high,low,close; fechas ISO en UTC. DATE + TIME de MT5 también se acepta: convierte antes su horario a UTC. El archivo se procesa en esta sesión; no se almacena.'}
              </p>
              <div className="data-summary">
                <span>{bars.length.toLocaleString()} velas H1</span>
                <span>
                  {bars.length
                    ? date(bars[0].time) + ' → ' + date(bars.at(-1)!.time)
                    : 'Sin datos'}
                </span>
              </div>
              <div className="field">
                <span>Período hasta el último dato disponible</span>
                <Choice
                  label="Período"
                  value={period}
                  options={[
                    ['1', 'Último mes'],
                    ['3', 'Últimos 3 meses'],
                    ['6', 'Últimos 6 meses'],
                    ['12', 'Últimos 12 meses'],
                    ['custom', 'Fechas específicas'],
                  ]}
                  onChange={(v) => preset(v)}
                />
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Desde · UTC</span>
                  <input
                    type="date"
                    value={settings.start}
                    onChange={(e) => {
                      setPeriod('custom');
                      setSettings((s) => ({ ...s, start: e.target.value }));
                    }}
                  />
                </label>
                <label className="field">
                  <span>Hasta · UTC</span>
                  <input
                    type="date"
                    value={settings.end}
                    onChange={(e) => {
                      setPeriod('custom');
                      setSettings((s) => ({ ...s, end: e.target.value }));
                    }}
                  />
                </label>
              </div>
              <NumberField
                label="Capital inicial · USD por estrategia"
                value={settings.capital}
                min={100}
                step={100}
                onChange={(v) => setSettings((s) => ({ ...s, capital: v }))}
              />
              <div className="form-grid">
                <NumberField
                  label="Spread · USD/onza"
                  value={settings.spread}
                  step={0.01}
                  onChange={(v) => setSettings((s) => ({ ...s, spread: v }))}
                />
                <NumberField
                  label="Deslizamiento · USD/onza/lado"
                  value={settings.slippage}
                  step={0.01}
                  onChange={(v) => setSettings((s) => ({ ...s, slippage: v }))}
                />
              </div>
              <NumberField
                label="Comisión · USD/onza/lado"
                value={settings.commission}
                step={0.01}
                onChange={(v) => setSettings((s) => ({ ...s, commission: v }))}
              />
              <p className="fine">
                Costos constantes configurables; no son tarifas verificadas de
                Exness. Sin swap. Tamaño en onzas fraccionarias, sin
                restricciones de lotaje del bróker.
              </p>
              <h3 className="spaced">Estrategias guardadas</h3>
              {!strategies.length ? (
                <p>Guarda primero una estrategia en el constructor.</p>
              ) : (
                strategies.map((s) => (
                  <label className="check-row" key={s.id}>
                    <Checkbox
                      checked={selected.includes(s.id)}
                      onCheckedChange={(checked) =>
                        setSelected((ids) =>
                          checked
                            ? [...ids, s.id]
                            : ids.filter((x) => x !== s.id),
                        )
                      }
                    />
                    <span>
                      {s.name}
                      <small>
                        {s.timeframe} · V{s.version}
                      </small>
                    </span>
                  </label>
                ))
              )}
              <button
                className="primary run-button"
                disabled={busy || !selected.length || !bars.length}
                onClick={run}
              >
                <Play size={17} />
                {busy
                  ? 'Probando estrategias…'
                  : `Probar ${selected.length} estrategia${selected.length === 1 ? '' : 's'}`}
              </button>
              {busy && (
                <Progress value={progress} aria-label="Avance de las pruebas" />
              )}
              <p className="fine">
                Se ejecutan todas las seleccionadas automáticamente, una por
                una, al iniciar la prueba.
              </p>
            </section>
            <section>
              {!activeRun ? (
                <div className="panel result-empty">
                  <div className="empty-chart">
                    <TrendingUp size={68} />
                  </div>
                  <span className="eyebrow">PRIMERO LA EVIDENCIA</span>
                  <h2>Una comparación. Las mismas condiciones.</h2>
                  <p>
                    Selecciona tus estrategias y ejecuta la prueba.
                    <br />
                    Aquí aparecerán la curva de capital y cada operación.
                  </p>
                  <div className="empty-metrics">
                    <span>Beneficio neto</span>
                    <span>Drawdown</span>
                    <span>Operaciones</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="panel">
                    <div className="section-top">
                      <div>
                        <span className="mini-label">
                          COMPARACIÓN · PRUEBAS INDEPENDIENTES
                        </span>
                        <h2>Resultados del lote</h2>
                      </div>
                      <span
                        className={
                          'badge ' +
                          (activeRun.source === 'Demostración sintética'
                            ? 'gold'
                            : '')
                        }
                      >
                        {activeRun.source === 'Demostración sintética'
                          ? 'DEMO · SINTÉTICO'
                          : 'CSV IMPORTADO'}
                      </span>
                    </div>
                    <p className="fine">
                      {activeRun.source} ·{' '}
                      {new Date(activeRun.created).toLocaleString('es-BO')}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estrategia</TableHead>
                          <TableHead>Neto</TableHead>
                          <TableHead>Drawdown*</TableHead>
                          <TableHead>Operaciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeRun.results.map((r, i) => (
                          <TableRow
                            key={r.strategy.id}
                            data-state={detail === i ? 'selected' : undefined}
                          >
                            <TableCell>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setDetail(i);
                                  setPage(0);
                                }}
                              >
                                {r.strategy.name} <ArrowUpRight size={14} />
                              </button>
                            </TableCell>
                            <TableCell
                              className={r.net >= 0 ? 'positive' : 'negative'}
                            >
                              {money(r.net)}
                            </TableCell>
                            <TableCell>{r.drawdown.toFixed(2)}%</TableCell>
                            <TableCell>{r.trades.length}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {activeRun.errors.map((e) => (
                      <p className="error" key={e}>
                        {e}
                      </p>
                    ))}
                  </div>
                  {result && (
                    <>
                      <div className="metrics">
                        <div>
                          <span>Beneficio neto</span>
                          <strong
                            className={
                              result.net >= 0 ? 'positive' : 'negative'
                            }
                          >
                            {money(result.net)}
                          </strong>
                          <small>
                            {(
                              (result.net / result.settings.capital) *
                              100
                            ).toFixed(2)}
                            % del capital
                          </small>
                        </div>
                        <div>
                          <span>Aciertos</span>
                          <strong>
                            {result.trades.length
                              ? result.winRate.toFixed(1) + '%'
                              : '—'}
                          </strong>
                          <small>{result.trades.length} operaciones</small>
                        </div>
                        <div>
                          <span>Profit factor</span>
                          <strong>
                            {result.profitFactor === null
                              ? '—'
                              : result.profitFactor.toFixed(2)}
                          </strong>
                          <small>
                            {result.profitFactor === null
                              ? 'Sin pérdidas o sin operaciones'
                              : 'Ganancia bruta / pérdida bruta'}
                          </small>
                        </div>
                      </div>
                      <div className="panel">
                        <div className="section-top">
                          <div>
                            <span className="mini-label">
                              CURVA DE CAPITAL · USD
                            </span>
                            <h2>{result.strategy.name}</h2>
                          </div>
                          <span className="badge">
                            {result.strategy.timeframe} · V
                            {result.strategy.version}
                          </span>
                        </div>
                        <Curve result={result} />
                        <p className="fine">
                          {result.bars} velas evaluadas · {date(result.start)} —{' '}
                          {date(result.end)} · capital{' '}
                          {money(result.settings.capital)} · spread{' '}
                          {result.settings.spread} · deslizamiento{' '}
                          {result.settings.slippage} · comisión{' '}
                          {result.settings.commission}. Todos los costos por
                          onza; deslizamiento y comisión por lado.
                        </p>
                        <p className="fine">
                          *Drawdown estimado con capital flotante y extremos de
                          velas mientras la posición sigue abierta. Si stop y
                          objetivo coinciden en una vela, se aplica primero el
                          stop. Los gaps pueden superar el riesgo previsto.
                          Resultados históricos o sintéticos, sin validación
                          fuera de muestra.
                        </p>
                      </div>
                      <div className="panel">
                        <div className="section-top">
                          <h2>Registro de operaciones</h2>
                          <button className="secondary" onClick={download}>
                            <Download size={15} /> CSV
                          </button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Entrada / salida UTC</TableHead>
                              <TableHead>Lado</TableHead>
                              <TableHead>Precios</TableHead>
                              <TableHead>P&amp;L</TableHead>
                              <TableHead>Salida</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.trades
                              .slice(page * 15, page * 15 + 15)
                              .map((t, i) => (
                                <TableRow key={i}>
                                  <TableCell>
                                    {stamp(t.entryTime)}
                                    <small className="block">
                                      {stamp(t.exitTime)}
                                    </small>
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={
                                        t.side === 1 ? 'positive' : 'negative'
                                      }
                                    >
                                      {t.side === 1 ? 'BUY' : 'SELL'}
                                    </span>
                                    <small className="block">
                                      {t.quantity.toFixed(3)} oz
                                    </small>
                                  </TableCell>
                                  <TableCell>
                                    {t.entry.toFixed(2)}
                                    <small className="block">
                                      {t.exit.toFixed(2)}
                                    </small>
                                  </TableCell>
                                  <TableCell
                                    className={
                                      t.pnl >= 0 ? 'positive' : 'negative'
                                    }
                                  >
                                    {money(t.pnl)}
                                  </TableCell>
                                  <TableCell>{t.reason}</TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                        {!result.trades.length && (
                          <p>
                            No hubo señales que cumplieran todas las
                            condiciones.
                          </p>
                        )}
                        <div className="section-top bottom">
                          <button
                            className="secondary"
                            disabled={page === 0}
                            onClick={() => setPage((p) => p - 1)}
                          >
                            Anterior
                          </button>
                          <span className="fine">
                            {page + 1} /{' '}
                            {Math.max(1, Math.ceil(result.trades.length / 15))}
                          </span>
                          <button
                            className="secondary"
                            disabled={(page + 1) * 15 >= result.trades.length}
                            onClick={() => setPage((p) => p + 1)}
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        </TabsContent>
        <TabsContent value="history">
          <section className="panel">
            <div className="section-top">
              <h2>Historial de pruebas</h2>
              <span className="badge">
                Configuraciones conservadas por prueba
              </span>
            </div>
            {!runs.length ? (
              <div className="empty">
                <Activity size={32} />
                <h3>Todavía no hay pruebas guardadas</h3>
                <p>Los lotes completados aparecerán aquí.</p>
              </div>
            ) : (
              runs.map((r) => (
                <button
                  className="history-row"
                  key={r.id}
                  onClick={() => {
                    setActiveRun(r);
                    setDetail(0);
                    setPage(0);
                    setTab('backtest');
                  }}
                >
                  <div>
                    <strong>
                      {new Date(r.created).toLocaleString('es-BO')}
                    </strong>
                    <p>
                      {r.source} · {r.results.length} estrategias ·{' '}
                      {r.results[0]?.settings.start} —{' '}
                      {r.results[0]?.settings.end}
                    </p>
                  </div>
                  <ArrowUpRight size={20} />
                </button>
              ))
            )}
          </section>
        </TabsContent>
      </Tabs>
      <footer>
        <span>AURUM / RESEARCH WORKSPACE</span>
        <span>MVP · Reglas deterministas · Sin conexión a cuentas reales</span>
      </footer>
      <AlertDialog open={!!remove} onOpenChange={(v) => !v && setRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta estrategia?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina la configuración guardada. Sus resultados históricos se
              conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteStrategy}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
