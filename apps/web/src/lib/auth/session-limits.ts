function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const MAX_DEVICES_PER_USER = readPositiveInt(
  process.env.MAX_DEVICES_PER_USER,
  2
);
