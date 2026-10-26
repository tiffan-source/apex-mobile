import type { ConversationMessage, WorkflowState } from '@/domain/akari/assistant';
import type { Result } from '@/domain/shared/result';

/*
 * Akari, côté Apex Brain : la conversation d'un objectif et son workflow (XState, sur le serveur). Il n'y a
 * pas de flux : pendant un tour, le client interroge l'état (Apex : chaque seconde) jusqu'au repos ou à une
 * demande d'accord.
 */

export type Conversation = {
  readonly id: string;
  /** Dans l'ordre chronologique. */
  readonly messages: readonly ConversationMessage[];
};

export interface AssistantGateway {
  /** `GET /v1/objectives/{id}/conversation` : seul un objectif racine a une conversation. */
  getConversation(objectiveId: string): Promise<Result<Conversation>>;
  /** `GET /v1/objectives/{id}/assistant` : l'état du workflow ; un tour interrompu reprend. */
  getState(objectiveId: string): Promise<Result<WorkflowState>>;
  /** `POST /v1/objectives/{id}/assistant/messages` : le tour démarre, la réponse arrive par l'état. */
  sendMessage(objectiveId: string, message: string): Promise<Result<WorkflowState>>;
  /** `POST /v1/objectives/{id}/assistant/permission` : accepter ou refuser l'outil qui attend. */
  respondToPermission(
    objectiveId: string,
    granted: boolean,
    toolCallId?: string,
  ): Promise<Result<WorkflowState>>;
}
