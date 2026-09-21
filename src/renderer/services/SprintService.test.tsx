// Mock window.electron BEFORE importing the service
// Now import the service after mocking
import {
  getSprints,
  createSprint,
  updateSprint,
  updateSprintStatus,
} from './SprintService';

const mockElectron = {
  database: {
    getSprints: jest.fn(),
    createSprint: jest.fn(),
    updateSprint: jest.fn(),
    updateSprintStatus: jest.fn(),
  },
};

Object.defineProperty(window, 'electron', {
  writable: true,
  configurable: true,
  value: mockElectron,
});

describe('SprintService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSprints', () => {
    it('should fetch sprints successfully', async () => {
      const mockSprints = [
        {
          id: 1,
          name: 'Sprint 1',
          startDate: '2024-01-01',
          endDate: '2024-01-14',
          status: 'ACTIVE',
        },
        {
          id: 2,
          name: 'Sprint 2',
          startDate: '2024-01-15',
          endDate: '2024-01-28',
          status: 'PLANNING',
        },
      ];
      mockElectron.database.getSprints.mockResolvedValue(mockSprints);

      const result = await getSprints();

      expect(mockElectron.database.getSprints).toHaveBeenCalled();
      expect(result).toEqual(mockSprints);
    });

    it('should throw error on fetch failure', async () => {
      const error = new Error('Database connection failed');
      mockElectron.database.getSprints.mockRejectedValue(error);

      await expect(getSprints()).rejects.toThrow('Database connection failed');
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching sprints:',
        error,
      );
    });

    it('should handle empty sprint list', async () => {
      mockElectron.database.getSprints.mockResolvedValue([]);

      const result = await getSprints();

      expect(result).toEqual([]);
    });
  });

  describe('createSprint', () => {
    it('should create sprint successfully', async () => {
      const sprintData = {
        name: 'New Sprint',
        startDate: '2024-02-01',
        endDate: '2024-02-14',
      };
      const mockCreatedSprint = {
        id: 3,
        ...sprintData,
        status: 'PLANNING',
      };
      mockElectron.database.createSprint.mockResolvedValue(mockCreatedSprint);

      const result = await createSprint(sprintData);

      expect(mockElectron.database.createSprint).toHaveBeenCalledWith(
        sprintData,
      );
      expect(result).toEqual(mockCreatedSprint);
    });

    it('should throw error on creation failure', async () => {
      const sprintData = {
        name: 'New Sprint',
        startDate: '2024-02-01',
        endDate: '2024-02-14',
      };
      const error = new Error('Failed to create sprint');
      mockElectron.database.createSprint.mockRejectedValue(error);

      await expect(createSprint(sprintData)).rejects.toThrow(
        'Failed to create sprint',
      );
      expect(console.error).toHaveBeenCalledWith(
        'Error creating sprint:',
        error,
      );
    });

    it('should handle creation with valid date range', async () => {
      const sprintData = {
        name: 'Q1 Sprint',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      };
      const mockCreatedSprint = {
        id: 4,
        ...sprintData,
        status: 'PLANNING',
      };
      mockElectron.database.createSprint.mockResolvedValue(mockCreatedSprint);

      const result = await createSprint(sprintData);

      expect(result).toEqual(mockCreatedSprint);
      expect(mockElectron.database.createSprint).toHaveBeenCalledWith(
        sprintData,
      );
    });
  });

  describe('updateSprint', () => {
    it('should update sprint successfully', async () => {
      const sprintUpdate = {
        id: 1,
        name: 'Updated Sprint Name',
        startDate: '2024-01-01',
        endDate: '2024-01-15',
        status: 'ACTIVE',
      };
      mockElectron.database.updateSprint.mockResolvedValue(sprintUpdate);

      const result = await updateSprint(sprintUpdate);

      expect(mockElectron.database.updateSprint).toHaveBeenCalledWith(
        sprintUpdate,
      );
      expect(result).toEqual(sprintUpdate);
    });

    it('should throw error on update failure', async () => {
      const sprintUpdate = {
        id: 1,
        name: 'Updated Sprint',
      };
      const error = new Error('Sprint not found');
      mockElectron.database.updateSprint.mockRejectedValue(error);

      await expect(updateSprint(sprintUpdate)).rejects.toThrow(
        'Sprint not found',
      );
      expect(console.error).toHaveBeenCalledWith(
        'Error updating sprint:',
        error,
      );
    });

    it('should handle partial sprint updates', async () => {
      const partialUpdate = {
        id: 1,
        name: 'Partially Updated Sprint',
      };
      const updatedSprint = {
        id: 1,
        name: 'Partially Updated Sprint',
        startDate: '2024-01-01',
        endDate: '2024-01-14',
        status: 'ACTIVE',
      };
      mockElectron.database.updateSprint.mockResolvedValue(updatedSprint);

      const result = await updateSprint(partialUpdate);

      expect(result).toEqual(updatedSprint);
      expect(mockElectron.database.updateSprint).toHaveBeenCalledWith(
        partialUpdate,
      );
    });

    it('should handle updating sprint dates', async () => {
      const dateUpdate = {
        id: 2,
        startDate: '2024-02-01',
        endDate: '2024-02-28',
      };
      const updatedSprint = {
        ...dateUpdate,
        name: 'Sprint 2',
        status: 'PLANNING',
      };
      mockElectron.database.updateSprint.mockResolvedValue(updatedSprint);

      const result = await updateSprint(dateUpdate);

      expect(result).toEqual(updatedSprint);
    });
  });

  describe('updateSprintStatus', () => {
    it('should update sprint status to ACTIVE', async () => {
      const sprintId = 1;
      const newStatus = 'ACTIVE';
      mockElectron.database.updateSprintStatus.mockResolvedValue(undefined);

      await updateSprintStatus(sprintId, newStatus);

      expect(mockElectron.database.updateSprintStatus).toHaveBeenCalledWith(
        sprintId,
        newStatus,
      );
    });

    it('should update sprint status to COMPLETED', async () => {
      const sprintId = 1;
      const newStatus = 'COMPLETED';
      mockElectron.database.updateSprintStatus.mockResolvedValue(undefined);

      await updateSprintStatus(sprintId, newStatus);

      expect(mockElectron.database.updateSprintStatus).toHaveBeenCalledWith(
        sprintId,
        newStatus,
      );
    });

    it('should update sprint status to PLANNING', async () => {
      const sprintId = 2;
      const newStatus = 'PLANNING';
      mockElectron.database.updateSprintStatus.mockResolvedValue(undefined);

      await updateSprintStatus(sprintId, newStatus);

      expect(mockElectron.database.updateSprintStatus).toHaveBeenCalledWith(
        sprintId,
        newStatus,
      );
    });

    it('should throw error on status update failure', async () => {
      const sprintId = 999;
      const newStatus = 'ACTIVE';
      const error = new Error('Sprint not found');
      mockElectron.database.updateSprintStatus.mockRejectedValue(error);

      await expect(updateSprintStatus(sprintId, newStatus)).rejects.toThrow(
        'Sprint not found',
      );
      expect(console.error).toHaveBeenCalledWith(
        'Error updating sprint status:',
        error,
      );
    });

    it('should handle updating non-existent sprint status', async () => {
      const sprintId = 0;
      const newStatus = 'ACTIVE';
      const error = new Error('Invalid sprint ID');
      mockElectron.database.updateSprintStatus.mockRejectedValue(error);

      await expect(updateSprintStatus(sprintId, newStatus)).rejects.toThrow(
        'Invalid sprint ID',
      );
    });
  });
});
