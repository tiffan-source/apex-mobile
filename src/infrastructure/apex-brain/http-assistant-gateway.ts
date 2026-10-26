import type { WorkflowState } from '@/domain/akari/assistant';
import type { Result } from '@/domain/shared/result';
import type { AssistantGateway, Conversation } from '@/application/ports/assistant-gateway';
import { mapResult, type ApexClient } from '../http/apex-client';
import type { paths } from './schema';

type WorkflowStateDto =
  paths['/v1/objectives/{objectiveId}/assistant']['get']['responses'][200]['content']['application/json'];

/** L'état d'un workflow tel que le domaine le lit. */
function toWorkflowState(dto: WorkflowStateDto): WorkflowState {
  return {
    objectiveId: dto.objectiveId,
    value: dto.value,
    status: dto.status,
    pendingToolCall: dto.pendingToolCall
      ? {
          id: dto.pendingToolCall.id,
          name: dto.pendingToolCall.name,
          arguments: dto.pendingToolCall.arguments,
        }
      : null,
    lastRegisteredMessage: dto.lastRegisteredMessage
      ? {
          id: dto.lastRegisteredMessage.id,
          sender: dto.lastRegisteredMessage.sender,
          content: dto.lastRegisteredMessage.content,
          createdAt: dto.lastRegisteredMessage.createdAt,
        }
      : null,
    lastError: dto.lastError,
  };
}

/** La conversation et le workflow d'Akari, par l'API d'Apex Brain. */
export class HttpAssistantGateway implements AssistantGateway {
  constructor(private readonly client: ApexClient) {}

  getConversation(objectiveId: string): Promise<Result<Conversation>> {
    return mapResult(
      this.client.GET('/v1/objectives/{objectiveId}/conversation', { params: { path: { objectiveId } } }),
      (data) => ({
        id: data.id,
        messages: data.messages.map((message) => ({
          id: message.id,
          sender: message.sender,
          content: message.content,
          createdAt: message.createdAt,
        })),
      }),
    );
  }

  getState(objectiveId: string): Promise<Result<WorkflowState>> {
    return mapResult(
      this.client.GET('/v1/objectives/{objectiveId}/assistant', { params: { path: { objectiveId } } }),
      toWorkflowState,
    );
  }

  sendMessage(objectiveId: string, message: string): Promise<Result<WorkflowState>> {
    return mapResult(
      this.client.POST('/v1/objectives/{objectiveId}/assistant/messages', {
        params: { path: { objectiveId } },
        body: { message },
      }),
      toWorkflowState,
    );
  }

  respondToPermission(
    objectiveId: string,
    granted: boolean,
    toolCallId?: string,
  ): Promise<Result<WorkflowState>> {
    return mapResult(
      this.client.POST('/v1/objectives/{objectiveId}/assistant/permission', {
        params: { path: { objectiveId } },
        body: { granted, ...(toolCallId ? { toolCallId } : {}) },
      }),
      toWorkflowState,
    );
  }
}
