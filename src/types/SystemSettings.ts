import type { FieldType, BilingualString, BilingualChoice } from './fieldTypes';

// Re-export for convenient access
export type { FieldType, BilingualString, BilingualChoice } from './fieldTypes';

export type FieldValidation = {
  min?: number | null;
  max?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  pattern?: string | null;
};

export type RecommendedField = {
  fieldId: string;
  label: BilingualString;
  inputType: FieldType;
  isRequired: boolean;
  choices?: BilingualChoice[];
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
  order?: number;
  description?: BilingualString;
  // Support grouped sub-fields (API may return groupFields or subFields)
  groupFields?: Array<{
    fieldId?: string;
    label: BilingualString;
    inputType: FieldType;
    isRequired?: boolean;
    choices?: BilingualChoice[];
    order?: number;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
  }>;
  // Some responses might use `subFields` instead of `groupFields`
  subFields?: Array<{
    fieldId?: string;
    label: BilingualString;
    inputType: FieldType;
    isRequired?: boolean;
    choices?: BilingualChoice[];
    order?: number;
    defaultValue?: string;
    minValue?: number;
    maxValue?: number;
  }>;
};

export type CreateRecommendedFieldRequest = {
  fieldId: string;
  label: BilingualString;
  inputType: FieldType;
  isRequired: boolean;
  order?: number;
  choices?: BilingualChoice[];
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
};

export type UpdateRecommendedFieldRequest = {
  label?: BilingualString;
  inputType?: FieldType;
  isRequired?: boolean;
  choices?: BilingualChoice[];
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
  order?: number;
};