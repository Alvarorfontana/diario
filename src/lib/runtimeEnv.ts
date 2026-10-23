type RuntimeEnv = Record<string, string | undefined>;

export function getRuntimeEnv(locals?: any): RuntimeEnv {
  // Vercel/Node: las variables de entorno se leen en cada solicitud.
  const nodeEnv: RuntimeEnv =
    typeof process !== 'undefined' && process.env ? process.env as RuntimeEnv : {};
  const runtimeEnv = (locals as any)?.runtime?.env;
  // Algunas integraciones exponen runtime.env sin todas las variables.
  // No debe ocultar ADMIN_PASSWORD ni BREVO_* definidas en Vercel.
  if (runtimeEnv && typeof runtimeEnv === 'object') {
    return { ...import.meta.env, ...nodeEnv, ...runtimeEnv };
  }
  return { ...import.meta.env, ...nodeEnv };
}
