import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Swal from 'sweetalert2';
import { API_URL, apiFetch } from '../../api/client';
import type { Trainer, TournamentConfig } from '../../api/types';
import { AdminNav } from '../../components/AdminNav';
import { AdminStatCard, IconList, IconUsers } from '../../components/AdminStatCard';

const trainerHelper = createColumnHelper<Trainer>();
const rankHelper = createColumnHelper<{ pos: number; pokemon: string; count: number }>();

export function ParticipantsPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [championsMode, setChampionsMode] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showRanking, setShowRanking] = useState(false);

  const load = useCallback(async () => {
    const cfg = await apiFetch<TournamentConfig>('/getConfig', { auth: true });
    setTournamentId(cfg.id);
    setChampionsMode(Number(cfg.gen) === 9);
    const data = await apiFetch<Trainer[]>('/getTrainers', { auth: true });
    setTrainers(data);
  }, []);

  useEffect(() => {
    document.title = 'Participantes';
    let cancelled = false;

    load().catch((err) => {
      if (!cancelled) console.error(err);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uniquePokemon = useMemo(() => {
    const all = trainers.flatMap((t) => t.pokemonList || []);
    return new Set(all).size;
  }, [trainers]);

  const ranking = useMemo(() => {
    const counts: Record<string, number> = {};
    trainers.forEach((t) => t.pokemonList?.forEach((p) => { counts[p] = (counts[p] || 0) + 1; }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([pokemon, count], i) => ({ pos: i + 1, pokemon, count }));
  }, [trainers]);

  const trainerColumns = useMemo(
    () => [
      trainerHelper.accessor('name', { header: 'Nome' }),
      trainerHelper.accessor('email', { header: 'Contato' }),
      trainerHelper.display({
        id: 'pokemon',
        header: championsMode ? 'Time (Champions)' : 'Pokémon',
        cell: ({ row }) =>
          championsMode ? (
            row.original.teamImage ? (
              <a href={`${API_URL}/team-images/${row.original.teamImage}`} target="_blank" rel="noreferrer">
                Ver print do time
              </a>
            ) : (
              '—'
            )
          ) : (
            row.original.pokemonList?.join(', ') || ''
          ),
      }),
    ],
    [championsMode]
  );

  const trainerTable = useReactTable({
    data: trainers,
    columns: trainerColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rankColumns = useMemo(
    () => [
      rankHelper.accessor('pos', { header: 'Posição' }),
      rankHelper.accessor('pokemon', { header: 'Pokémon' }),
      rankHelper.accessor('count', { header: 'Qtd Escolhas' }),
    ],
    []
  );

  const rankTable = useReactTable({
    data: ranking,
    columns: rankColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  async function resetAll() {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: 'Esta ação irá deletar todos os treinadores!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, deletar!',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed || !tournamentId) return;
    try {
      const data = await apiFetch<{ message: string }>(`/deleteTrainers/all`, {
        method: 'DELETE',
        auth: true,
        body: JSON.stringify({ tournamentsId: tournamentId }),
      });
      Swal.fire({ icon: 'success', title: 'Treinadores deletados', text: data.message });
      await load();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Erro', text: err instanceof Error ? err.message : 'Erro ao resetar.' });
    }
  }

  function renderTable<T>(table: ReturnType<typeof useReactTable<T>>) {
    return (
      <div className="table-responsive">
        <table className="table table-striped table-hover mb-0">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <AdminNav />
      <div className="container mt-4 mb-5">
        <section className="row pt-1 g-3 mb-4">
          <div className={championsMode ? 'col-sm-6 col-lg-4' : 'col-sm-6 col-12'}>
            <AdminStatCard
              variant="primary"
              icon={<IconUsers />}
              value={trainers.length}
              label="Quantidade Registros"
            />
          </div>
          {!championsMode && (
            <div className="col-sm-6 col-12">
              <AdminStatCard
                variant="warning"
                icon={<IconList />}
                value={uniquePokemon}
                label="Pokémon diferentes"
              />
            </div>
          )}
        </section>

        <section className="card mb-4">
          <div className="card-header d-flex flex-wrap align-items-center gap-2">
            <h4 className="flex-grow-1 mb-0">Lista de Participantes</h4>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowParticipants((v) => !v)}
              >
                {showParticipants ? 'Ocultar Tabela' : 'Mostrar Tabela de Participantes'}
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={resetAll}>
                Resetar Participantes
              </button>
            </div>
          </div>
          {showParticipants && (
            <div className="card-body border-top">
              {trainers.length === 0 ? (
                <p className="text-muted mb-0">Nenhum participante inscrito ainda.</p>
              ) : (
                renderTable(trainerTable)
              )}
            </div>
          )}
        </section>

        {!championsMode && ranking.length > 0 && (
          <section className="card">
            <div className="card-header d-flex flex-wrap align-items-center gap-2">
              <h4 className="flex-grow-1 mb-0">Ranking de Pokémon mais escolhidos</h4>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowRanking((v) => !v)}
              >
                {showRanking ? 'Ocultar Ranking' : 'Mostrar Ranking'}
              </button>
            </div>
            {showRanking && (
              <div className="card-body border-top">{renderTable(rankTable)}</div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
