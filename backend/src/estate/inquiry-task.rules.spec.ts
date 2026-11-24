import { taskDeadline } from './inquiry-task.rules';
describe('Task times in Santiago', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  it('converts a future local time to a UTC instant', () =>
    expect(taskDeadline('2026-11-24', '10:00', now).toISOString()).toBe(
      '2026-11-24T13:00:00.000Z',
    ));
  it.each([
    ['2026-11-24', '09:00'],
    ['2026-11-23', '10:00'],
    ['2027-11-25', '10:00'],
    ['2026-02-30', '10:00'],
    ['2026-11-24', '25:00'],
  ])('rejects %s %s', (date, time) =>
    expect(() => taskDeadline(date, time, now)).toThrow(),
  );
});
