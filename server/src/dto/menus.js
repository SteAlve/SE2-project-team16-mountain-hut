/**
 * DTO of the menus (MH-10): the staff saves or deletes the menu of a slot and lists the previous menus, anybody
 * reads the menu of a slot. The rules of the menu itself (not empty, at most 2000 characters, only
 * the formatting of the editor) are in domain/menu.js; here only the shape of the request.
 */
import { ValidationError } from '../domain/errors.js';
import {
  rejectUnknownFields,
  requireObject,
  requirePositiveIntegerText,
  toHourMinute,
} from './fields.js';

const DEFAULT_PAGE = 10;
const MAX_PAGE = 50;
const NON_NEGATIVE_INTEGER_TEXT = /^(0|[1-9]\d*)$/;

// A number of the query string between min and max, or the default when it is not there.
const optionalIntegerText = (value, field, { min, max, fallback }) => {
  if (value === undefined) return fallback;
  const number = typeof value === 'string' && NON_NEGATIVE_INTEGER_TEXT.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new ValidationError(`${field} must be an integer from ${min} to ${max}`);
  }
  return number;
};

// PUT /api/staff/slots/:slotId/menu  { "menu": "**Dinner**\n- Soup" }
export function parseSaveSlotMenu(params, body) {
  const slotId = requirePositiveIntegerText(params?.slotId, 'slotId');
  requireObject(body);
  rejectUnknownFields(body, ['menu']);
  if (typeof body.menu !== 'string') throw new ValidationError('menu must be a text');
  return { slotId, menu: body.menu };
}

// DELETE /api/staff/slots/:slotId/menu
export function parseDeleteSlotMenu(params) {
  return { slotId: requirePositiveIntegerText(params?.slotId, 'slotId') };
}

// GET /api/slots/:slotId/menu
export function parseGetSlotMenu(params) {
  return { slotId: requirePositiveIntegerText(params?.slotId, 'slotId') };
}

// GET /api/staff/menus?exceptSlotId=12&search=polenta&limit=10&offset=0. All optional.
export function parseListPreviousMenus(query) {
  const exceptSlotId = query?.exceptSlotId === undefined
    ? null
    : requirePositiveIntegerText(query.exceptSlotId, 'exceptSlotId');
  if (query?.search !== undefined && typeof query.search !== 'string') {
    throw new ValidationError('search must be a text');
  }
  const search = query?.search?.trim() ? query.search.trim() : null;
  return {
    exceptSlotId,
    search,
    limit: optionalIntegerText(query?.limit, 'limit', { min: 1, max: MAX_PAGE, fallback: DEFAULT_PAGE }),
    offset: optionalIntegerText(query?.offset, 'offset', { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0 }),
  };
}

export const toSlotMenuDto = ({ slotId, date, startsAt, endsAt, menu }) => ({
  slotId,
  date,
  startsAt: toHourMinute(startsAt),
  endsAt: toHourMinute(endsAt),
  menu,
});

export const toPreviousMenusDto = ({ menus, hasMore }) => ({
  menus: menus.map(toSlotMenuDto),
  hasMore,
});
