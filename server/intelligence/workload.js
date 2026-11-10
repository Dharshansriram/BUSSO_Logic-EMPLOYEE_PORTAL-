const clamp = (value, min = 0, max = 150) =>
  Math.max(min, Math.min(max, Math.round(value)));

export function calculateWorkload(employees, tasks) {
  return employees.map(employee => {
    const assigned = tasks.filter(
      task => task.assignee === employee.name && task.status !== "done"
    );
    const plannedHours = assigned.reduce(
      (sum, task) => sum + (Number(task.estimatedHours) || 4),
      0
    );
    const capacity = Number(employee.capacityHours) || 40;
    const utilization = clamp(
      (plannedHours / Math.max(1, capacity)) * 100,
      0,
      150
    );

    let efficiency = 100;
    if (assigned.length && plannedHours > 0) {
      const excess = assigned.reduce(
        (sum, task) =>
          sum +
          Math.max(
            0,
            (Number(task.actualHours) || 0) - (Number(task.estimatedHours) || 4)
          ),
        0
      );
      efficiency = Math.max(
        0,
        Math.min(
          100,
          Math.round(100 - (excess / Math.max(1, plannedHours)) * 100)
        )
      );
    }

    const { passwordHash, inviteTokenHash, ...safe } = employee;
    return {
      ...safe,
      assignedTasks: assigned.length,
      plannedHours: Math.round(plannedHours * 10) / 10,
      utilization,
      efficiency,
      loadBand:
        utilization >= 90
          ? "overloaded"
          : utilization <= 45
            ? "underused"
            : "balanced",
    };
  });
}
