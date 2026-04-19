import dotenv from "dotenv";

dotenv.config();

export function getEnvVar(varName: string, warnIfNotSet = true): string | undefined {
  const value = process.env[varName];
  if (warnIfNotSet && !value) {
    console.warn(`No such environment variable: ${varName}`);
  }
  return value;
}
