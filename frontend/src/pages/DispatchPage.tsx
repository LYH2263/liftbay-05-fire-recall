import { useEffect, useState } from "react";
import { api } from "../api/client";
type B = { id: number; recall_active: boolean };
type Call = { id: number; building_id: number; floor: number; direction: string; passengers: number; status: string; score: string; assigned_car_id: number | null };
const DIR_TEXT: Record<string, string> = { up: "上行", down: "下行" };
export default function DispatchPage() {
  const [rows, setRows] = useState<Call[]>([]);
  const [recallIds, setRecallIds] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const reload = () => {
    api<Call[]>("/calls").then(setRows);
    api<B[]>("/buildings").then(bs => setRecallIds(new Set(bs.filter(b => b.recall_active).map(b => b.id))));
  };
  useEffect(() => { reload(); const t = setInterval(reload, 6000); return () => clearInterval(t); }, []);
  async function run(id: number) {
    setMsg(""); setErr("");
    try {
      const c = await api<Call>("/dispatch", { method: "POST", body: JSON.stringify({ call_id: id }) });
      setMsg(`呼梯 #${c.id} → 轿厢 ${c.assigned_car_id}，评分 ${c.score}`);
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); reload(); }
  }
  const active = rows.filter(r => r.status === "waiting" || r.status === "frozen");
  const anyRecall = recallIds.size > 0;
  return (<>
    <h2>派工</h2>
    {anyRecall && <div className="recall-banner">🚒 消防召回中：冻结呼梯派工一律拒绝，解除召回后恢复。</div>}
    {msg && <div className="ok">{msg}</div>}
    {err && <div className="err">{err}</div>}
    <table className="table"><thead><tr><th>呼梯</th><th>楼层</th><th>方向</th><th>人数</th><th>状态</th><th></th></tr></thead>
    <tbody>{active.map(c => {
      const frozen = c.status === "frozen" || recallIds.has(c.building_id);
      return <tr key={c.id} className={c.status === "frozen" ? "row-frozen" : ""}><td>#{c.id}</td><td>{c.floor}</td><td>{DIR_TEXT[c.direction] ?? c.direction}</td><td>{c.passengers}</td>
      <td>{c.status === "frozen" ? "冻结（召回）" : "待派"}</td>
      <td><button disabled={frozen} onClick={() => run(c.id)}>{c.status === "frozen" ? "召回冻结" : recallIds.has(c.building_id) ? "召回中" : "评分派轿厢"}</button></td></tr>;
    })}
      {!active.length && <tr><td colSpan={6}>暂无待派呼梯</td></tr>}
    </tbody></table>
  </>);
}
