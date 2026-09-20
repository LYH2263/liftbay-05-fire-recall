import { useEffect, useState } from "react";
import { api } from "../api/client";
type B = { id: number; name: string; floors: number; recall_floor: number; recall_active: boolean };
export default function BuildingsPage() {
  const [rows, setRows] = useState<B[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const reload = () => api<B[]>("/buildings").then(setRows);
  useEffect(() => { reload(); }, []);
  async function toggle(b: B) {
    setErr("");
    setBusy(b.id);
    try {
      const path = b.recall_active ? "recall/release" : "recall";
      await api(`/buildings/${b.id}/${path}`, { method: "POST" });
      await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }
  return (<>
    <h2>楼栋</h2>
    {err && <div className="err">{err}</div>}
    <table className="table"><thead><tr><th>名称</th><th>楼层数</th><th>召回层</th><th>召回状态</th><th></th></tr></thead>
    <tbody>{rows.map(b => <tr key={b.id}>
      <td>{b.name}</td>
      <td className="mono">{b.floors}</td>
      <td className="mono">{b.recall_floor}F</td>
      <td>{b.recall_active
        ? <span className="recall-badge recall-badge--on">消防召回中</span>
        : <span className="recall-badge">正常</span>}</td>
      <td><button
        className={b.recall_active ? "btn-release" : "btn-recall"}
        disabled={busy === b.id}
        onClick={() => toggle(b)}>
        {b.recall_active ? "解除召回" : "一键召回"}
      </button></td>
    </tr>)}</tbody></table>
    <p className="hint">进入召回：全部轿厢清空载荷并撤至召回层，待派呼梯冻结、暂停登记；解除后冻结呼梯恢复待派。</p>
  </>);
}
