import { supabase } from '../lib/supabase';

/** El código de 6 dígitos ya canjeado por la cuenta actual, o null si aún no tiene uno. */
export async function getMyAccessCode(): Promise<string | null> {
  const { data, error } = await supabase.from('access_codes').select('code').maybeSingle();
  if (error) throw error;
  return data?.code ?? null;
}

/** Intenta canjear un código de 6 dígitos para la cuenta actual. */
export async function redeemAccessCode(code: string): Promise<void> {
  const { data, error } = await supabase.rpc('redeem_access_code', { p_code: code });
  if (error) throw error;
  // La función devuelve el mensaje de error como texto (en vez de lanzarlo)
  // cuando el código es inválido, para poder registrar el intento fallido
  // sin que la excepción revierta ese registro. Null significa éxito.
  if (data) throw new Error(data);
}
