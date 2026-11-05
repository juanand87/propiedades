import { exampleProperty, demoId, exampleSvg } from './demo-properties';
import { DemoService } from './demo.service';
describe('Ejemplos limitados al proyecto de Propiedades', () => {
  it('genera exactamente veinte identidades estables con tres imágenes cada una', () => {
    const props = Array.from({ length: 20 }, (_, i) => exampleProperty(i));
    expect(new Set(props.map((p) => p.id)).size).toBe(20);
    expect(new Set(props.map((p) => p.code)).size).toBe(20);
    expect(new Set(props.map((p) => p.type)).size).toBe(3);
    expect(
      new Set(
        props.flatMap((_, i) =>
          [0, 1, 2].map((v) => demoId(`media-${i}-${v}`)),
        ),
      ).size,
    ).toBe(60);
    expect(exampleProperty(0).id).toBe(exampleProperty(0).id);
    expect(exampleSvg(0, 0)).toContain('Datos ficticios');
    expect(exampleSvg(0, 0)).not.toContain('https://');
  });
  it('rechaza usuarios sin permisos y bases distintas antes de consultar datos', async () => {
    const query = jest.fn();
    const normal: any = { id: 'qa', role: 'customer' };
    await expect(
      new DemoService({
        options: { database: 'propiedades' },
        query,
      } as any).status(normal),
    ).rejects.toThrow('administración');
    await expect(
      new DemoService({ options: { database: 'otra' }, query } as any).status({
        ...normal,
        role: 'admin',
      }),
    ).rejects.toThrow('propiedades');
    expect(query).not.toHaveBeenCalled();
  });
});
