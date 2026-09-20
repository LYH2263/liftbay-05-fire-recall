import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
type Car = { id: number; building_id: number; label: string; floor: number; direction: string; load: number; capacity: number };
type Call = { id: number; floor: number; status: string };
type B = { id: number; floors: number; recall_floor: number; recall_active: boolean };
const DIR_GLYPH: Record<string, string> = { up: "▲", down: "▼", idle: "●" };
export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [buildings, setBuildings] = useState<B[]>([]);
  useEffect(() => {
    const load = () => {
      api<Car[]>("/cars").then(setCars);
      api<Call[]>("/calls").then(setCalls);
      api<B[]>("/buildings").then(setBuildings);
    };
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);
  const callFloors = useMemo(() => new Set(calls.filter(c => c.status === "waiting").map(c => c.floor)), [calls]);
  const recallOn = buildings.some(b => b.recall_active);
  return (<>
    <h2>轿厢井道</h2>
    {recallOn && <div className="recall-banner">🚒 消防召回中：全部轿厢已清空载荷并撤至召回层，方向为撤至召回层所需方向。</div>}
    {buildings.map(b => {
      const floors = b.floors;
      const levels = Array.from({ length: floors }, (_, i) => i + 1);
      return <div key={b.id} className="car-group">
        <h3 className="car-group-title">
          召回层 {b.recall_floor}F
          {b.recall_active && <span className="recall-badge recall-badge--on">消防召回中</span>}
        </h3>
        <div className="shaft-wrap">
          {cars.filter(c => c.building_id === b.id).map(car => (
            <div className="shaft" key={car.id}>
              <h3>{car.label} · {car.load}/{car.capacity}</h3>
              {levels.map(f => (
                <div key={f} className={`floor-slot ${car.floor === f ? "has-car" : ""} ${callFloors.has(f) && !b.recall_active ? "has-call" : ""} ${f === b.recall_floor ? "is-recall-floor" : ""}`}>
                  {car.floor === f ? DIR_GLYPH[car.direction] ?? car.direction : (f === b.recall_floor ? `${f}★` : f)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>;
    })}
  </>);
}
