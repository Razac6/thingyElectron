export const getSprints = async () => {
  try {
    const sprints = await window.electron.database.getSprints();
    return sprints;
  } catch (error) {
    console.error('Error fetching sprints:', error);
    throw error;
  }
};

export const createSprint = async (sprint: { name: string, startDate: string, endDate: string }) => {
  try {
    const newSprint = await window.electron.database.createSprint(sprint);
    return newSprint;
  } catch (error) {
    console.error('Error creating sprint:', error);
    throw error;
  }
};

export const updateSprint = async (sprint: any) => {
  try {
    const updated = await window.electron.database.updateSprint(sprint);
    return updated;
  } catch (error) {
    console.error('Error updating sprint:', error);
    throw error;
  }
};

export const updateSprintStatus = async (sprintId: number, status: string) => {
  try {
    const updatedSprint = await window.electron.database.updateSprintStatus(sprintId, status);
    return updatedSprint;
  } catch (error) {
    console.error('Error updating sprint status:', error);
    throw error;
  }
};
