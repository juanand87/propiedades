# Proppix 1.0.21 · gesto Inicio → Propiedades

El usuario confirmó que el deslizamiento de 1.0.20 no funcionaba en su teléfono. Las pruebas de umbrales de movimiento no habían validado la recepción del gesto por Android.

Se sustituye `PanResponder` por reconocimiento nativo de React Native Gesture Handler, registrado como dependencia directa compatible con Expo SDK 58. La raíz de la app usa `GestureHandlerRootView`.

- El gesto horizontal se aplica sobre la superficie de Inicio.
- La lista vertical participa mediante un gesto nativo separado. Espera a que falle el horizontal: un movimiento vertical de más de 18 puntos lo descarta; uno horizontal a la izquierda lo activa después de 24 puntos.
- Al terminar un deslizamiento de al menos 65 puntos hacia la izquierda, predominantemente horizontal y sin cancelación, se abre Propiedades.
- Los toques y el scroll vertical conservan sus funciones. Los gestos cancelados no navegan.

Validación: TypeScript y lint; compilación y firma locales. La prueba visual quedó pendiente: se inició el emulador y se instaló 1.0.20 para comparar, pero el control de aplicaciones fue detenido por el usuario con Escape antes de realizar el gesto. No se afirma que la navegación esté validada en Android hasta comprobarla con 1.0.21.
