import { parseDateOnly, toUtcDayOrdinal } from './date-only';
import { countGraphemes } from './graphemes';
import type {
  ChecklistItemInput,
  CreateTripInput,
  EditTripInput,
  Result,
  TripInput,
  ValidationError,
  ValidationField,
} from './types';

const DESTINATION_MAX_GRAPHEMES = 80;
const NOTES_MAX_GRAPHEMES = 500;
const CHECKLIST_TITLE_MAX_GRAPHEMES = 100;
type FieldErrors = Partial<Record<ValidationField, string>>;

function validationFailure(fieldErrors: FieldErrors): Result<never, ValidationError> {
  return { ok: false, error: { kind: 'validation', fieldErrors } };
}

function validateTripFields(input: TripInput): {
  fieldErrors: FieldErrors;
  value: TripInput;
} {
  const destination = input.destination.trim();
  const fieldErrors: FieldErrors = {};

  if (destination === '') {
    fieldErrors.destination = '请输入目的地';
  } else if (countGraphemes(destination) > DESTINATION_MAX_GRAPHEMES) {
    fieldErrors.destination = '目的地最多 80 个字符';
  }

  if (countGraphemes(input.notes) > NOTES_MAX_GRAPHEMES) {
    fieldErrors.notes = '备注最多 500 个字符';
  }

  if (!parseDateOnly(input.departureDate).ok) {
    fieldErrors.departureDate = '请输入有效的出发日期';
  }

  return {
    fieldErrors,
    value: { destination, departureDate: input.departureDate, notes: input.notes },
  };
}

export function validateCreateTripInput(
  input: CreateTripInput,
  localToday: string,
): Result<CreateTripInput, ValidationError> {
  const { fieldErrors, value } = validateTripFields(input);
  const departureDate = parseDateOnly(value.departureDate);
  const today = parseDateOnly(localToday);

  if (
    !fieldErrors.departureDate &&
    departureDate.ok &&
    today.ok &&
    toUtcDayOrdinal(departureDate.value) < toUtcDayOrdinal(today.value)
  ) {
    fieldErrors.departureDate = '出发日期不能早于今天';
  }

  return Object.keys(fieldErrors).length > 0
    ? validationFailure(fieldErrors)
    : { ok: true, value };
}

export function validateEditTripInput(
  input: EditTripInput,
): Result<EditTripInput, ValidationError> {
  const { fieldErrors, value } = validateTripFields(input);

  return Object.keys(fieldErrors).length > 0
    ? validationFailure(fieldErrors)
    : { ok: true, value };
}

export function validateChecklistItemInput(
  input: ChecklistItemInput,
): Result<ChecklistItemInput, ValidationError> {
  const title = input.title.trim();
  const fieldErrors: FieldErrors = {};

  if (title === '') {
    fieldErrors.title = '请输入事项名称';
  } else if (countGraphemes(title) > CHECKLIST_TITLE_MAX_GRAPHEMES) {
    fieldErrors.title = '事项名称最多 100 个字符';
  }

  return Object.keys(fieldErrors).length > 0
    ? validationFailure(fieldErrors)
    : { ok: true, value: { title } };
}
