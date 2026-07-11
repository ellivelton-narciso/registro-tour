import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { API_URL, apiFetch } from '../../api/client';
import type { PokemonEntry, TournamentConfig } from '../../api/types';

const MONOTYPE_OPTIONS = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel',
].map((v) => ({ value: v, label: v }));

function isChampionsGen(gen?: number) {
  return Number(gen) === 9;
}

function normalizePokemonName(name: string) {
  return (name || '').trim().toLowerCase();
}

function debounce<T extends (...args: never[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function RegistrationPage() {
  const [config, setConfig] = useState<TournamentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoLocked, setCodigoLocked] = useState(false);
  const [monotype, setMonotype] = useState<string | null>('normal');
  const [pokemonOptions, setPokemonOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<{ value: string; label: string }[]>([]);
  const [allPokemonData, setAllPokemonData] = useState<PokemonEntry[]>([]);
  const [playerPrizeNames, setPlayerPrizeNames] = useState<string[]>([]);
  const [teamFile, setTeamFile] = useState<File | null>(null);
  const [teamPreview, setTeamPreview] = useState<string | null>(null);
  const prevSelection = useRef<string[]>([]);

  const championsMode = isChampionsGen(config?.gen);

  const loadPokemon = useCallback(async (gen: number) => {
    const gens = await Promise.all(
      Array.from({ length: gen }, (_, i) =>
        apiFetch<PokemonEntry[]>(`/pokemons?gen=${i + 1}`)
      )
    );
    const flat = gens.flat();
    setAllPokemonData(flat);
    return flat;
  }, []);

  const buildOptions = useCallback(
    (data: PokemonEntry[], prizeSet: Set<string>, selectedType?: string | null) => {
      const banned = new Set((config?.listabanido || []).map(normalizePokemonName));
      const options: { value: string; label: string }[] = [];
      const seen = new Set<string>();

      for (const p of data) {
        if (!p.name) continue;
        const norm = normalizePokemonName(p.name);
        const isPrize = prizeSet.has(norm);
        if (banned.has(norm) && !isPrize) continue;
        if (selectedType && (!p.type || !p.type.includes(selectedType))) continue;
        if (!seen.has(p.name)) {
          seen.add(p.name);
          options.push({ value: p.name, label: p.name });
        }
      }
      setPokemonOptions(options);
    },
    [config]
  );

  useEffect(() => {
    apiFetch<TournamentConfig>('/getConfig')
      .then(async (cfg) => {
        if (cfg.error) throw new Error(cfg.error);
        setConfig(cfg);
        document.title = cfg.titulo || 'Inscrição';
        if (!championsMode && cfg.gen) {
          const data = await loadPokemon(cfg.gen);
          buildOptions(data, new Set());
        }
      })
      .catch((err) => {
        Swal.fire({
          icon: 'error',
          title: 'Erro de Conexão',
          text: err instanceof Error ? err.message : 'Não foi possível carregar as configurações.',
        });
      })
      .finally(() => setLoading(false));
  }, [buildOptions, championsMode, loadPokemon]);

  const prizeSet = useMemo(() => new Set(playerPrizeNames.map(normalizePokemonName)), [playerPrizeNames]);

  useEffect(() => {
    if (!config || championsMode || !allPokemonData.length) return;
    buildOptions(allPokemonData, prizeSet, config.monotype ? monotype : null);
  }, [allPokemonData, buildOptions, championsMode, config, monotype, prizeSet]);

  const debouncedPrizeByCode = useMemo(
    () =>
      debounce(async (code: string) => {
        if (!code) return;
        const prize = await apiFetch<Array<{ pokemonList?: string[] }>>(`/getPrizes?codigo=${code}`).catch(() => []);
        const row = Array.isArray(prize) && prize[0] ? prize[0] : null;
        if (row?.pokemonList?.length) {
          setPokemonOptions((prev) => {
            const map = new Map(prev.map((o) => [o.value, o]));
            for (const p of row.pokemonList!) {
              if (!map.has(p)) map.set(p, { value: p, label: p });
            }
            return [...map.values()];
          });
          setCodigoLocked(true);
        }
      }, 500),
    []
  );

  const debouncedPrizeByNick = useMemo(
    () =>
      debounce(async (nick: string) => {
        if (nick.length < 3) {
          setPlayerPrizeNames([]);
          return;
        }
        const data = await fetch(`${API_URL}/players/${encodeURIComponent(nick)}/prize-pokemons`)
          .then(async (r) => (r.status === 404 ? null : r.ok ? r.json() : null))
          .catch(() => null);
        const names: string[] = (data?.prize_pokemons || [])
          .filter((p: { generation?: number }) => !config?.gen || !p.generation || p.generation <= config.gen!)
          .map((p: { pokemon_name?: string; name?: string }) => p.pokemon_name || p.name || '')
          .filter(Boolean);
        setPlayerPrizeNames([...new Set(names)]);
      }, 500),
    [config?.gen]
  );

  function onPokemonChange(values: { value: string; label: string }[]) {
    if (!config) return;
    const names = values.map((v) => v.value);
    const limited = config.listalimitado || [];
    const legendary = config.listalimitadolendario || [];
    const countLimited = names.filter(
      (p) => limited.includes(p) && !prizeSet.has(normalizePokemonName(p))
    ).length;
    const countLegendary = names.filter(
      (p) => legendary.includes(p) && !prizeSet.has(normalizePokemonName(p))
    ).length;

    if (countLimited > (config.qtdlimitado ?? 0)) {
      Swal.fire({
        icon: 'warning',
        title: 'Limite de Pokemons Limitados Excedido',
        text: `Você pode selecionar no máximo ${config.qtdlimitado ?? 0} Pokémon limitados.`,
      });
      setSelectedPokemon(prevSelection.current.map((v) => ({ value: v, label: v })));
      return;
    }
    if (countLegendary > (config.qtdlimitadolendario ?? 0)) {
      Swal.fire({
        icon: 'warning',
        title: 'Limite de Lendários Excedido',
        text: `Você pode selecionar no máximo ${config.qtdlimitadolendario ?? 0} Pokémon lendários.`,
      });
      setSelectedPokemon(prevSelection.current.map((v) => ({ value: v, label: v })));
      return;
    }
    if (names.length > (config.qtdescolha ?? 10)) {
      Swal.fire({
        icon: 'warning',
        title: 'Limite Excedido',
        text: `Você pode selecionar no máximo ${config.qtdescolha ?? 10} Pokémon.`,
      });
      setSelectedPokemon(prevSelection.current.map((v) => ({ value: v, label: v })));
      return;
    }
    prevSelection.current = names;
    setSelectedPokemon(values);
  }

  async function uploadTeamImage(file: File) {
    const formData = new FormData();
    formData.append('teamImage', file);
    const res = await fetch(`${API_URL}/upload-team-image`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar imagem do time.');
    return data;
  }

  async function submitRegistration(payload: Record<string, unknown>) {
    const data = await apiFetch<{ message?: string; error?: string }>('/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    Swal.fire({ icon: 'success', title: 'Formulário Enviado', text: data.message });
    setName('');
    setEmail('');
    setSelectedPokemon([]);
    setTeamFile(null);
    setTeamPreview(null);
    if (config?.enviardiscord && config.hook) {
      fetch(config.hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `Novo registro: ${payload.name}` }),
      }).catch(console.error);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!config?.id) return;
    if (!name.trim() || !email.trim()) {
      Swal.fire({ icon: 'error', title: 'Campos Obrigatórios', text: 'Preencha nick e contato.' });
      return;
    }

    if (championsMode) {
      if (!teamFile) {
        Swal.fire({ icon: 'error', title: 'Imagem Obrigatória', text: 'Envie um print do seu time no Pokémon Champions.' });
        return;
      }
      const result = await Swal.fire({
        icon: 'info',
        title: 'Confirmar seu time',
        html: `<p>Confirme se este é o time que deseja cadastrar, com <strong>moves e itens corretos</strong>:</p>
               <img src="${teamPreview}" style="max-width:100%; border-radius:8px; margin-top:10px;">`,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
      });
      if (!result.isConfirmed) return;
      try {
        const upload = await uploadTeamImage(teamFile);
        await submitRegistration({
          tournamentId: config.id,
          name: name.trim(),
          email: email.trim(),
          teamImage: upload.filename,
        });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro no Upload', text: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const list = selectedPokemon.map((p) => p.value);
    if (!list.length) {
      Swal.fire({ icon: 'error', title: 'Campos Obrigatórios', text: 'Preencha todos os campos.' });
      return;
    }
    if (list.length !== (config.qtdescolha ?? 10)) {
      Swal.fire({
        icon: 'error',
        title: 'Seleção Inválida',
        text: `Escolha exatamente ${config.qtdescolha ?? 10} Pokémon.`,
      });
      return;
    }

    const sprites = config.sprites ?? 'emerald';
    const html = list
      .map((nome) => {
        const data = allPokemonData.find((p) => p.name === nome);
        if (!data) return '';
        const spriteUrl = data.af
          ? `https://veekun.com/dex/media/pokemon/main-sprites/${sprites}/${data.id}-${data.af}.png`
          : `https://veekun.com/dex/media/pokemon/main-sprites/${sprites}/${data.id}.png`;
        return `<div style="margin-bottom:10px;"><p><strong>${nome}</strong></p><img src="${spriteUrl}" style="width:100px;"></div>`;
      })
      .join('');

    const result = await Swal.fire({
      icon: 'info',
      title: 'Confirmar Escolha',
      html,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      const pokemonPayload = list.map((nome) => {
        const p = allPokemonData.find((x) => x.name === nome)!;
        return { id: p.id, af: p.af || '' };
      });
      try {
        await submitRegistration({
          tournamentId: config.id,
          name: name.trim(),
          email: email.trim(),
          pokemonList: pokemonPayload,
        });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro no Envio', text: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  if (loading) return <div className="container mt-5 text-center">Carregando...</div>;
  if (config?.encerrado) return <Navigate to="/encerradas" replace />;

  return (
    <div className="container mt-5">
      <h1 className="text-center mb-4">{config?.titulo2}</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="name" className="form-label">Nick/Nome</label>
          <input
            type="text"
            className="form-control"
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              debouncedPrizeByNick(e.target.value.trim());
            }}
            placeholder="Digite seu nome"
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="email" className="form-label">Contato (Nº Whatsapp)</label>
          <input
            type="text"
            className="form-control"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Digite seu contato"
            required
          />
        </div>

        {!championsMode && config?.monotype && (
          <div className="mb-3">
            <label className="form-label">Selecione seu tipo</label>
            <Select
              options={MONOTYPE_OPTIONS}
              value={MONOTYPE_OPTIONS.find((o) => o.value === monotype) ?? null}
              onChange={(opt) => setMonotype(opt?.value ?? null)}
            />
          </div>
        )}

        {championsMode && (
          <div className="mb-3">
            <label htmlFor="team-image" className="form-label">
              Envie um print do seu time no Pokémon Champions
            </label>
            <input
              type="file"
              className="form-control"
              id="team-image"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setTeamFile(file);
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setTeamPreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                } else {
                  setTeamPreview(null);
                }
              }}
              required
            />
            <small className="text-muted">
              Tire um screenshot do seu time com moves e itens visíveis. PNG, JPEG ou WebP (máx. 5 MB).
            </small>
            {teamPreview && (
              <div className="mt-3">
                <img src={teamPreview} alt="Preview do time" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #dee2e6' }} />
              </div>
            )}
          </div>
        )}

        {!championsMode && (
          <div className="mb-3">
            <label className="form-label">Selecione até {config?.qtdescolha ?? 10} Pokémon</label>
            <Select
              isMulti
              options={pokemonOptions}
              value={selectedPokemon}
              onChange={(v) => onPokemonChange([...(v || [])])}
              placeholder="Escolha seus Pokémon"
            />
          </div>
        )}

        {!championsMode && config?.prizes && (
          <div className="mb-3">
            <label htmlFor="codigo" className="form-label">Código</label>
            <input
              type="text"
              className="form-control"
              id="codigo"
              value={codigo}
              disabled={codigoLocked}
              onChange={(e) => {
                setCodigo(e.target.value);
                debouncedPrizeByCode(e.target.value.trim());
              }}
              placeholder="Caso tenha um código, digite aqui."
            />
          </div>
        )}

        <button type="submit" className="btn btn-primary w-100">Enviar</button>
      </form>
    </div>
  );
}
