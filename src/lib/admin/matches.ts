import type { Match, MatchStage } from '$lib/types';
import { STAGE_LABELS } from '$lib/scoring-config';
import { VENUES } from '$lib/teams';
import { WORLD_CUP_2026_MATCHES } from '$lib/worldcup-2026-fixture';

export const stageOptions = [
	{ value: 'all', label: 'Todas las fases' },
	{ value: 'groups', label: 'Grupos' },
	{ value: 'round32', label: '16avos' },
	{ value: 'round16', label: 'Octavos' },
	{ value: 'quarterfinal', label: 'Cuartos' },
	{ value: 'semifinal', label: 'Semifinales' },
	{ value: 'thirdplace', label: 'Final por tercer puesto' },
	{ value: 'final', label: 'Final' }
];

export const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
export const KNOCKOUT_STAGES: readonly MatchStage[] = ['round32', 'round16', 'quarterfinal', 'semifinal', 'thirdplace', 'final'];

const officialFixtureById = new Map(WORLD_CUP_2026_MATCHES.map((match) => [match.id, match]));

export function hasLoadedResult(match: Match) {
	return match.scoreA !== null && match.scoreB !== null;
}

export function matchNumberById(matchId: string) {
	const numericSuffix = Number(matchId.split('-')[1]);
	if (matchId.startsWith('g-')) return numericSuffix;
	if (matchId.startsWith('r32-')) return 72 + numericSuffix;
	if (matchId.startsWith('r16-')) return 88 + numericSuffix;
	if (matchId.startsWith('qf-')) return 96 + numericSuffix;
	if (matchId.startsWith('sf-')) return 100 + numericSuffix;
	if (matchId === '3rd') return 103;
	if (matchId === 'final') return 104;
	return 999;
}

export function matchNumber(match: Pick<Match, 'id'>) {
	return matchNumberById(match.id);
}

function knockoutSourceReference(sourceMatchId: string, verb: 'Ganador' | 'Perdedor') {
	const source = officialFixtureById.get(sourceMatchId);
	if (!source) return `${verb} ${sourceMatchId}`;
	const label = `${verb} M${matchNumberById(sourceMatchId)}`;
	return source.stage === 'round32' ? `${label} (${source.teamA} vs ${source.teamB})` : label;
}

function sourceSlotLabel(slot: string) {
	const r32 = slot.match(/^G\. R32-(\d+)$/);
	if (r32) return knockoutSourceReference(`r32-${r32[1].padStart(2, '0')}`, 'Ganador');

	const r16 = slot.match(/^G\. 8vos-(\d+)$/);
	if (r16) return knockoutSourceReference(`r16-${r16[1].padStart(2, '0')}`, 'Ganador');

	const qf = slot.match(/^G\. QF-(\d+)$/);
	if (qf) return knockoutSourceReference(`qf-${qf[1].padStart(2, '0')}`, 'Ganador');

	const sfWinner = slot.match(/^Ganador SF-(\d+)$/);
	if (sfWinner) return knockoutSourceReference(`sf-${sfWinner[1].padStart(2, '0')}`, 'Ganador');

	const sfLoser = slot.match(/^Perdedor SF-(\d+)$/);
	if (sfLoser) return knockoutSourceReference(`sf-${sfLoser[1].padStart(2, '0')}`, 'Perdedor');

	return slot;
}

export function bracketOriginLabel(match: Match) {
	if (match.stage === 'groups') return null;
	const officialMatch = officialFixtureById.get(match.id);
	if (!officialMatch) return null;
	return `${sourceSlotLabel(officialMatch.teamA)} vs ${sourceSlotLabel(officialMatch.teamB)}`;
}

export function clearResultMessage(match: Match) {
	return match.stage === 'groups'
		? 'Eliminar este resultado deja incompleta la fase de grupos y reinicia toda la llave. ¿Continuar?'
		: 'Eliminar este resultado borra tambien los cruces siguientes que dependan de este partido. ¿Continuar?';
}

export function isPlaceholderTeam(team: string) {
	return /Grupo|R32|8vos|QF|SF|Ganador|Perdedor|Pendiente/.test(team);
}

export function fixtureStatusLabel(match: Match) {
	if (hasLoadedResult(match)) return 'Resultado cargado';
	if (match.stage === 'groups') return 'Pendiente';
	return isPlaceholderTeam(match.teamA) || isPlaceholderTeam(match.teamB) ? 'Cruce por definir' : 'Cruce armado';
}

export function fixtureStatusClass(match: Match) {
	if (hasLoadedResult(match)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
	if (match.stage !== 'groups' && !isPlaceholderTeam(match.teamA) && !isPlaceholderTeam(match.teamB)) return 'border-sky-200 bg-sky-50 text-sky-700';
	return 'border-slate-200 bg-slate-50 text-slate-500';
}

export function sortMatchesByNumber(matches: Match[]) {
	return [...matches].sort((a, b) => matchNumber(a) - matchNumber(b) || a.kickoffAt.localeCompare(b.kickoffAt));
}

export function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('es-AR', {
		day: 'numeric',
		month: 'short',
		timeZone: 'America/Argentina/Buenos_Aires'
	});
}

export function formatTime(iso: string) {
	return new Date(iso).toLocaleTimeString('es-AR', {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'America/Argentina/Buenos_Aires'
	});
}

export function venueCity(venue: string | null) {
	if (!venue) return '';
	return VENUES[venue]?.city ?? venue;
}

export { STAGE_LABELS };