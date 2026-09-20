import { useEffect, useState } from "react";
import { api } from "../api/client";
type B = { id: number; name: string; floors: number; recall_active: boolean };
type Call = { id: number; floor: number; direction: string; passengers: number; status: string; assigned_car_id: number | null; score: string };
const STATUS_TEXT: Record<string, string> = { waiting: "待派", assigned: "已派", rejected: "已拒", frozen: "冻结（召回）" };
const DIR_TEXT: Record<string, string> = { up: "上行", down: "下行" };
export default function CallsPage() {
  const [buildings, setBuildings] = useState<B[]>([]);
  const [rows, setRows] = useState<Call[]>([]);
  const [bid, setBid] = useState<number | "">("");
  const [floor, setFloor] = useState(5);
  const [dir, setDir] = useState("up");
  const [pax, setPax] = useState(1);
  const [err, setErr] = useState("");
  const reload = () => api<Call[]>("/calls").then(setRows);
  useEffect(() => {
    api<B[]>("/buildings").then(b => { setBuildings(b); if (b[0]) setBid(b[0].id); });
    reload();
    const t = setInterval(reload, 6000);
    return () => clearInterval(t);
  }, []);
  const recallOn = buildings.some(b => b.id === bid && b.recall_active);
  async function create() {
    setErr("");
    try {
      await api("/calls", { method: "POST", body: JSON.stringify({ building_id: bid, floor, direction: dir, passengers: pax }) });
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  return (<>
    <h2>呼梯</h2>
    {recallOn && <div className="recall-banner">🚒 消防召回中：新呼梯暂停登记，待派呼梯已冻结，解除召回后自动恢复。</div>}
    <div className="toolbar">
      <select value={bid} onChange={e => setBid(Number(e.target.value))}>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <input type="number" value={floor} onChange={e => setFloor(Number(e.target.value))} style={{ width: 72 }} disabled={recallOn} />
      <select value={dir} onChange={e => setDir(e.target.value)} disabled={recallOn}><option value="up">上行</option><option value="down">下行</option></select>
      <input type="number" value={pax} min={1} onChange={e => setPax(Number(e.target.value))} style={{ width: 64 }} disabled={recallOn} />
      <button onClick={create} disabled={recallOn}>{recallOn ? "召回中禁止登记" : "登记呼梯"}</button>
    </div>
    {err && <div className="err">{err}</div>}
    <table className="table"><thead><tr><th>ID</th><th>楼层</th><th>方向</th><th>人数</th><th>状态</th><th>轿厢</th><th>评分</th></tr></thead>
    <tbody>{rows.map(c => <tr key={c.id} className={c.status === "frozen" ? "row-frozen" : ""}>
      <td>{c.id}</td><td className="mono">{c.floor}</td><td>{DIR_TEXT[c.direction] ?? c.direction}</td><td>{c.passengers}</td>
      <td>{STATUS_TEXT[c.status] ?? c.status}</td><td>{c.assigned_car_id ?? "—"}</td><td className="mono">{c.score || "—"}</td></tr>)}</tbody></table>
  </>);
}
