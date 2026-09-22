/**
 * Supabase no distingue de forma confiable, solo por el nombre del evento de
 * `onAuthStateChange`, entre "esta sesión se acaba de crear porque la
 * persona metió sus credenciales ahora mismo" y "esta sesión ya existía y se
 * acaba de restaurar sola al cargar la página". Restaurar desde
 * almacenamiento una sesión que sigue siendo válida (no necesita refrescar
 * el token) también notifica como `SIGNED_IN`, exactamente igual que un
 * login real — no hay forma de diferenciarlos mirando solo el evento o la
 * sesión.
 *
 * Por eso marcamos nosotros mismos, en el momento exacto en que la persona
 * somete el formulario de acceso, que la sesión que viene a continuación es
 * "intencional" y no una restauración silenciosa.
 */
let intentionalSignIn = false;

export function markIntentionalSignIn(): void {
  intentionalSignIn = true;
}

/** Lee la marca y la resetea en el mismo paso, para no dejarla "pegada". */
export function consumeIntentionalSignIn(): boolean {
  const was = intentionalSignIn;
  intentionalSignIn = false;
  return was;
}
