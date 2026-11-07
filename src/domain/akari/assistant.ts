import { typeset } from '../shared/typography';

/*
 * Akari, l'assistant d'Apex : l'état de son workflow tel qu'Apex Brain le décrit, ce qu'il fait pendant un
 * tour, ce qu'il demande la permission d'ajouter, et ses invitations (cahier de migration d'Apex, § 5).
 */

/** Le statut d'un workflow : au repos, en plein tour, ou en attente d'un accord. */
export type WorkflowStatus = 'ready' | 'processing' | 'awaiting-permission';

/** Ce qu'Akari peut être en train de faire pendant un tour. Un code inconnu de ce client garde une phrase par défaut. */
export type WorkflowActivityStep =
  | 'saving-message'
  | 'thinking'
  | 'checking-permission'
  | 'awaiting-permission'
  | 'reading'
  | 'writing'
  | 'reviewing'
  | 'saving-reply';

/** Ce que fait Akari pendant un tour, sans rien de la machine du workflow. */
export type WorkflowActivity = {
  /** Ce qu'il fait maintenant. */
  readonly step: WorkflowActivityStep;
  /** Le temps déjà passé sur cette étape, en millisecondes (mesuré par le serveur). */
  readonly elapsedMs: number;
  /** Ses passages par l'IA depuis le début du tour : à partir de 2, il repart pour un tour de boucle. */
  readonly round: number;
  /** Ce qu'il a déjà fait pendant ce tour, du plus ancien au plus récent. */
  readonly done: readonly WorkflowActivityStep[];
};

/** Un outil qu'Akari veut utiliser. */
export type ToolCall = {
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
};

/** Un message enregistré dans la conversation (de la personne ou d'Akari). */
export type ConversationMessage = {
  readonly id: string;
  /** L'id de la personne, ou `AI` pour Akari. */
  readonly sender: string;
  readonly content: string;
  /** Instant ISO 8601. */
  readonly createdAt: string;
};

/** L'état d'un workflow, tel que `GET /v2/objectives/{id}/assistant` le rend. */
export type WorkflowState = {
  readonly objectiveId: string;
  readonly status: WorkflowStatus;
  /** Ce que fait Akari ; null au repos. */
  readonly activity: WorkflowActivity | null;
  /** L'outil qui attend l'accord, quand le statut est `awaiting-permission`. */
  readonly pendingToolCall: ToolCall | null;
  /** Le dernier message enregistré par le workflow. */
  readonly lastRegisteredMessage: ConversationMessage | null;
  /** La panne qui a interrompu le dernier tour ; elle disparaît au message suivant. */
  readonly lastError: { readonly code: string; readonly step: string; readonly at: string } | null;
};

/** Les outils d'écriture : ceux qui ajoutent une étape ou un pas. */
export const CREATE_STAGE_TOOL = 'createSubObjective';
export const CREATE_TASK_TOOL = 'createTask';
const WRITE_TOOLS = new Set<string>([CREATE_STAGE_TOOL, CREATE_TASK_TOOL]);

/** Vrai si l'outil ajoute quelque chose à l'arête (les objectifs seront à recharger après lui). */
export function isWriteTool(call: ToolCall | null | undefined): boolean {
  return !!call && WRITE_TOOLS.has(call.name);
}

/**
 * Akari écrit ce que la personne a accepté. Un tour en cours qui ne dit pas ce qu'il fait (commencé avant que l'API
 * le dise) est réputé écrire encore : recharger trop tôt montrerait une arête sans l'ajout, sans seconde chance.
 */
export function isWriting(state: Pick<WorkflowState, 'status' | 'activity'>): boolean {
  return state.activity ? state.activity.step === 'writing' : state.status === 'processing';
}

/** Ce que fait Akari pendant un tour, dit dans la ligne d'état (voix d'Empreinte, sans jargon). */
export const AKARI_STATUS = {
  'saving-message': 'Akari note ton message…',
  thinking: 'Akari réfléchit…',
  'checking-permission': "Akari vérifie s'il lui faut ton accord…",
  // La ligne d'état dit « Akari attend ton accord. » tant qu'il l'attend : cette phrase vaut pour le court moment
  // où la réponse de la personne est partie et où le serveur ne l'a pas encore rendue.
  'awaiting-permission': 'Akari reçoit ta réponse…',
  reading: 'Akari regarde ton objectif…',
  writing: 'Akari ajoute ce que tu as accepté…',
  reviewing: 'Akari fait le point…',
  'saving-reply': 'Akari écrit sa réponse…',
} as const satisfies Record<WorkflowActivityStep, string>;

/** La phrase par défaut d'une étape du workflow sans phrase à elle. */
export const AKARI_THINKING = AKARI_STATUS.thinking;

/** Après ce délai sur un même appel à l'IA, la ligne d'état dit qu'Akari y est encore. */
export const AKARI_LONG_WAIT_MS = 15_000;
/** Après ce délai, elle dit que c'est inhabituel. */
export const AKARI_VERY_LONG_WAIT_MS = 45_000;

export const AKARI_STILL_THINKING = 'Akari réfléchit encore…';
export const AKARI_TAKING_LONGER = "C'est plus long que d'habitude. Akari réfléchit encore…";

/**
 * Ce qu'Akari a déjà fait pendant un tour : le journal, écrit par lui au-dessus de la ligne d'état. Une ligne dit
 * qu'une étape a eu lieu, pas ce qu'elle a donné : une écriture peut être refusée par le serveur. Le résultat se
 * lit dans la réponse d'Akari et sur l'arête.
 */
export const AKARI_JOURNAL = {
  'saving-message': "J'ai noté ton message.",
  thinking: "J'ai réfléchi à ta demande.",
  'checking-permission': "J'ai vérifié s'il me fallait ton accord.",
  'awaiting-permission': "J'ai demandé ton accord.",
  reading: "J'ai regardé ton objectif.",
  writing: "J'ai pris en compte ton accord.",
  reviewing: "J'ai fait le point.",
  'saving-reply': "J'ai écrit ma réponse.",
} as const satisfies Record<WorkflowActivityStep, string>;

/** Les dernières lignes du journal : un long tour ne repousse pas la conversation hors de l'écran. */
export const AKARI_JOURNAL_LINES = 5;

/**
 * La ligne d'état d'un tour en cours. Les appels à l'IA sont les seules étapes qui durent : quand l'attente
 * s'allonge, la phrase le dit, pour qu'une longue réflexion ne ressemble pas à un écran figé.
 */
export function processingPhrase(activity: WorkflowActivity | null | undefined): string {
  if (!activity) return AKARI_THINKING;
  const { step, elapsedMs, round } = activity;

  if (step === 'thinking' || step === 'reviewing') {
    if (elapsedMs >= AKARI_VERY_LONG_WAIT_MS) return AKARI_TAKING_LONGER;
    if (elapsedMs >= AKARI_LONG_WAIT_MS) return AKARI_STILL_THINKING;
  }
  if (step === 'reviewing' && round > 1) return `Akari fait le point, ${round}e tour…`;

  return (AKARI_STATUS as Record<string, string>)[step] ?? AKARI_THINKING;
}

/** Les lignes du journal d'un tour en cours. Un code inconnu de ce client n'y paraît pas. */
export function journalLines(activity: WorkflowActivity | null | undefined): string[] {
  return (activity?.done ?? [])
    .map((step) => (AKARI_JOURNAL as Record<string, string>)[step])
    .filter((line): line is string => line !== undefined)
    .slice(-AKARI_JOURNAL_LINES);
}

/** Ce qu'Akari demande la permission de faire, tiré de l'outil en attente. */
export type PermissionRequest =
  | { readonly kind: 'stage'; readonly title: string; readonly parentId: string | null }
  | { readonly kind: 'task'; readonly title: string; readonly objectiveId: string | null }
  | { readonly kind: 'other' };

export function permissionRequestOf(call: ToolCall | null): PermissionRequest | null {
  if (!call) return null;
  const args = (call.arguments ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  switch (call.name) {
    case CREATE_STAGE_TOOL:
      return { kind: 'stage', title: text(args['title']), parentId: text(args['parentObjectiveId']) || null };
    case CREATE_TASK_TOOL:
      return { kind: 'task', title: text(args['title']), objectiveId: text(args['objectiveId']) || null };
    default:
      return { kind: 'other' };
  }
}

/**
 * La demande d'accord d'Akari avant d'ajouter une étape ou un pas. `stageTitleOf` retrouve le nom de l'étape
 * qui recevrait un pas.
 */
export function permissionPrompt(
  request: PermissionRequest,
  stageTitleOf: (id: string) => string | undefined = () => undefined,
): string {
  return typeset(permissionSentence(request, stageTitleOf));
}

function permissionSentence(
  request: PermissionRequest,
  stageTitleOf: (id: string) => string | undefined,
): string {
  switch (request.kind) {
    case 'stage':
      return request.title
        ? `Je te propose d'ajouter l'étape « ${request.title} ». On l'ajoute ?`
        : "Je te propose d'ajouter une étape. On l'ajoute ?";
    case 'task': {
      const task = request.title ? `le pas « ${request.title} »` : 'un pas';
      const stage = request.objectiveId ? stageTitleOf(request.objectiveId) : undefined;
      return stage
        ? `Je te propose d'ajouter ${task} à l'étape « ${stage} ». On l'ajoute ?`
        : `Je te propose d'ajouter ${task}. On l'ajoute ?`;
    }
    default:
      return "J'ai besoin de ton accord pour continuer. On y va ?";
  }
}

/** « Ajouter » pour une étape ou un pas, « Continuer » pour le reste. */
export function acceptLabel(request: PermissionRequest | null): string {
  return request?.kind === 'other' ? 'Continuer' : 'Ajouter';
}

/**
 * Une invitation d'Akari : sa phrase, son bouton, et le message envoyé quand on l'accepte. Le message part tel
 * que la personne l'écrirait, avec des espaces ordinaires, comme celui du client web.
 */
export type AkariInvitation = {
  readonly phrase: string;
  readonly action: string;
  readonly message: string;
};

/** Akari ouvre une conversation vide sur l'objectif. */
export function objectiveInvitation(objectiveTitle: string): AkariInvitation {
  return {
    phrase: typeset(`Je peux te proposer des étapes pour « ${objectiveTitle} ». On commence ?`),
    action: 'Propose-moi des étapes',
    message: `Propose-moi des étapes pour « ${objectiveTitle} ».`,
  };
}

/** Akari propose des pas pour l'étape d'où l'on vient. */
export function stageInvitation(stageTitle: string): AkariInvitation {
  return {
    phrase: typeset(`Je peux te proposer des pas pour l'étape « ${stageTitle} ».`),
    action: 'Propose-moi des pas',
    message: `Propose-moi des pas pour l'étape « ${stageTitle} ».`,
  };
}
