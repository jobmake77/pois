export function createRandomSeed(previousSeed?: number) {
  const maxSeed = 0x7fffffff;
  const nextSeed = Math.floor(Math.random() * maxSeed);

  if (typeof previousSeed === "number" && previousSeed >= 0 && nextSeed === previousSeed) {
    return (nextSeed + 1) % maxSeed;
  }

  return nextSeed;
}
