import {
  EstimateTask,
  estimateFromHistory,
  extractLinkContext,
} from './TaskEstimator';

const keysOf = (link: string) => extractLinkContext(link).map((k) => k.key);

describe('extractLinkContext', () => {
  it('reads org, project and work item kind from an Azure DevOps work item URL', () => {
    expect(
      keysOf('https://dev.azure.com/contoso/Shop/_workitems/edit/1234'),
    ).toEqual([
      'azure-org:contoso',
      'azure-project:contoso/Shop',
      'kind:workitem',
    ]);
  });

  it('reads the repo and pull request kind from an Azure DevOps PR URL', () => {
    expect(
      keysOf('https://dev.azure.com/contoso/Shop/_git/api/pullrequest/77'),
    ).toEqual([
      'azure-org:contoso',
      'azure-project:contoso/Shop',
      'azure-repo:contoso/Shop/api',
      'kind:pullrequest',
    ]);
  });

  it('supports legacy *.visualstudio.com URLs and encoded names', () => {
    expect(
      keysOf('https://contoso.visualstudio.com/My%20Project/_build?id=5'),
    ).toEqual([
      'azure-org:contoso',
      'azure-project:contoso/My Project',
      'kind:pipeline',
    ]);
  });

  it('reads GitHub repos and PRs, and Jira project keys', () => {
    expect(keysOf('https://github.com/acme/web/pull/12')).toEqual([
      'repo:github.com/acme/web',
      'org:github.com/acme',
      'kind:pullrequest',
    ]);
    expect(keysOf('https://acme.atlassian.net/browse/PAY-42')).toEqual([
      'jira-project:acme.atlassian.net/PAY',
      'kind:issue',
    ]);
  });

  it('falls back to the host, and ignores empty or invalid links', () => {
    expect(keysOf('https://www.notion.so/page-123')).toEqual([
      'host:notion.so',
    ]);
    expect(extractLinkContext('')).toEqual([]);
    expect(extractLinkContext('not a url at all')).toEqual([]);
  });
});

const HOUR = 60 * 60 * 1000;
const done = (overrides: Partial<EstimateTask>): EstimateTask => ({
  status: 'Completed',
  estimate: 1,
  spendTime: HOUR,
  type: 'TASK',
  tags: [],
  ...overrides,
});

describe('estimateFromHistory', () => {
  it('corrects the estimate by how similar (same repo) tasks overran theirs', () => {
    const repo = 'https://dev.azure.com/contoso/Shop/_git/api/pullrequest/';
    const history = [
      done({ link: `${repo}1`, spendTime: 2 * HOUR }),
      done({ link: `${repo}2`, spendTime: 2 * HOUR }),
      done({ link: `${repo}3`, spendTime: 2 * HOUR }),
      // Unrelated tasks that finish on time must not dilute the repo's 2x overrun
      done({ tags: ['docs'] }),
      done({ tags: ['docs'] }),
      done({ tags: ['docs'] }),
    ];
    const result = estimateFromHistory(
      { estimate: 1.5, link: `${repo}99` },
      history,
    );
    expect(result).toMatchObject({
      basis: 'ratio',
      ratio: 2,
      minutes: 180,
      similarTasks: true,
      sampleSize: 3,
    });
    expect(result!.matchedOn).toContain('repo api');
  });

  it('suggests the typical duration of similar tasks when there is no estimate', () => {
    const history = [
      done({ tags: ['arch'], spendTime: 3 * HOUR }),
      done({ tags: ['arch'], spendTime: 4 * HOUR }),
      done({ tags: ['arch'], spendTime: 5 * HOUR }),
      done({ tags: ['bug'], spendTime: 0.2 * HOUR }),
    ];
    const result = estimateFromHistory(
      { estimate: 0, tags: ['arch'] },
      history,
    );
    expect(result).toMatchObject({ basis: 'duration', minutes: 240 });
    expect(result!.matchedOn).toEqual(['#arch']);
  });

  it('is robust to a single forgotten timer (median, clamped ratio)', () => {
    const history = [
      done({ tags: ['api'], spendTime: HOUR }),
      done({ tags: ['api'], spendTime: HOUR }),
      done({ tags: ['api'], spendTime: 40 * HOUR }),
    ];
    const result = estimateFromHistory({ estimate: 1, tags: ['api'] }, history);
    expect(result!.minutes).toBe(60);
  });

  it('falls back to all tasks when nothing similar exists, and says so', () => {
    const history = [
      done({ tags: ['x'] }),
      done({ tags: ['y'] }),
      done({ tags: ['z'] }),
    ];
    const result = estimateFromHistory({ estimate: 2, tags: ['new'] }, history);
    expect(result).toMatchObject({ similarTasks: false, confidence: 'low' });
    expect(result!.matchedOn).toEqual([]);
  });

  it('returns null without enough completed, tracked history', () => {
    const history = [
      done({}),
      done({ spendTime: 0 }),
      done({ status: 'To Do' }),
    ];
    expect(estimateFromHistory({ estimate: 1 }, history)).toBeNull();
  });
});
