import { useEffect, useState, type FormEvent } from 'react';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { apiFetch } from '../../api/client';
import type { TournamentConfig } from '../../api/types';
import { AdminNav } from '../../components/AdminNav';
import { subwaySelectProps } from '../../utils/selectProps';
import { loadPokemonNamesUpToGen } from '../../utils/pokemonGens';

function isChampionsGen(gen: number) {
  return gen === 9;
}

export function ConfigPage() {
  const [config, setConfig] = useState<TournamentConfig | null>(null);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [pokemonOptions, setPokemonOptions] = useState<{ value: string; label: string }[]>([]);
  const [form, setForm] = useState({
    titulo: '',
    titulo2: '',
    gen: '1',
    sprites: 'emerald',
    qtdLimitado: '2',
    qtdLimitadoLendario: '2',
    qtdEscolha: '10',
    hook: '',
    enviarDiscord: false,
    prizes: false,
    panelEnabled: true,
    monotype: false,
    paymentRegister: '50',
    listaLimitado: [] as string[],
    listaLimitadoLendario: [] as string[],
    listaBanido: [] as string[],
  });

  const champions = isChampionsGen(Number(form.gen));

  async function loadPokemonLists(gen: number) {
    const names = await loadPokemonNamesUpToGen(gen);
    setPokemonOptions(names.map((n) => ({ value: n, label: n })));
  }

  useEffect(() => {
    document.title = 'Painel Admin';
    apiFetch<TournamentConfig>('/getConfig', { auth: true })
      .then(async (data) => {
        setConfig(data);
        setTournamentId(data.id);
        const gen = Number(data.gen || 1);
        setForm({
          titulo: data.titulo || '',
          titulo2: data.titulo2 || '',
          gen: String(data.gen || 1),
          sprites: data.sprites || 'emerald',
          qtdLimitado: String(data.qtdlimitado ?? 2),
          qtdLimitadoLendario: String(data.qtdlimitadolendario ?? 2),
          qtdEscolha: String(data.qtdescolha ?? 10),
          hook: data.hook || '',
          enviarDiscord: Boolean(data.enviardiscord),
          prizes: Boolean(data.prizes),
          panelEnabled: data.encerrado === 0 || data.encerrado === false,
          monotype: Boolean(data.monotype),
          paymentRegister: String(data.paymentregister ?? 50),
          listaLimitado: data.listalimitado || [],
          listaLimitadoLendario: data.listalimitadolendario || [],
          listaBanido: data.listabanido || [],
        });
        if (!isChampionsGen(gen)) await loadPokemonLists(gen);
      })
      .catch((err) => {
        Swal.fire({ icon: 'error', title: 'Erro', text: err instanceof Error ? err.message : 'Erro ao carregar config.' });
      });
  }, []);

  async function onGenChange(gen: string) {
    setForm((f) => ({ ...f, gen }));
    if (!isChampionsGen(Number(gen))) await loadPokemonLists(Number(gen));
  }

  async function saveConfig(e: FormEvent) {
    e.preventDefault();
    if (!tournamentId) return;
    try {
      await apiFetch('/updateConfig', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          tournamentId,
          titulo: form.titulo,
          titulo2: form.titulo2,
          gen: form.gen,
          sprites: form.sprites,
          qtdLimitado: form.qtdLimitado,
          qtdLimitadoLendario: form.qtdLimitadoLendario,
          hook: form.hook,
          enviarDiscord: form.enviarDiscord ? 1 : 0,
          encerrado: form.panelEnabled ? 0 : 1,
          listaLimitado: form.listaLimitado,
          listaLimitadoLendario: form.listaLimitadoLendario,
          listaBanido: form.listaBanido,
          qtdEscolha: form.qtdEscolha,
          prizes: form.prizes ? 1 : 0,
          monotype: form.monotype ? 1 : 0,
          paymentRegister: form.paymentRegister,
        }),
      });
      Swal.fire({ icon: 'success', title: 'Configuração Atualizada', text: 'As configurações foram atualizadas com sucesso.' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Erro', text: err instanceof Error ? err.message : 'Erro ao salvar.' });
    }
  }

  async function createTournament() {
    const result = await Swal.fire({
      title: 'Criar novo torneio?',
      text: 'Isso irá criar um novo torneio com as configurações atuais.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, criar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
      const res = await apiFetch<{ tournamentId: number }>('/createTournament', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          titulo: form.titulo,
          titulo2: form.titulo2,
          gen: form.gen,
          sprites: form.sprites,
          qtdLimitado: form.qtdLimitado,
          qtdLimitadoLendario: form.qtdLimitadoLendario,
          qtdEscolha: form.qtdEscolha,
          hook: form.hook,
          enviarDiscord: form.enviarDiscord ? 1 : 0,
          listaLimitado: form.listaLimitado,
          listaLimitadoLendario: form.listaLimitadoLendario,
          listaBanido: form.listaBanido,
          encerrado: form.panelEnabled ? 0 : 1,
          prizes: form.prizes ? 1 : 0,
          monotype: form.monotype ? 1 : 0,
          paymentRegister: 50,
        }),
      });
      setTournamentId(res.tournamentId);
      Swal.fire({ icon: 'success', title: 'Torneio criado!', text: `Torneio criado com ID ${res.tournamentId}` });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Erro', text: err instanceof Error ? err.message : 'Erro ao criar torneio.' });
    }
  }

  const multiProps = {
    ...subwaySelectProps,
    isMulti: true as const,
    options: pokemonOptions,
  };

  return (
    <>
      <AdminNav />
      <div className="container mt-5 mb-3">
        <h1 className="text-center mb-4">Painel de Administração</h1>
        <form onSubmit={saveConfig}>
          <div className="form-check mb-3">
            <input
              type="checkbox"
              id="panel-enabled"
              className="form-check-input"
              checked={form.panelEnabled}
              onChange={(e) => setForm((f) => ({ ...f, panelEnabled: e.target.checked }))}
            />
            <label htmlFor="panel-enabled" className="form-check-label">Habilitar Registros</label>
          </div>

          <div className="mb-3">
            <label htmlFor="titulo" className="form-label">Título</label>
            <input className="form-control" id="titulo" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
          </div>
          <div className="mb-3">
            <label htmlFor="titulo2" className="form-label">Subtítulo</label>
            <input className="form-control" id="titulo2" value={form.titulo2} onChange={(e) => setForm((f) => ({ ...f, titulo2: e.target.value }))} />
          </div>

          <div className="mb-3">
            <label htmlFor="generation" className="form-label">Geração Ativa</label>
            <select className="form-select" id="generation" value={form.gen} onChange={(e) => onGenChange(e.target.value)}>
              <option value="1">Primeira Geração</option>
              <option value="2">Segunda Geração</option>
              <option value="3">Terceira Geração</option>
              <option value="4">Quarta Geração</option>
              <option value="5">Quinta Geração</option>
              <option value="9">Pokémon Champions (Gen 9)</option>
            </select>
          </div>

          {!champions && (
            <div id="standard-tournament-fields">
              <div className="mb-3">
                <label className="form-label">Jogo Sprites</label>
                <select className="form-select" value={form.sprites} onChange={(e) => setForm((f) => ({ ...f, sprites: e.target.value }))}>
                  <option value="red-green">Red/Green</option>
                  <option value="red-blue">Red/Blue</option>
                  <option value="yellow">Yellow</option>
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="crystal">Crystal</option>
                  <option value="ruby-sapphire">Ruby/Sapphire</option>
                  <option value="firered-leafgreen">FireRed/LeafGreen</option>
                  <option value="emerald">Emerald</option>
                  <option value="diamond-pearl">Diamond/Pearl</option>
                  <option value="platinum">Platinum</option>
                  <option value="heartgold-soulsilver">HeartGold/SoulSilver</option>
                  <option value="black-white">Black/White</option>
                  <option value="x-y">X/Y</option>
                  <option value="omegaruby-alphasapphire">Omega Ruby/Alpha Sapphire</option>
                  <option value="sun-moon">Sun/Moon</option>
                  <option value="ultra-sun-ultra-moon">Ultra Sun/Ultra Moon</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Limite de Pokémon Escolhidos</label>
                <input type="number" className="form-control" min={0} max={20} value={form.qtdEscolha} onChange={(e) => setForm((f) => ({ ...f, qtdEscolha: e.target.value }))} />
              </div>
              <div className="mb-3">
                <label className="form-label">Limite de Pokémon Limitados</label>
                <input type="number" className="form-control" min={0} max={6} value={form.qtdLimitado} onChange={(e) => setForm((f) => ({ ...f, qtdLimitado: e.target.value }))} />
              </div>
              <div className="mb-3">
                <label className="form-label">Pokémon Limitados</label>
                <Select {...multiProps} value={form.listaLimitado.map((v) => ({ value: v, label: v }))} onChange={(v) => setForm((f) => ({ ...f, listaLimitado: (v || []).map((x) => x.value) }))} />
              </div>
              <div className="mb-3">
                <label className="form-label">Limite de Pokémon Lendários Limitados</label>
                <input type="number" className="form-control" min={0} max={6} value={form.qtdLimitadoLendario} onChange={(e) => setForm((f) => ({ ...f, qtdLimitadoLendario: e.target.value }))} />
              </div>
              <div className="mb-3">
                <label className="form-label">Pokémon Lendários Limitados</label>
                <Select {...multiProps} value={form.listaLimitadoLendario.map((v) => ({ value: v, label: v }))} onChange={(v) => setForm((f) => ({ ...f, listaLimitadoLendario: (v || []).map((x) => x.value) }))} />
              </div>
              <div className="mb-3">
                <label className="form-label">Pokémon Banidos</label>
                <Select {...multiProps} value={form.listaBanido.map((v) => ({ value: v, label: v }))} onChange={(v) => setForm((f) => ({ ...f, listaBanido: (v || []).map((x) => x.value) }))} />
              </div>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label">Valor de Inscrição</label>
            <input type="number" className="form-control" min={0} max={100} value={form.paymentRegister} onChange={(e) => setForm((f) => ({ ...f, paymentRegister: e.target.value }))} />
          </div>
          <div className="mb-3">
            <label className="form-label">Webhook Discord</label>
            <input type="url" className="form-control" value={form.hook} onChange={(e) => setForm((f) => ({ ...f, hook: e.target.value }))} />
          </div>
          <div className="form-check mb-3">
            <input type="checkbox" className="form-check-input" id="notifications-enabled" checked={form.enviarDiscord} onChange={(e) => setForm((f) => ({ ...f, enviarDiscord: e.target.checked }))} />
            <label htmlFor="notifications-enabled" className="form-check-label">Ativar Notificações Discord</label>
          </div>
          {!champions && (
            <>
              <div className="form-check mb-3">
                <input type="checkbox" className="form-check-input" id="prizes-enabled" checked={form.prizes} onChange={(e) => setForm((f) => ({ ...f, prizes: e.target.checked }))} />
                <label htmlFor="prizes-enabled" className="form-check-label">Ativar Campo de Prêmios</label>
              </div>
              <div className="form-check mb-3">
                <input type="checkbox" className="form-check-input" id="monotype-enabled" checked={form.monotype} onChange={(e) => setForm((f) => ({ ...f, monotype: e.target.checked }))} />
                <label htmlFor="monotype-enabled" className="form-check-label">Ativar Modo Monotype</label>
              </div>
            </>
          )}

          <div className="d-grid gap-2 mt-4">
            <button type="submit" className="btn btn-success">Salvar Configurações</button>
            <button type="button" className="btn btn-warning" onClick={createTournament}>Criar Novo Torneio</button>
          </div>
        </form>
        {config && <p className="text-muted small mt-3">Torneio ativo ID: {tournamentId}</p>}
      </div>
    </>
  );
}
