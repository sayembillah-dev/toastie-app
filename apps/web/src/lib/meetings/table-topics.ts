/** A single question on a meeting's Table Topics tab. Meeting-scoped, capped
 * at `MAX_TABLE_TOPIC_QUESTIONS` by the tab — not enforced by the API. */

export const TABLE_TOPIC_TEXT_MAX = 400;
export const MAX_TABLE_TOPIC_QUESTIONS = 10;

export interface TableTopicQuestion {
  id: string;
  text: string;
  asked: boolean;
}

export interface CreateTableTopicQuestionInput {
  text: string;
}

export interface UpdateTableTopicQuestionInput {
  text?: string;
  asked?: boolean;
}
