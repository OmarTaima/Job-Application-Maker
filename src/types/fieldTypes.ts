export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "date"
  | "radio"
  | "dropdown"
  | "checkbox"
  | "url"
  | "tags"
  | "repeatable_group";

export type BilingualString = {
  en: string;
  ar: string;
};

export type BilingualChoice = {
  en: string;
  ar: string;
};
