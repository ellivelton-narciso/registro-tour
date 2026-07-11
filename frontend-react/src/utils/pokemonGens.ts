export interface GenPokemon {
  name: string;
}

export async function loadAllGenPokemonNames(): Promise<string[]> {
  const files = [
    'primeiraGen.json',
    'segundaGen.json',
    'terceiraGen.json',
    'quartaGen.json',
    'quintaGen.json',
  ];

  const gens = await Promise.all(
    files.map((f) => fetch(`/json/${f}`).then((r) => r.json() as Promise<GenPokemon[] | string[]>))
  );

  const names: string[] = [];
  for (const gen of gens) {
    for (const pokemon of gen) {
      if (typeof pokemon === 'object' && pokemon && 'name' in pokemon) {
        names.push((pokemon as GenPokemon).name);
      } else if (typeof pokemon === 'string') {
        names.push(pokemon);
      }
    }
  }
  return names;
}

export async function loadPokemonNamesUpToGen(gen: number): Promise<string[]> {
  const files = [
    'primeiraGen.json',
    'segundaGen.json',
    'terceiraGen.json',
    'quartaGen.json',
    'quintaGen.json',
  ].slice(0, Math.min(gen, 5));

  const gens = await Promise.all(
    files.map((f) => fetch(`/json/${f}`).then((r) => r.json() as Promise<GenPokemon[] | string[]>))
  );

  const names: string[] = [];
  for (const genList of gens) {
    for (const pokemon of genList) {
      if (typeof pokemon === 'object' && pokemon && 'name' in pokemon) {
        names.push((pokemon as GenPokemon).name);
      } else if (typeof pokemon === 'string') {
        names.push(pokemon);
      }
    }
  }
  return names;
}
