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

const trainerHelper = createColumnHelper<Trainer>();
const rankHelper = createColumnHelper<{ pos: number; pokemon: string; count: number }>();

export function ParticipantsPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [championsMode, setChampionsMode] = useState(false);

  const load = useCallback(async () => {
    const cfg = await apiFetch<TournamentConfig>('/getConfig', { auth: true });
    setTournamentId(cfg.id);
    setChampionsMode(Number(cfg.gen) === 9);
    const data = await apiFetch<Trainer[]>('/getTrainers', { auth: true });
    setTrainers(data);
  }, []);

  useEffect(() => {
    document.title = 'Participantes';
    load().catch(console.error);
  }, [load]);

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
      rankHelper.accessor('pos', { header: '#' }),
      rankHelper.accessor('pokemon', { header: 'Pokémon' }),
      rankHelper.accessor('count', { header: 'Escolhas' }),
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
        <table className="table table-striped table-hover">
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
        <div className="row pt-1 mb-4">
          <div className="col-sm-6 col-12">
            <div className="card">
              <div className="card-body text-end">
                <h3>{trainers.length}</h3>
                <span>Quantidade Registros</span>
              </div>
            </div>
          </div>
          {!championsMode && (
            <div className="col-sm-6 col-12">
              <div className="card">
                <div className="card-body text-end">
                  <h3>{uniquePokemon}</h3>
                  <span>Pokémon diferentes</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Lista de Participantes</h2>
          <button type="button" className="btn btn-danger" onClick={resetAll}>Resetar Todos</button>
        </div>
        {renderTable(trainerTable)}

        {!championsMode && ranking.length > 0 && (
          <section className="mt-5">
            <h2>Ranking de Pokémon</h2>
            {renderTable(rankTable)}
          </section>
        )}
      </div>
    </>
  );
}
