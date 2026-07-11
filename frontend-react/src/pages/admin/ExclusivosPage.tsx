import { useCallback, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { apiFetch } from '../../api/client';
import type { Prize } from '../../api/types';
import { AdminNav } from '../../components/AdminNav';
import { loadAllGenPokemonNames } from '../../utils/pokemonGens';

const helper = createColumnHelper<Prize>();

export function ExclusivosPage() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [pokemonOptions, setPokemonOptions] = useState<{ value: string; label: string }[]>([]);

  const loadPrizes = useCallback(async () => {
    const data = await apiFetch<Prize[]>('/getPrizes', { auth: true });
    setPrizes(data);
  }, []);

  useEffect(() => {
    document.title = 'Premiação';
    loadAllGenPokemonNames()
      .then((names) => setPokemonOptions(names.map((n) => ({ value: n, label: n }))))
      .catch(console.error);
    loadPrizes().catch(console.error);
  }, [loadPrizes]);

  async function openModal(isEdit: boolean, prize?: Prize) {
    const initial = prize ?? { id: 0, nome: '', codigo: '', pokemonList: [] };
    let nome = initial.nome;
    let codigo = initial.codigo;
    let selected = initial.pokemonList.map((p) => ({ value: p, label: p }));

    const result = await Swal.fire({
      title: isEdit ? 'Editar Prêmio' : 'Adicionar Prêmio',
      html: `
        <div class="mb-3 text-start">
          <label class="form-label">Nome do Participante</label>
          <input id="swal-nome" class="form-control" value="${initial.nome}">
        </div>
        <div class="mb-3 text-start">
          <label class="form-label">Código</label>
          <input id="swal-codigo" class="form-control" value="${initial.codigo}">
        </div>
        <div id="swal-pokemon-mount" class="text-start"></div>
      `,
      showCancelButton: true,
      confirmButtonText: isEdit ? 'Salvar' : 'Adicionar',
      didOpen: () => {
        const mount = document.getElementById('swal-pokemon-mount');
        if (!mount) return;
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = 'Pokémon do prêmio';
        mount.appendChild(label);
      },
      preConfirm: () => {
        nome = (document.getElementById('swal-nome') as HTMLInputElement).value.trim();
        codigo = (document.getElementById('swal-codigo') as HTMLInputElement).value.trim();
        if (!nome || !codigo || !selected.length) {
          Swal.showValidationMessage('Preencha todos os campos.');
          return false;
        }
        return { id: initial.id, nome, codigo, pokemonList: selected.map((s) => s.value) };
      },
    });

    if (!result.isConfirmed || !result.value) return;

    await apiFetch('/submitPrizes', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(result.value),
    });
    Swal.fire('Sucesso!', 'Prêmio salvo.', 'success');
    await loadPrizes();
  }

  const columns = useMemo(
    () => [
      helper.accessor('nome', { header: 'Nome' }),
      helper.accessor('codigo', { header: 'Código' }),
      helper.accessor('pokemonList', { header: 'Prêmios', cell: ({ getValue }) => getValue().join(', ') }),
      helper.display({
        id: 'edit',
        header: 'Editar',
        cell: ({ row }) => (
          <button type="button" className="btn btn-warning btn-sm" onClick={() => openModal(true, row.original)}>
            Editar
          </button>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({ data: prizes, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <>
      <AdminNav />
      <div className="container mt-4 mb-5">
        <h2>Cadastro de Prêmios</h2>
        <button type="button" className="btn btn-primary mb-4" onClick={() => openModal(false)}>
          Adicionar Prêmio
        </button>
        <h2>Lista de Prêmios</h2>
        <div className="table-responsive">
          <table className="table table-striped">
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
        <div className="d-none">
          <Select isMulti options={pokemonOptions} />
        </div>
      </div>
    </>
  );
}
