"""Fire recall: evacuate loads, send every car to the building recall floor and
freeze waiting calls until the recall is released."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import Building, CallTicket, DispatchLog, ElevatorCar
from app.services.dispatch_engine import direction_to

FROZEN = "frozen"
WAITING = "waiting"


def activate_recall(db: Session, building: Building) -> None:
    """Enter fire recall for a building.

    * all cars are emptied (load = 0), moved to the recall floor and pointed in
      the direction needed to get there;
    * every waiting call is frozen so dispatch must refuse it;
    * congestion only counts waiting calls, so frozen calls drop out.
    """
    if building.recall_active:
        return

    cars = db.scalars(
        select(ElevatorCar).where(ElevatorCar.building_id == building.id)
    ).all()
    for car in cars:
        car.load = 0
        car.direction = direction_to(car.floor, building.recall_floor)
        car.floor = building.recall_floor

    frozen = db.scalars(
        select(CallTicket).where(
            CallTicket.building_id == building.id,
            CallTicket.status == WAITING,
        )
    ).all()
    for ticket in frozen:
        ticket.status = FROZEN
        db.add(
            DispatchLog(
                call_id=ticket.id,
                car_id=None,
                detail=f"消防召回：呼梯冻结，全部轿厢撤至 {building.recall_floor}F",
            )
        )

    building.recall_active = True
    db.commit()


def release_recall(db: Session, building: Building) -> None:
    """Leave fire recall: frozen calls become waiting again and can be
    re-dispatched. Cars stay at the recall floor, empty."""
    if not building.recall_active:
        return

    frozen = db.scalars(
        select(CallTicket).where(
            CallTicket.building_id == building.id,
            CallTicket.status == FROZEN,
        )
    ).all()
    for ticket in frozen:
        ticket.status = WAITING
        db.add(
            DispatchLog(
                call_id=ticket.id,
                car_id=None,
                detail="解除消防召回：呼梯恢复待派",
            )
        )

    building.recall_active = False
    db.commit()
