import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta

try:
    from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
    HAS_MOTOR = True
except ImportError:
    HAS_MOTOR = False
    AsyncIOMotorClient = Any
    AsyncIOMotorDatabase = Any

from backend.core.config import settings
from backend.core.demo_data import (
    DEMO_PROJECTS,
    DEMO_TASKS,
    DEMO_EMPLOYEES,
    DEMO_SCHEDULES,
    DEMO_RECOMMENDATIONS,
    DEMO_ALERTS,
    DEMO_ACTIVITY,
    fallback_sessions,
    fallback_reset_tokens,
    fallback_audit,
    fallback_invitations,
    fallback_notifications,
    fallback_simulations,
    fallback_outcomes,
    fallback_workflows,
)

logger = logging.getLogger("bussologic.database")

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None
is_mongo_connected = False
seeded = False

def strip(doc: Any) -> Any:
    if not doc:
        return doc
    if isinstance(doc, dict):
        item = {k: v for k, v in doc.items() if k not in ("_id", "__v")}
        for k, v in item.items():
            if isinstance(v, datetime):
                item[k] = v.isoformat()
        return item
    return doc

def rows(items: List[Any]) -> List[Any]:
    return [strip(item) for item in items]

async def get_db() -> Optional[AsyncIOMotorDatabase]:
    global client, db, is_mongo_connected
    if not HAS_MOTOR:
        return None
    if is_mongo_connected and db is not None:
        return db
    try:
        if not client:
            client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=2000)
        # Ping database
        await client.admin.command('ping')
        try:
            db = client.get_default_database()
        except Exception:
            # Atlas URIs often have no /dbname. Without this the call raised, was swallowed below, and the app
            # silently ran on in-memory data while the monitor read an empty database.
            db = client[settings.MONGODB_DB]
        is_mongo_connected = True
        logger.info("[MongoDB] Connected to database %r", db.name)
        return db
    except Exception as e:
        is_mongo_connected = False
        logger.warning("[MongoDB] Connection unavailable (%s). Operating in robust in-memory fallback mode.", str(e))
        return None

def mongo_status() -> Dict[str, Any]:
    return {"connected": is_mongo_connected, "database": db.name if (is_mongo_connected and db is not None) else None,
            "mode": "mongodb" if is_mongo_connected else "in-memory-fallback"}

async def next_id(collection_name: str) -> int:
    database = await get_db()
    if database:
        col = database[collection_name]
        latest = await col.find_one(sort=[("id", -1)])
        return ((latest.get("id") or 0) + 1) if latest else 1
    # Fallback IDs
    if collection_name == "tasks":
        return max([t.get("id", 0) for t in DEMO_TASKS], default=0) + 1
    elif collection_name == "employees":
        return max([e.get("id", 0) for e in DEMO_EMPLOYEES], default=0) + 1
    elif collection_name == "projects":
        return max([p.get("id", 0) for p in DEMO_PROJECTS], default=0) + 1
    elif collection_name == "schedules":
        return max([s.get("id", 0) for s in DEMO_SCHEDULES], default=0) + 1
    elif collection_name == "recommendations":
        return max([r.get("id", 0) for r in DEMO_RECOMMENDATIONS], default=0) + 1
    elif collection_name == "alerts":
        return max([a.get("id", 0) for a in DEMO_ALERTS], default=0) + 1
    elif collection_name == "workflows":
        return max([w.get("id", 0) for w in fallback_workflows], default=0) + 1
    return int(datetime.now(timezone.utc).timestamp() * 1000) % 1000000

async def ensure_seed():
    global seeded
    if seeded:
        return
    database = await get_db()
    if database:
        try:
            # Check if collections already have documents
            existing = await database["projects"].count_documents({})
            if existing == 0:
                from backend.core.auth import hash_password
                employees_to_seed = []
                for emp in DEMO_EMPLOYEES:
                    emp_copy = dict(emp)
                    emp_copy["passwordHash"] = hash_password("Welcome123!")
                    employees_to_seed.append(emp_copy)
                
                await database["projects"].insert_many(DEMO_PROJECTS)
                await database["tasks"].insert_many(DEMO_TASKS)
                await database["employees"].insert_many(employees_to_seed)
                await database["schedules"].insert_many(DEMO_SCHEDULES)
                await database["recommendations"].insert_many(DEMO_RECOMMENDATIONS)
                await database["alerts"].insert_many(DEMO_ALERTS)
                await database["activities"].insert_many(DEMO_ACTIVITY)
                logger.info("[MongoDB] Seeded demo collections successfully.")
        except Exception as e:
            logger.warning("[MongoDB] Seeding error: %s", str(e))
    seeded = True

# Data accessor methods matching original API expectations
async def get_dashboard_data() -> Dict[str, Any]:
    await ensure_seed()
    database = await get_db()
    if database is None:
        return {
            "projects": DEMO_PROJECTS,
            "tasks": DEMO_TASKS,
            "recommendations": DEMO_RECOMMENDATIONS,
            "alerts": [a for a in DEMO_ALERTS if a.get("resolved") != 1],
            "activity": DEMO_ACTIVITY
        }
    try:
        projects = await database["projects"].find().sort("updatedAt", -1).to_list(100)
        tasks = await database["tasks"].find().sort("updatedAt", -1).to_list(200)
        recs = await database["recommendations"].find().sort("createdAt", -1).to_list(50)
        alerts = await database["alerts"].find({"resolved": 0}).sort("createdAt", -1).to_list(50)
        acts = await database["activities"].find().sort("createdAt", -1).to_list(15)
        return {
            "projects": rows(projects),
            "tasks": rows(tasks),
            "recommendations": rows(recs),
            "alerts": rows(alerts),
            "activity": rows(acts)
        }
    except Exception as e:
        logger.error("Error reading dashboard: %s", str(e))
        return {
            "projects": DEMO_PROJECTS,
            "tasks": DEMO_TASKS,
            "recommendations": DEMO_RECOMMENDATIONS,
            "alerts": [a for a in DEMO_ALERTS if a.get("resolved") != 1],
            "activity": DEMO_ACTIVITY
        }

async def get_people_data() -> Dict[str, Any]:
    await ensure_seed()
    database = await get_db()
    if database is None:
        return {
            "employees": DEMO_EMPLOYEES,
            "schedules": DEMO_SCHEDULES,
            "invitations": fallback_invitations
        }
    try:
        employees = await database["employees"].find().sort("name", 1).to_list(100)
        schedules = await database["schedules"].find().sort("date", -1).to_list(200)
        invitations = await database["invitations"].find().sort("createdAt", -1).to_list(50)
        clean_employees = []
        for emp in employees:
            c = strip(emp)
            if "passwordHash" in c:
                del c["passwordHash"]
            clean_employees.append(c)
        return {
            "employees": clean_employees if clean_employees else DEMO_EMPLOYEES,
            "schedules": rows(schedules) if schedules else DEMO_SCHEDULES,
            "invitations": rows(invitations)
        }
    except Exception as e:
        logger.error("Error reading people data: %s", str(e))
        return {
            "employees": DEMO_EMPLOYEES,
            "schedules": DEMO_SCHEDULES,
            "invitations": fallback_invitations
        }

async def get_tasks() -> List[Dict[str, Any]]:
    database = await get_db()
    if database is None:
        return DEMO_TASKS
    tasks = await database["tasks"].find().sort("id", 1).to_list(500)
    return rows(tasks)

async def update_task_status(task_id: int, status: str) -> Optional[Dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    database = await get_db()
    if database is None:
        for t in DEMO_TASKS:
            if t.get("id") == task_id:
                t["status"] = status
                t["updatedAt"] = now
                return t
        return None
    res = await database["tasks"].find_one_and_update(
        {"id": task_id},
        {"$set": {"status": status, "updatedAt": now}},
        return_document=True
    )
    return strip(res)

async def create_task(task_data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    t_id = await next_id("tasks")
    new_task = {
        "id": t_id,
        "projectId": task_data.get("projectId", 1),
        "title": task_data.get("title", "Untitled task"),
        "assignee": task_data.get("assignee", "Unassigned"),
        "stage": task_data.get("stage", "General"),
        "status": task_data.get("status", "todo"),
        "priority": task_data.get("priority", "medium"),
        "dueAt": task_data.get("dueAt", (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()),
        "estimatedHours": task_data.get("estimatedHours", 4),
        "actualHours": task_data.get("actualHours", 0),
        "createdAt": now,
        "updatedAt": now
    }
    database = await get_db()
    if database is None:
        DEMO_TASKS.append(new_task)
        return new_task
    await database["tasks"].insert_one(dict(new_task))
    return new_task

async def get_projects() -> List[Dict[str, Any]]:
    database = await get_db()
    if database is None:
        return DEMO_PROJECTS
    projects = await database["projects"].find().sort("id", 1).to_list(200)
    return rows(projects)

async def create_project(project_data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    p_id = await next_id("projects")
    new_proj = {
        "id": p_id,
        "name": project_data.get("name", "New Project"),
        "description": project_data.get("description", ""),
        "status": project_data.get("status", "active"),
        "progress": project_data.get("progress", 0),
        "ownerName": project_data.get("ownerName", "Maya Chen"),
        "dueAt": project_data.get("dueAt", (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()),
        "createdAt": now,
        "updatedAt": now
    }
    database = await get_db()
    if database is None:
        DEMO_PROJECTS.append(new_proj)
        return new_proj
    await database["projects"].insert_one(dict(new_proj))
    return new_proj

async def resolve_alert(alert_id: int) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    database = await get_db()
    if database is None:
        for a in DEMO_ALERTS:
            if a.get("id") == alert_id:
                a["resolved"] = 1
                a["updatedAt"] = now
        return True
    await database["alerts"].update_one({"id": alert_id}, {"$set": {"resolved": 1, "updatedAt": now}})
    return True

async def create_employee(emp_data: Dict[str, Any]) -> Dict[str, Any]:
    from backend.core.auth import hash_password
    now = datetime.now(timezone.utc).isoformat()
    e_id = await next_id("employees")
    new_emp = {
        "id": e_id,
        "name": emp_data["name"],
        "email": emp_data["email"].lower().strip(),
        "role": emp_data.get("role", "employee"),
        "department": emp_data["department"],
        "roleTitle": emp_data["roleTitle"],
        "capacityHours": int(emp_data.get("capacityHours", 40)),
        "availability": "available",
        "skills": emp_data.get("skills", ""),
        "managerName": emp_data.get("managerName", "Maya Chen"),
        "createdAt": now,
        "passwordHash": hash_password("Welcome123!")
    }
    database = await get_db()
    if database is None:
        DEMO_EMPLOYEES.append(new_emp)
        clean = dict(new_emp)
        del clean["passwordHash"]
        return clean
    await database["employees"].insert_one(dict(new_emp))
    clean = dict(new_emp)
    del clean["passwordHash"]
    return clean

async def update_employee_role(employee_id: int, role: str) -> Optional[Dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    database = await get_db()
    if database is None:
        for emp in DEMO_EMPLOYEES:
            if emp.get("id") == employee_id:
                emp["role"] = role
                clean = dict(emp)
                if "passwordHash" in clean:
                    del clean["passwordHash"]
                return clean
        return None
    res = await database["employees"].find_one_and_update(
        {"id": employee_id},
        {"$set": {"role": role, "updatedAt": now}},
        return_document=True
    )
    clean = strip(res)
    if clean and "passwordHash" in clean:
        del clean["passwordHash"]
    return clean

async def create_schedule(sched_data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    s_id = await next_id("schedules")
    new_sched = {
        "id": s_id,
        "employeeId": int(sched_data["employeeId"]),
        "date": sched_data["date"],
        "startTime": sched_data["startTime"],
        "endTime": sched_data["endTime"],
        "type": sched_data["type"],
        "note": sched_data.get("note", ""),
        "createdAt": now
    }
    database = await get_db()
    if database is None:
        DEMO_SCHEDULES.append(new_sched)
        return new_sched
    await database["schedules"].insert_one(dict(new_sched))
    return new_sched

async def create_invitation(invite_data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    i_id = await next_id("invitations")
    new_invite = {
        "id": i_id,
        "email": invite_data["email"].lower().strip(),
        "role": invite_data["role"],
        "department": invite_data["department"],
        "roleTitle": invite_data.get("roleTitle", ""),
        "invitedBy": invite_data.get("invitedBy", "Maya Chen"),
        "status": "pending",
        "createdAt": now
    }
    database = await get_db()
    if database is None:
        fallback_invitations.append(new_invite)
        return new_invite
    await database["invitations"].insert_one(dict(new_invite))
    return new_invite

async def create_notification(notif_data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    n_id = await next_id("notifications")
    new_notif = {
        "id": n_id,
        "employeeEmail": notif_data["employeeEmail"],
        "title": notif_data["title"],
        "body": notif_data["body"],
        "channel": notif_data.get("channel", "in_app"),
        "createdAt": now
    }
    database = await get_db()
    if database is None:
        fallback_notifications.append(new_notif)
        return new_notif
    await database["notifications"].insert_one(dict(new_notif))
    return new_notif

async def record_audit(actor: Optional[Dict[str, Any]], action: str, entity_type: str, entity_id: Optional[int], detail: str, metadata: Any = None) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": int(datetime.now(timezone.utc).timestamp() * 1000),
        "actorId": actor.get("id", 0) if actor else 0,
        "actorName": actor.get("name", "System") if actor else "System",
        "actorRole": actor.get("role", "system") if actor else "system",
        "action": action,
        "entityType": entity_type,
        "entityId": entity_id,
        "detail": detail,
        "metadata": metadata or {},
        "createdAt": now
    }
    database = await get_db()
    if database is None:
        fallback_audit.insert(0, entry)
        return entry
    await database["audit_logs"].insert_one(dict(entry))
    return entry

async def get_audit_logs(limit: int = 100) -> List[Dict[str, Any]]:
    database = await get_db()
    if database is None:
        return fallback_audit[:limit]
    logs = await database["audit_logs"].find().sort("createdAt", -1).to_list(limit)
    return rows(logs)
