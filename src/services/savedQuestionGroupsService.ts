import axios from "../config/axios";
import { getErrorMessage } from "../utils/errorHandler";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type SavedQuestionAnswerType =
  | "text"
  | "number"
  | "radio"
  | "checkbox"
  | "dropdown"
  | "tags";

export type SavedQuestion = {
  question: string;
  score: number;
  answerType: SavedQuestionAnswerType;
  choices?: string[];
};

export type SavedQuestionGroup = {
  _id?: string;
  name: string;
  questions: SavedQuestion[];
};

const BASE_PATH = "/users/me/saved-question-groups";

const isNotFoundLike = (error: any): boolean => {
  const status = error?.response?.status;
  return status === 404 || status === 405;
};

const normalizeGroupPayload = (group: SavedQuestionGroup): SavedQuestionGroup => ({
  _id: typeof group?._id === "string" ? group._id : undefined,
  name: String(group?.name ?? "").trim(),
  questions: Array.isArray(group?.questions)
    ? group.questions.map((question) => ({
        question: String(question?.question ?? "").trim(),
        score: Number.isFinite(Number(question?.score))
          ? Number(question?.score)
          : 0,
        answerType: question?.answerType ?? "text",
        choices: Array.isArray((question as any)?.choices)
          ? (question as any).choices.map((c: any) => String(c ?? "").trim()).filter(Boolean)
          : [],
      }))
    : [],
});

const toGroupArray = (value: any): SavedQuestionGroup[] => {
  if (Array.isArray(value)) return value as SavedQuestionGroup[];
  if (
    value &&
    typeof value === "object" &&
    (typeof value.name !== "undefined" || Array.isArray(value.questions))
  ) {
    return [value as SavedQuestionGroup];
  }
  return [];
};

const extractGroups = (payload: any): SavedQuestionGroup[] => {
  const candidates = [
    payload?.data?.groups,
    payload?.data,
    payload?.result?.groups,
    payload?.result,
    payload?.groups,
    payload,
  ];

  for (const candidate of candidates) {
    const groups = toGroupArray(candidate);
    if (groups.length > 0) return groups;
  }

  return [];
};

class SavedQuestionGroupsService {
  async getAllSavedQuestionGroups(): Promise<SavedQuestionGroup[]> {
    try {
      const response = await axios.get(BASE_PATH);
      return extractGroups(response.data);
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async createSavedQuestionGroup(group: SavedQuestionGroup): Promise<SavedQuestionGroup> {
    try {
      const payload = normalizeGroupPayload(group);
      const response = await axios.post(BASE_PATH, {
        name: payload.name,
        questions: payload.questions,
      });

      const created = extractGroups(response.data)[0];
      return created ?? payload;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateSavedQuestionGroup(
    groupId: string,
    group: SavedQuestionGroup
  ): Promise<SavedQuestionGroup> {
    try {
      const encodedId = encodeURIComponent(groupId);
      const payload = normalizeGroupPayload(group);

      const response = await axios.put(`${BASE_PATH}/${encodedId}`, {
        name: payload.name,
        questions: payload.questions,
      });

      const updated = extractGroups(response.data)[0];
      return updated ?? { ...payload, _id: groupId };
    } catch (error: any) {
      if (isNotFoundLike(error)) {
        return this.createSavedQuestionGroup(group);
      }

      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async deleteSavedQuestionGroup(groupId: string): Promise<void> {
    try {
      const encodedId = encodeURIComponent(groupId);
      await axios.delete(`${BASE_PATH}/${encodedId}`);
    } catch (error: any) {
      if (isNotFoundLike(error)) return;

      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }

  async updateSavedQuestionGroups(groups: SavedQuestionGroup[]): Promise<SavedQuestionGroup[]> {
    try {
      const normalizedGroups = Array.isArray(groups)
        ? groups.map((group) => normalizeGroupPayload(group))
        : [];

      const upserted = await Promise.all(
        normalizedGroups.map((group) => {
          if (group._id) {
            return this.updateSavedQuestionGroup(group._id, group);
          }
          return this.createSavedQuestionGroup(group);
        })
      );

      return upserted;
    } catch (error: any) {
      throw new ApiError(
        getErrorMessage(error),
        error.response?.status,
        error.response?.data?.details
      );
    }
  }
}

export const savedQuestionGroupsService = new SavedQuestionGroupsService();
