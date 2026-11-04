import { describe, expect, it } from 'vitest';
import { makeAssignTableSet } from '../../src/usecases/assignTableSet.js';
import { makeCreateStaffSlot } from '../../src/usecases/createStaffSlot.js';
import { makeCreateTableSet } from '../../src/usecases/createTableSet.js';
import { makeListStaffSlots } from '../../src/usecases/listStaffSlots.js';
import { makeListTableSets } from '../../src/usecases/listTableSets.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../src/domain/errors.js';

const employee = { id: 1, role: 'EMPLOYEE' };
const warden = { id: 2, role: 'WARDEN' };
const hiker = { id: 3, role: 'HIKER' };

const lunch = { tableSetId: 3, name: 'Lunch', tables: [{ tableNumber: 2, capacity: 4 }, { tableNumber: 1, capacity: 6 }] };
const described = { ...lunch, tables: [{ tableNumber: 1, capacity: 6 }, { tableNumber: 2, capacity: 4 }], totalSeats: 10 };

// In-memory daos. `calls` says what was written.
function setup({ sets = [lunch], slots = [] } = {}) {
  const calls = [];
  const slotRows = slots.map((slot) => ({ ...slot }));
  const tableSets = {
    findAll: async () => sets,
    findByIds: async (ids) => sets.filter((set) => ids.includes(set.tableSetId)),
    findById: async (id) => sets.find((set) => set.tableSetId === id) ?? null,
    insert: async (input) => {
      calls.push(['insertSet', input]);
      if (sets.some((set) => set.name === input.name)) return null;
      sets.push({ tableSetId: 10 + sets.length, ...input });
      return sets.at(-1).tableSetId;
    },
  };
  const slotDao = {
    findById: async (id) => slotRows.find((slot) => slot.slotId === id) ?? null,
    findBetween: async (from, to) => slotRows.filter((slot) => slot.serviceDate >= from && slot.serviceDate <= to),
    insert: async (input) => {
      calls.push(['insertSlot', input]);
      if (slotRows.some((slot) => slot.serviceDate === input.serviceDate && slot.startsAt === input.startsAt)) return null;
      slotRows.push({ slotId: 100 + slotRows.length, ...input });
      return { slotId: slotRows.at(-1).slotId };
    },
    assignTableSet: async (slotId, tableSetId) => {
      calls.push(['assign', slotId, tableSetId]);
      const slot = slotRows.find((row) => row.slotId === slotId);
      if (slot.tableSetId !== null) return false;
      slot.tableSetId = tableSetId;
      return true;
    },
  };
  return { calls, tableSets, slots: slotDao };
}

const row = (slotId, serviceDate, startsAt, tableSetId = null) => ({ slotId, serviceDate, startsAt, endsAt: '23:00:00', tableSetId });

describe('who can do it', () => {
  it('lets the employees and the warden, and answers 403 to a hiker, for every operation', async () => {
    const operation = (index, user) => {
      const { tableSets, slots } = setup({ slots: [row(1, '2026-10-28', '12:00:00')] });
      const operations = [
        () => makeCreateTableSet({ tableSets })({ user, name: `New ${index}`, tables: [{ tableNumber: 1, capacity: 2 }] }),
        () => makeListTableSets({ tableSets })({ user }),
        () => makeCreateStaffSlot({ slots, tableSets })({ user, date: '2026-11-01', startsAt: '12:00', endsAt: '13:00' }),
        () => makeListStaffSlots({ slots, tableSets })({ user, from: '2026-10-01', to: '2026-12-31' }),
        () => makeAssignTableSet({ slots, tableSets })({ user, slotId: 1, tableSetId: 3 }),
      ];
      return operations[index]();
    };

    const operations = [0, 1, 2, 3, 4];
    for (const [index, operationIndex] of operations.entries()) {
      await expect(operation(operationIndex, hiker), `hiker operation ${index}`)
        .rejects.toThrow(new ForbiddenError('Only the staff can do this'));
      await expect(operation(operationIndex, employee), `employee operation ${index}`).resolves.toBeDefined();
      await expect(operation(operationIndex, warden), `warden operation ${index}`).resolves.toBeDefined();
    }
  });

  it('does not write anything for a hiker', async () => {
    const t = setup();
    await expect(makeCreateTableSet({ tableSets: t.tableSets })({ user: hiker, name: 'x', tables: [] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(makeCreateStaffSlot(t)({ user: hiker, date: '2026-11-01', startsAt: '12:00', endsAt: '13:00' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(t.calls).toEqual([]);
  });
});

describe('createTableSet', () => {
  it('creates the set and answers with it, tables in order, with the seats', async () => {
    const t = setup({ sets: [] });
    const created = await makeCreateTableSet(t)({ user: employee, name: 'Dinner', tables: [{ tableNumber: 2, capacity: 4 }, { tableNumber: 1, capacity: 6 }] });
    expect(created).toEqual({
      tableSetId: 10, name: 'Dinner', tables: [{ tableNumber: 1, capacity: 6 }, { tableNumber: 2, capacity: 4 }], totalSeats: 10,
    });
  });

  it('answers 409 when the name is taken', async () => {
    const t = setup();
    await expect(makeCreateTableSet(t)({ user: employee, name: 'Lunch', tables: [{ tableNumber: 1, capacity: 2 }] }))
      .rejects.toThrow(new ConflictError('A table set named Lunch already exists'));
  });
});

describe('listTableSets', () => {
  it('lists the sets described', async () => {
    expect(await makeListTableSets(setup())({ user: warden })).toEqual([described]);
    expect(await makeListTableSets(setup({ sets: [] }))({ user: warden })).toEqual([]);
  });
});

describe('createStaffSlot', () => {
  const input = { user: employee, date: '2026-10-28', startsAt: '12:00', endsAt: '13:00' };

  it('creates a slot with a table set and answers with it', async () => {
    const t = setup();
    expect(await makeCreateStaffSlot(t)({ ...input, tableSetId: 3 })).toEqual({
      slotId: 100, date: '2026-10-28', startsAt: '12:00', endsAt: '13:00', tableSet: described, totalSeats: 10,
    });
    expect(t.calls).toEqual([['insertSlot', { serviceDate: '2026-10-28', startsAt: '12:00', endsAt: '13:00', tableSetId: 3 }]]);
  });

  it('creates a slot without a table set: no seats', async () => {
    const t = setup();
    expect(await makeCreateStaffSlot(t)(input)).toMatchObject({ tableSet: null, totalSeats: 0 });
    expect(t.calls[0][1].tableSetId).toBeNull();
  });

  it('allows more slots on a day', async () => {
    const t = setup();
    await makeCreateStaffSlot(t)(input);
    await expect(makeCreateStaffSlot(t)({ ...input, startsAt: '13:00', endsAt: '14:00' })).resolves.toMatchObject({ slotId: 101 });
  });

  it('answers 404 for a table set that does not exist, without creating the slot', async () => {
    const t = setup();
    await expect(makeCreateStaffSlot(t)({ ...input, tableSetId: 99 })).rejects.toThrow(new NotFoundError('Table set 99 not found'));
    expect(t.calls).toEqual([]);
  });

  it('answers 409 for a slot starting at the same time on that day', async () => {
    const t = setup({ slots: [row(1, '2026-10-28', '12:00')] });
    await expect(makeCreateStaffSlot(t)(input)).rejects.toThrow(new ConflictError('A slot starting at 12:00 already exists on 2026-10-28'));
  });
});

describe('listStaffSlots', () => {
  it('lists the slots of the period, with or without a table set, each with its set', async () => {
    const t = setup({
      slots: [row(1, '2026-10-28', '12:00:00', 3), row(2, '2026-10-28', '13:00:00'), row(3, '2026-11-30', '12:00:00', 3)],
    });
    const list = await makeListStaffSlots(t)({ user: employee, from: '2026-10-01', to: '2026-10-31' });
    expect(list.map((slot) => [slot.slotId, slot.totalSeats])).toEqual([[1, 10], [2, 0]]);
    expect(list[0].tableSet).toEqual(described);
    expect(list[1].tableSet).toBeNull();
  });

  it('answers an empty list when there is nothing', async () => {
    expect(await makeListStaffSlots(setup())({ user: employee, from: '2026-10-01', to: '2026-10-31' })).toEqual([]);
  });
});

describe('assignTableSet', () => {
  const assign = (t, slotId = 1, tableSetId = 3) => makeAssignTableSet(t)({ user: employee, slotId, tableSetId });

  it('gives the table set to a slot that has none', async () => {
    const t = setup({ slots: [row(1, '2026-10-28', '12:00:00')] });
    expect(await assign(t)).toMatchObject({ slotId: 1, tableSet: described, totalSeats: 10 });
    expect(t.calls).toEqual([['assign', 1, 3]]);
  });

  it('answers 200 again for the table set the slot has already, and writes nothing', async () => {
    const t = setup({ slots: [row(1, '2026-10-28', '12:00:00', 3)] });
    expect(await assign(t)).toMatchObject({ totalSeats: 10 });
    expect(t.calls).toEqual([]);
  });

  it('answers 409 for another table set when the slot has one', async () => {
    const t = setup({ sets: [lunch, { tableSetId: 4, name: 'Dinner', tables: [{ tableNumber: 1, capacity: 2 }] }], slots: [row(1, '2026-10-28', '12:00:00', 3)] });
    await expect(assign(t, 1, 4)).rejects.toThrow(new ConflictError('Slot 1 already has a different table set'));
  });

  it('answers 409 when someone gave the slot another set just before, and 200 when it was this one', async () => {
    const dinner = { tableSetId: 4, name: 'Dinner', tables: [{ tableNumber: 1, capacity: 2 }] };
    const t = setup({ sets: [lunch, dinner], slots: [row(1, '2026-10-28', '12:00:00')] });
    const race = (winner) => {
      const real = t.slots.assignTableSet;
      t.slots.assignTableSet = async (slotId, tableSetId) => {
        await real(slotId, winner); // the other request wins
        return real(slotId, tableSetId);
      };
    };
    race(4);
    await expect(assign(t, 1, 3)).rejects.toBeInstanceOf(ConflictError);

    const same = setup({ slots: [row(1, '2026-10-28', '12:00:00')] });
    const real = same.slots.assignTableSet;
    same.slots.assignTableSet = async (slotId, tableSetId) => { await real(slotId, 3); return real(slotId, tableSetId); };
    await expect(assign(same, 1, 3)).resolves.toMatchObject({ slotId: 1 });
  });

  it('answers 404 for a slot or a table set that does not exist', async () => {
    const t = setup({ slots: [row(1, '2026-10-28', '12:00:00')] });
    await expect(assign(t, 9, 3)).rejects.toThrow(new NotFoundError('Slot 9 not found'));
    await expect(assign(t, 1, 99)).rejects.toThrow(new NotFoundError('Table set 99 not found'));
    expect(t.calls).toEqual([]);
  });
});
