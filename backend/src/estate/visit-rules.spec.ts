import {
  nextVisitState,
  santiagoParts,
  validateVisitWindow,
  visitInstant,
} from './visit-rules';
describe('Agenda de visitas', () => {
  it('interpreta Santiago tanto en verano como invierno', () => {
    expect(visitInstant('2026-12-10', '15:30').toISOString()).toBe(
      '2026-12-10T18:30:00.000Z',
    );
    expect(visitInstant('2026-06-10', '15:30').toISOString()).toBe(
      '2026-06-10T19:30:00.000Z',
    );
    expect(santiagoParts(new Date('2026-12-10T18:30:00Z'))).toEqual({
      date: '2026-12-10',
      time: '15:30',
    });
  });
  it('rechaza fechas inexistentes, horas ambiguas y saltos de horario', () => {
    for (const [date, time] of [
      ['2026-02-30', '12:00'],
      ['2026-09-06', '00:30'],
      ['2026-04-04', '23:30'],
      ['2026-12-10', '25:00'],
    ])
      expect(() => visitInstant(date, time)).toThrow();
  });
  it('requiere una hora de anticipación y un máximo de 180 días', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    expect(() => validateVisitWindow(new Date(now + 3599000), now)).toThrow();
    expect(() =>
      validateVisitWindow(new Date(now + 181 * 86400000), now),
    ).toThrow();
    expect(() =>
      validateVisitWindow(new Date(now + 3600000), now),
    ).not.toThrow();
  });
  it('solo la contraparte puede confirmar o rechazar la última propuesta', () => {
    expect(
      nextVisitState(
        'requested',
        'accept',
        'seller',
        'buyer',
        'seller',
        'buyer',
      ),
    ).toBe('confirmed');
    expect(() =>
      nextVisitState(
        'requested',
        'accept',
        'buyer',
        'buyer',
        'seller',
        'buyer',
      ),
    ).toThrow();
    expect(
      nextVisitState(
        'proposed',
        'accept',
        'buyer',
        'buyer',
        'seller',
        'seller',
      ),
    ).toBe('confirmed');
    expect(() =>
      nextVisitState(
        'proposed',
        'reject',
        'seller',
        'buyer',
        'seller',
        'seller',
      ),
    ).toThrow();
  });
  it('impide confirmar por terceros y permite al administrador cancelar sin suplantar', () => {
    expect(() =>
      nextVisitState(
        'requested',
        'accept',
        'admin',
        'buyer',
        'seller',
        'buyer',
        true,
      ),
    ).toThrow();
    expect(() =>
      nextVisitState(
        'requested',
        'propose',
        'stranger',
        'buyer',
        'seller',
        'buyer',
      ),
    ).toThrow();
    expect(
      nextVisitState(
        'confirmed',
        'cancel',
        'admin',
        'buyer',
        'seller',
        'buyer',
        true,
      ),
    ).toBe('cancelled');
    expect(() =>
      nextVisitState(
        'completed',
        'cancel',
        'admin',
        'buyer',
        'seller',
        'buyer',
        true,
      ),
    ).toThrow();
  });
  it('solo el vendedor puede marcar como realizada una visita confirmada', () => {
    expect(
      nextVisitState(
        'confirmed',
        'complete',
        'seller',
        'buyer',
        'seller',
        'buyer',
      ),
    ).toBe('completed');
    expect(() =>
      nextVisitState(
        'confirmed',
        'complete',
        'buyer',
        'buyer',
        'seller',
        'buyer',
      ),
    ).toThrow();
    expect(() =>
      nextVisitState(
        'requested',
        'complete',
        'seller',
        'buyer',
        'seller',
        'buyer',
      ),
    ).toThrow();
  });
});
