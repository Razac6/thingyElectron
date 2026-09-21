import http from 'http';
import { startServer, serverEvents } from './server';
import {
  getWebBlockingSettings,
  getSetting,
  logWebActivity,
  logWebActivityBulk,
} from './db';

// Mock electron-log
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

// Mock db
jest.mock('./db', () => ({
  getSetting: jest.fn(),
  logWebActivity: jest.fn(),
  logWebActivityBulk: jest.fn(),
  getWebBlockingSettings: jest.fn(),
  logSystemEvent: jest.fn(),
}));

describe('Server', () => {
  let handleRequest: (req: any, res: any) => void;

  beforeAll(() => {
    jest.spyOn(http, 'createServer').mockImplementation((cb: any) => {
      handleRequest = cb;
      return {
        listen: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
      } as any;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getSetting as jest.Mock).mockReturnValue('3333');
    (getWebBlockingSettings as jest.Mock).mockReturnValue({
      integrationEnabled: true,
      blockingEnabled: true,
      blockOnlyInFocus: false,
      blockedSites: [],
    });
    startServer();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const createMockRes = () => {
    const res = {
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      end: jest.fn(),
    };
    return res;
  };

  it('should return status on GET /api/status', () => {
    const req = { method: 'GET', url: '/api/status' };
    const res = createMockRes();

    handleRequest(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(
      expect.stringContaining('"connected":true'),
    );
  });

  it('should return 403 on /api/activity if integration is disabled', () => {
    (getWebBlockingSettings as jest.Mock).mockReturnValue({
      integrationEnabled: false,
    });
    const req = { method: 'POST', url: '/api/activity' };
    const res = createMockRes();

    handleRequest(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(
      expect.stringContaining('Integration disabled'),
    );
  });

  it('should log web activity on POST /api/activity', (done) => {
    const req: any = new (require('events').EventEmitter)();
    req.method = 'POST';
    req.url = '/api/activity';
    const res = createMockRes();

    handleRequest(req, res);

    const activityData = { domain: 'google.com', duration: 5000 };
    req.emit('data', Buffer.from(JSON.stringify(activityData)));
    req.emit('end');

    setTimeout(() => {
      expect(logWebActivity).toHaveBeenCalledWith({
        domain: 'google.com',
        duration: 5000,
        url: '',
        timestamp: expect.any(Number),
      });
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      done();
    }, 10);
  });

  it('should log bulk web activity on POST /api/activity', (done) => {
    const req: any = new (require('events').EventEmitter)();
    req.method = 'POST';
    req.url = '/api/activity';
    const res = createMockRes();

    handleRequest(req, res);

    const bulkData = [
      { domain: 'google.com', duration: 5000 },
      { domain: 'github.com', duration: 10000 },
    ];
    req.emit('data', Buffer.from(JSON.stringify(bulkData)));
    req.emit('end');

    setTimeout(() => {
      expect(logWebActivityBulk).toHaveBeenCalledWith([
        {
          domain: 'google.com',
          duration: 5000,
          url: '',
          timestamp: expect.any(Number),
        },
        {
          domain: 'github.com',
          duration: 10000,
          url: '',
          timestamp: expect.any(Number),
        },
      ]);
      done();
    }, 10);
  });

  it('should emit task-draft on POST /api/task/draft', (done) => {
    const req: any = new (require('events').EventEmitter)();
    req.method = 'POST';
    req.url = '/api/task/draft';
    const res = createMockRes();

    const taskData = { title: 'New Task from Browser' };

    serverEvents.once('task-draft', (data) => {
      expect(data).toEqual(taskData);
      done();
    });

    handleRequest(req, res);
    req.emit('data', Buffer.from(JSON.stringify(taskData)));
    req.emit('end');
  });

  it('should return 400 on invalid JSON', (done) => {
    const req: any = new (require('events').EventEmitter)();
    req.method = 'POST';
    req.url = '/api/activity';
    const res = createMockRes();

    handleRequest(req, res);
    req.emit('data', Buffer.from('invalid json'));
    req.emit('end');

    setTimeout(() => {
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      done();
    }, 10);
  });
});
