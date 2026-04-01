export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
export type GroupCode = (typeof GROUPS)[number];

export interface TeamInfo {
	name: string;
	code: string;
	group: GroupCode;
}

export const TEAMS: TeamInfo[] = [
	// Grupo A
	{ name: 'Estados Unidos', code: 'us', group: 'A' },
	{ name: 'Croacia', code: 'hr', group: 'A' },
	{ name: 'Nigeria', code: 'ng', group: 'A' },
	{ name: 'Panamá', code: 'pa', group: 'A' },
	// Grupo B
	{ name: 'México', code: 'mx', group: 'B' },
	{ name: 'Dinamarca', code: 'dk', group: 'B' },
	{ name: 'Ecuador', code: 'ec', group: 'B' },
	{ name: 'Jamaica', code: 'jm', group: 'B' },
	// Grupo C
	{ name: 'Canadá', code: 'ca', group: 'C' },
	{ name: 'Uruguay', code: 'uy', group: 'C' },
	{ name: 'Camerún', code: 'cm', group: 'C' },
	{ name: 'Costa Rica', code: 'cr', group: 'C' },
	// Grupo D
	{ name: 'Argentina', code: 'ar', group: 'D' },
	{ name: 'Japón', code: 'jp', group: 'D' },
	{ name: 'Chile', code: 'cl', group: 'D' },
	{ name: 'Australia', code: 'au', group: 'D' },
	// Grupo E
	{ name: 'Brasil', code: 'br', group: 'E' },
	{ name: 'Corea del Sur', code: 'kr', group: 'E' },
	{ name: 'Túnez', code: 'tn', group: 'E' },
	{ name: 'Nueva Zelanda', code: 'nz', group: 'E' },
	// Grupo F
	{ name: 'Francia', code: 'fr', group: 'F' },
	{ name: 'Suiza', code: 'ch', group: 'F' },
	{ name: 'Egipto', code: 'eg', group: 'F' },
	{ name: 'Honduras', code: 'hn', group: 'F' },
	// Grupo G
	{ name: 'Inglaterra', code: 'gb-eng', group: 'G' },
	{ name: 'Senegal', code: 'sn', group: 'G' },
	{ name: 'Serbia', code: 'rs', group: 'G' },
	{ name: 'Irán', code: 'ir', group: 'G' },
	// Grupo H
	{ name: 'España', code: 'es', group: 'H' },
	{ name: 'Marruecos', code: 'ma', group: 'H' },
	{ name: 'Ghana', code: 'gh', group: 'H' },
	{ name: 'Uzbekistán', code: 'uz', group: 'H' },
	// Grupo I
	{ name: 'Alemania', code: 'de', group: 'I' },
	{ name: 'Colombia', code: 'co', group: 'I' },
	{ name: 'Arabia Saudita', code: 'sa', group: 'I' },
	{ name: 'Irak', code: 'iq', group: 'I' },
	// Grupo J
	{ name: 'Portugal', code: 'pt', group: 'J' },
	{ name: 'Polonia', code: 'pl', group: 'J' },
	{ name: 'Paraguay', code: 'py', group: 'J' },
	{ name: 'Catar', code: 'qa', group: 'J' },
	// Grupo K
	{ name: 'Bélgica', code: 'be', group: 'K' },
	{ name: 'Italia', code: 'it', group: 'K' },
	{ name: 'Suecia', code: 'se', group: 'K' },
	{ name: 'Argelia', code: 'dz', group: 'K' },
	// Grupo L
	{ name: 'Países Bajos', code: 'nl', group: 'L' },
	{ name: 'Austria', code: 'at', group: 'L' },
	{ name: 'Costa de Marfil', code: 'ci', group: 'L' },
	{ name: 'Rep. Checa', code: 'cz', group: 'L' }
];

const FLAG_CODES: Record<string, string> = {};
for (const t of TEAMS) {
	FLAG_CODES[t.name] = t.code;
}

export function getFlagUrl(teamName: string, width: number = 80): string {
	const code = FLAG_CODES[teamName];
	if (!code) return '';
	return `https://flagcdn.com/w${width}/${code}.png`;
}

export function getGroupTeams(group: string): TeamInfo[] {
	return TEAMS.filter((t) => t.group === group);
}

/** Match pairings within a group: indices into the 4-team array per matchday */
export const GROUP_PAIRINGS = [
	[0, 1],
	[2, 3], // MD1
	[0, 2],
	[3, 1], // MD2
	[3, 0],
	[1, 2] // MD3
] as const;

/** Knockout round placeholder labels */
export const ROUND32_MATCHES: { teamA: string; teamB: string }[] = [
	{ teamA: '1° Grupo A', teamB: 'Mejor 3°' },
	{ teamA: '1° Grupo B', teamB: 'Mejor 3°' },
	{ teamA: '1° Grupo C', teamB: 'Mejor 3°' },
	{ teamA: '1° Grupo D', teamB: 'Mejor 3°' },
	{ teamA: '1° Grupo E', teamB: 'Mejor 3°' },
	{ teamA: '1° Grupo F', teamB: 'Mejor 3°' },
	{ teamA: '1° Grupo G', teamB: 'Mejor 3°' },
	{ teamA: '1° Grupo H', teamB: 'Mejor 3°' },
	{ teamA: '1° Grupo I', teamB: '2° Grupo J' },
	{ teamA: '1° Grupo J', teamB: '2° Grupo I' },
	{ teamA: '1° Grupo K', teamB: '2° Grupo L' },
	{ teamA: '1° Grupo L', teamB: '2° Grupo K' },
	{ teamA: '2° Grupo A', teamB: '2° Grupo H' },
	{ teamA: '2° Grupo B', teamB: '2° Grupo G' },
	{ teamA: '2° Grupo C', teamB: '2° Grupo F' },
	{ teamA: '2° Grupo D', teamB: '2° Grupo E' }
];
