// "Similar tasks" estimator (reference-class forecasting): instead of a black box, find
// completed tasks that share context with the new one - tags, type, and what the task link
// says about it (Azure DevOps / GitHub / GitLab / Jira project, repo, work item vs PR) - and
// look at how long those actually took. People reliably underestimate; their own history
// of comparable work is the best available correction, and it can be explained to them.

export interface ContextKey {
  key: string; // stable id, e.g. "azure-repo:contoso/shop/api"
  label: string; // shown to the user, e.g. "repo api"
  weight: number; // how strongly sharing this key makes two tasks comparable
}

export interface EstimateTask {
  id?: number;
  status?: string;
  estimate?: number | string | null; // hours
  spendTime?: number | null; // ms
  type?: string | null;
  tags?: string[] | string | null;
  link?: string | null;
}

export interface EstimateSuggestion {
  minutes: number;
  // 'ratio': the user's estimate corrected by how similar tasks overran/underran it
  // 'duration': no estimate given - typical duration of similar tasks
  basis: 'ratio' | 'duration';
  ratio: number | null; // actual / estimate of similar tasks (basis 'ratio')
  sampleSize: number;
  matchedOn: string[]; // labels of the context the similar tasks share
  similarTasks: boolean; // false = fell back to all of the user's tasks
  confidence: 'low' | 'medium' | 'high';
}

const KEY_WEIGHTS = {
  tag: 1,
  repo: 2,
  project: 1.5,
  org: 0.5,
  kind: 1,
  type: 0.5,
  host: 0.5,
};

const MIN_SAMPLES = 3;
const MAX_NEIGHBORS = 12;
const MIN_RATIO = 0.25;
const MAX_RATIO = 4;

const decode = (part: string) => {
  try {
    return decodeURIComponent(part);
  } catch (e) {
    return part;
  }
};

// Context that the task link's URL string reveals - no network requests, the URL alone
export function extractLinkContext(link?: string | null): ContextKey[] {
  if (!link) return [];
  let url: URL;
  try {
    url = new URL(link.includes('://') ? link : `https://${link}`);
  } catch (e) {
    return [];
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean).map(decode);
  const keys: ContextKey[] = [];
  const add = (key: string, label: string, weight: number) =>
    keys.push({ key, label, weight });

  // Azure DevOps: dev.azure.com/{org}/{project}/... or {org}.visualstudio.com/{project}/...
  const isAzure =
    host === 'dev.azure.com' || host.endsWith('.visualstudio.com');
  if (isAzure) {
    const org =
      host === 'dev.azure.com'
        ? parts.shift()
        : host.split('.visualstudio.com')[0];
    const project =
      parts[0] && !parts[0].startsWith('_') ? parts[0] : undefined;
    if (org) add(`azure-org:${org}`, `Azure ${org}`, KEY_WEIGHTS.org);
    if (org && project) {
      add(
        `azure-project:${org}/${project}`,
        `project ${project}`,
        KEY_WEIGHTS.project,
      );
    }
    const section = parts.find((p) => p.startsWith('_'));
    if (section === '_git') {
      const repo = parts[parts.indexOf('_git') + 1];
      if (repo) {
        add(
          `azure-repo:${org}/${project}/${repo}`,
          `repo ${repo}`,
          KEY_WEIGHTS.repo,
        );
      }
      if (parts.includes('pullrequest')) {
        add('kind:pullrequest', 'pull request', KEY_WEIGHTS.kind);
      }
    } else if (section === '_workitems' || section === '_boards') {
      add('kind:workitem', 'work item', KEY_WEIGHTS.kind);
    } else if (section === '_build' || section === '_release') {
      add('kind:pipeline', 'pipeline', KEY_WEIGHTS.kind);
    } else if (section === '_wiki') {
      add('kind:docs', 'wiki', KEY_WEIGHTS.kind);
    }
    return keys;
  }

  // GitHub / GitLab: {owner}/{repo}/(issues|pull|-/merge_requests|-/issues)/{n}
  if (host === 'github.com' || host === 'gitlab.com') {
    const [owner, repo, ...rest] = parts;
    if (owner && repo) {
      add(`repo:${host}/${owner}/${repo}`, `repo ${repo}`, KEY_WEIGHTS.repo);
      add(`org:${host}/${owner}`, owner, KEY_WEIGHTS.org);
    }
    if (rest.includes('pull') || rest.includes('merge_requests')) {
      add('kind:pullrequest', 'pull request', KEY_WEIGHTS.kind);
    } else if (rest.includes('issues')) {
      add('kind:issue', 'issue', KEY_WEIGHTS.kind);
    }
    return keys;
  }

  // Jira: *.atlassian.net/browse/PROJ-123
  if (host.endsWith('.atlassian.net')) {
    const issueKey = parts[parts.indexOf('browse') + 1];
    const projectKey = issueKey?.match(/^([A-Z][A-Z0-9]+)-\d+$/)?.[1];
    if (projectKey) {
      add(
        `jira-project:${host}/${projectKey}`,
        `Jira ${projectKey}`,
        KEY_WEIGHTS.project,
      );
    }
    add('kind:issue', 'issue', KEY_WEIGHTS.kind);
    return keys;
  }

  add(`host:${host}`, host, KEY_WEIGHTS.host);
  return keys;
}

const normalizeTags = (tags: EstimateTask['tags']): string[] => {
  if (!tags) return [];
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  return list.map((t) => t.trim().toLowerCase()).filter(Boolean);
};

export function getTaskContext(task: EstimateTask): ContextKey[] {
  const keys: ContextKey[] = normalizeTags(task.tags).map((tag) => ({
    key: `tag:${tag}`,
    label: `#${tag}`,
    weight: KEY_WEIGHTS.tag,
  }));
  const type = (task.type || 'TASK').toUpperCase();
  keys.push({
    key: `type:${type}`,
    label: type.toLowerCase(),
    weight: KEY_WEIGHTS.type,
  });
  return keys.concat(extractLinkContext(task.link));
}

// Median where each value counts `weight` times - robust to a few forgotten timers
function weightedMedian(items: { value: number; weight: number }[]): number {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, i) => sum + i.weight, 0);
  let acc = 0;
  for (const item of sorted) {
    acc += item.weight;
    if (acc >= total / 2) return item.value;
  }
  return sorted[sorted.length - 1].value;
}

const hoursOf = (task: EstimateTask) => Number(task.estimate) || 0;

export function estimateFromHistory(
  task: EstimateTask,
  history: EstimateTask[],
): EstimateSuggestion | null {
  const useRatio = hoursOf(task) > 0;
  const context = getTaskContext(task);
  const contextKeys = new Map(context.map((k) => [k.key, k]));

  // Completed, tracked tasks usable for this kind of estimate
  const candidates = history.filter(
    (h) =>
      (task.id === undefined || h.id !== task.id) && // new tasks have no id yet
      h.status === 'Completed' &&
      (h.spendTime || 0) > 0 &&
      (!useRatio || hoursOf(h) > 0),
  );
  if (candidates.length < MIN_SAMPLES) return null;

  const scored = candidates.map((h) => {
    const shared = getTaskContext(h).filter((k) => contextKeys.has(k.key));
    return { task: h, shared, score: shared.reduce((s, k) => s + k.weight, 0) };
  });

  // Similar = shares more than just the task type; otherwise compare with everything
  const similar = scored
    .filter((s) => s.shared.some((k) => !k.key.startsWith('type:')))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NEIGHBORS);
  const similarTasks = similar.length >= MIN_SAMPLES;
  const pool = similarTasks ? similar : scored.map((s) => ({ ...s, score: 1 }));

  const valueOf = (h: EstimateTask) => {
    const actualMin = (h.spendTime || 0) / (1000 * 60);
    return useRatio ? actualMin / (hoursOf(h) * 60) : actualMin;
  };
  let value = weightedMedian(
    pool.map((s) => ({ value: valueOf(s.task), weight: s.score })),
  );

  let ratio: number | null = null;
  let minutes: number;
  if (useRatio) {
    ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));
    value = ratio;
    minutes = hoursOf(task) * 60 * ratio;
  } else {
    minutes = value;
  }

  // Most common shared context among the similar tasks, for the explanation
  const counts = new Map<string, number>();
  if (similarTasks) {
    pool.forEach((s) =>
      s.shared
        .filter((k) => !k.key.startsWith('type:'))
        .forEach((k) => counts.set(k.label, (counts.get(k.label) || 0) + 1)),
    );
  }
  const matchedOn = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);

  const sampleSize = pool.length;
  let confidence: EstimateSuggestion['confidence'] = 'low';
  if (similarTasks && sampleSize >= 10) confidence = 'high';
  else if (similarTasks && sampleSize >= 5) confidence = 'medium';

  return {
    minutes: Math.max(1, Math.round(minutes)),
    basis: useRatio ? 'ratio' : 'duration',
    ratio: ratio !== null ? Math.round(ratio * 100) / 100 : null,
    sampleSize,
    matchedOn,
    similarTasks,
    confidence,
  };
}
