from app.models.models import Building, CallTicket, ElevatorCar
from app.services.dispatch_engine import direction_to


def _seed(db):
    b = Building(name="测试楼", floors=18, recall_floor=1)
    db.add(b)
    db.flush()
    cars = [
        ElevatorCar(building_id=b.id, label="T1", floor=3, direction="up", load=2, capacity=10),
        ElevatorCar(building_id=b.id, label="T2", floor=12, direction="down", load=4, capacity=10),
        ElevatorCar(building_id=b.id, label="T3", floor=8, direction="idle", load=8, capacity=8),
    ]
    db.add_all(cars)
    db.flush()
    calls = [
        CallTicket(building_id=b.id, floor=5, direction="up", passengers=2, status="waiting"),
        CallTicket(building_id=b.id, floor=14, direction="down", passengers=1, status="waiting"),
    ]
    db.add_all(calls)
    db.commit()
    return b, cars, calls


def test_direction_to():
    assert direction_to(3, 1) == "down"
    assert direction_to(12, 1) == "down"
    assert direction_to(1, 5) == "up"
    assert direction_to(1, 1) == "idle"


def test_recall_empties_cars_freezes_calls(client, db_session):
    b, cars, calls = _seed(db_session)

    r = client.post(f"/api/buildings/{b.id}/recall")
    assert r.status_code == 200
    data = r.json()
    assert data["recall_active"] is True
    assert data["recall_floor"] == 1

    db_session.expire_all()
    for car in db_session.query(ElevatorCar).all():
        assert car.load == 0
        assert car.floor == 1
    for ticket in db_session.query(CallTicket).all():
        assert ticket.status == "frozen"

    # entering again is a no-op and the building still reports recall active
    r = client.post(f"/api/buildings/{b.id}/recall")
    assert r.status_code == 200
    assert r.json()["recall_active"] is True


def test_dispatch_rejected_for_frozen_call(client, db_session):
    b, cars, calls = _seed(db_session)
    client.post(f"/api/buildings/{b.id}/recall")

    r = client.post("/api/dispatch", json={"call_id": calls[0].id})
    assert r.status_code == 409

    db_session.expire_all()
    ticket = db_session.get(CallTicket, calls[0].id)
    assert ticket.status == "frozen"  # rejected, but not consumed
    # cars stay empty on the recall floor after a refused dispatch
    for car in db_session.query(ElevatorCar).all():
        assert car.floor == 1
        assert car.load == 0


def test_new_call_blocked_during_recall(client, db_session):
    b, _, _ = _seed(db_session)
    client.post(f"/api/buildings/{b.id}/recall")

    r = client.post(
        "/api/calls",
        json={"building_id": b.id, "floor": 7, "direction": "up", "passengers": 1},
    )
    assert r.status_code == 409


def test_congestion_drops_to_zero_during_recall(client, db_session):
    b, _, calls = _seed(db_session)
    assert client.get("/api/congestion").json()  # 5F=2, 14F=1 before recall

    client.post(f"/api/buildings/{b.id}/recall")
    rows = client.get("/api/congestion").json()
    assert rows == []  # frozen tickets no longer count as waiting crowds


def test_release_restores_then_dispatchable_cars_at_recall_floor_empty(client, db_session):
    b, cars, calls = _seed(db_session)
    client.post(f"/api/buildings/{b.id}/recall")

    r = client.post(f"/api/buildings/{b.id}/recall/release")
    assert r.status_code == 200
    assert r.json()["recall_active"] is False

    db_session.expire_all()
    for ticket in db_session.query(CallTicket).all():
        assert ticket.status == "waiting"
    for car in db_session.query(ElevatorCar).all():
        assert car.floor == b.recall_floor
        assert car.load == 0  # load stays zero after release

    # original ticket can be dispatched again
    r = client.post("/api/dispatch", json={"call_id": calls[0].id})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "assigned"
    assert body["assigned_car_id"] is not None

    db_session.expire_all()
    ticket = db_session.get(CallTicket, calls[0].id)
    car = db_session.get(ElevatorCar, ticket.assigned_car_id)
    assert car.load == 2
    assert car.floor == 5
