const REQUIRED = [
  "DATABASE_URL",
  "VIDADIGITAL_DATABASE_URL",
  "NEXTAUTH_SECRET",
] as const;

export function validateEnv(): void {
  for (const key of REQUIRED) {
    if (!process.env[key]) {
      throw new Error(`Falta variable de entorno requerida: ${key}`);
    }
  }
}
