import asyncio
import json
import logging
from typing import Set
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from backend.core.auth import require_employee
from fastapi.responses import StreamingResponse

logger = logging.getLogger("bussologic.events")

router = APIRouter(prefix="", tags=["events"])

connected_clients: Set[asyncio.Queue] = set()

def broadcast_event(event_name: str, payload: dict):
    if not connected_clients:
        return
    message = f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"
    for queue in list(connected_clients):
        try:
            queue.put_nowait(message)
        except Exception:
            pass

@router.get("/events")
async def events_endpoint(current_employee: dict = Depends(require_employee)):
    queue = asyncio.Queue()
    connected_clients.add(queue)

    async def event_generator():
        # Initial connection packet
        initial = f"event: connected\ndata: {json.dumps({'at': datetime.now(timezone.utc).isoformat()})}\n\n"
        yield initial
        try:
            while True:
                msg = await queue.get()
                yield msg
        except asyncio.CancelledError:
            pass
        finally:
            connected_clients.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
