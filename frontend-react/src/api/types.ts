export interface TournamentConfig {
  id: number;
  titulo?: string;
  titulo2?: string;
  gen?: number;
  sprites?: string;
  qtdlimitado?: number;
  qtdlimitadolendario?: number;
  qtdescolha?: number;
  hook?: string;
  enviardiscord?: boolean;
  prizes?: boolean;
  encerrado?: boolean | number;
  monotype?: boolean;
  paymentregister?: number;
  listalimitado?: string[];
  listalimitadolendario?: string[];
  listabanido?: string[];
  error?: string;
}

export interface PokemonEntry {
  id: number;
  name: string;
  af?: string;
  type?: string[];
}

export interface Trainer {
  name: string;
  email: string;
  pokemonList: string[];
  teamImage?: string | null;
}

export interface Prize {
  id: number;
  nome: string;
  codigo: string;
  pokemonList: string[];
}

export interface CupSetup {
  qtdParticipantes?: number;
  qtdGrupos?: number;
  qtdClassificados?: number;
  formatoCopa?: 'groups' | 'swiss' | 'knockout';
  formatoMataMata?: number;
  qtdRodadasSuico?: number | null;
  minRodadasSuico?: number;
  rodadasSuicoAutomaticas?: number;
}

export interface StandingRow {
  participant_id?: number;
  player_id?: number;
  name: string;
  grupo?: string | null;
  pontos?: number;
  saldo?: number;
  vitorias?: number;
  derrotas?: number;
  posicao?: number;
}

export interface TournamentMatch {
  id: number;
  phase: string;
  grupo?: string | null;
  player_a_id: number;
  player_b_id: number;
  player_a_name: string;
  player_b_name: string;
  winner_id?: number | null;
  winner_name?: string | null;
  score_a?: number;
  score_b?: number;
  best_of?: number;
}

export interface CupStatus {
  tournamentId: number;
  tournamentName?: string;
  formatoCopa?: string;
  qtdClassificados?: number;
  groups: { total: number; completed: number; pending: number; complete: boolean };
  swiss?: {
    rounds: Array<{ phase: string; total: number; completed: number; complete: boolean }>;
    totalRounds: number;
    complete: boolean;
  } | null;
  knockout: {
    hasKnockout: boolean;
    rounds: Array<{ phase: string; total: number; completed: number }>;
    cupFinished?: boolean;
  };
  canGenerateKnockout?: boolean;
  canAdvanceKnockout?: boolean;
  canGenerateThirdPlace?: boolean;
}

export interface TournamentParticipant {
  participant_id: number;
  player_id: number;
  name: string;
  email: string;
  grupo?: string | null;
}

export interface PublicCupParticipant {
  participant_id: number;
  player_id: number;
  name: string;
  teamImage?: string | null;
}

export interface PublicCupStandings {
  active: boolean;
  hasGroups: boolean;
  hasPublishedContent?: boolean;
  formatoCopa?: 'groups' | 'swiss' | 'knockout' | string;
  championsMode?: boolean;
  titulo?: string;
  titulo2?: string;
  tournamentName?: string;
  qtdClassificados?: number;
  standings: StandingRow[];
  participants?: PublicCupParticipant[];
  knockout?: {
    hasKnockout: boolean;
    matches: TournamentMatch[];
    cupFinished?: boolean;
  };
  error?: string;
}
