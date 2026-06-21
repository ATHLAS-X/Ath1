"""Generic task-status response builder shared by all three modules."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.common import TaskErrorDetail, TaskStatus, TaskStatusResponse

ResultLoader = Callable[[AsyncSession, Any], Awaitable[dict[str, Any] | None]]


async def build_status_response(
    session: AsyncSession,
    task: Any,
    result_loader: ResultLoader,
) -> TaskStatusResponse:
    """Render a task row as a TaskStatusResponse, attaching result/error as needed."""
    status = TaskStatus(task.status)
    resp = TaskStatusResponse(task_id=task.id, status=status)
    if status is TaskStatus.COMPLETE:
        resp.result = await result_loader(session, task)
    elif status is TaskStatus.FAILED:
        resp.error = TaskErrorDetail(
            code=task.error_code or "UNKNOWN",
            message=task.error_message or "Task failed",
        )
    return resp
