import { useEffect, useState } from "react";
import { api } from "../api/client";
type B = { recall_active: boolean };
type C = { floor: number; passengers: number };
export default function CongestionPage() {
  const [rows, setRows] = useState<C[]>([]);
  const [recallOn, setRecallOn] = useState(false);
  useEffect(() => {
    const load = () => {
      api<C[]>("/congestion").then(setRows);
      api<B[]>("/buildings").then(bs => setRecallOn(bs.some(b => b.recall_active)));
    };
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);
  const max = Math.max(1, ...rows.map(r => r.passengers));
  return (<>
    <h2>拥堵</h2>
    {recallOn
      ? <div className="recall-banner">🚒 消防召回中：呼梯全部冻结，不计入拥堵，当前等待人数为 0。</div>
      : <p className="hint">仅统计 waiting 待派呼梯；召回冻结的呼梯不计入。</p>}
    <table className="table"><thead><tr><th>楼层</th><th>等待人数</th><th></th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.floor}><td className="mono">{r.floor}F</td><td>{r.passengers}</td>
      <td><div className="congestion-bar" style={{ width: `${(r.passengers / max) * 240}px` }} /></td></tr>)}
      {!rows.length && <tr><td colSpan={3}>{recallOn ? "召回冻结中，无等待拥堵" : "当前无等待拥堵"}</td></tr>}
    </tbody></table>
  </>);
}
