import { typeset } from '../shared/typography';

/*
 * Akari, l'assistant d'Apex : l'état de son workflow tel qu'Apex Brain le décrit, ce qu'il fait pendant un
 * tour, ce qu'il demande la permission d'ajouter, et ses invitations (cahier de migration d'Apex, § 5).
 */

/** Le statut d'un workflow : au repos, en plein tour, ou en attente d'un accord. */
export type WorkflowStatus = 'ready' | 'processing' | 'awaiting-permission';

/** La valeur de la machine XState d'Apex Brain (`Ready For New Message`, `{ ExecutingAllTool: … }`…). */
export type WorkflowValue = string | Readonly<Record<string, unknown>>;

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

/** L'état d'un workflow, tel que `GET /v1/objectives/{id}/assistant` le rend. */
export type WorkflowState = {
  readonly objectiveId: string;
  readonly value: WorkflowValue;
  readonly status: WorkflowStatus;
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

/** L'étape de la machine (« ExecutingAllTool » pour `{ ExecutingAllTool: 'ExecutingTool' }`). */
export function workflowStep(value: WorkflowValue | undefined): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : (Object.keys(value)[0] ?? '');
}

/** Le workflow exécute un outil : l'écriture acceptée est en cours. */
export function isExecutingTool(value: WorkflowValue | undefined): boolean {
  return typeof value === 'object' && value !== null && value['ExecutingAllTool'] === 'ExecutingTool';
}

/** Ce que fait Akari pendant un tour, dit dans la ligne d'état (voix d'Empreinte, sans jargon). */
export const AKARI_STATUS = {
  RegisteringUserMessageInConversation: 'Akari note ton message…',
  SendingPromptToAI: 'Akari réfléchit…',
  ExecutingAllTool: 'Akari regarde ton objectif…',
  SendingCallResultToAI: 'Akari fait le point…',
  RegisteringAIResponseInConversation: 'Akari écrit sa réponse…',
} as const satisfies Record<string, string>;

/** La phrase par défaut d'une étape du workflow sans phrase à elle. */
export const AKARI_THINKING = AKARI_STATUS.SendingPromptToAI;

/** La ligne d'état d'un tour en cours. */
export function processingPhrase(value: WorkflowValue | undefined): string {
  return (AKARI_STATUS as Record<string, string>)[workflowStep(value)] ?? AKARI_THINKING;
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
