export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
export type GroupCode = (typeof GROUPS)[number];

export interface TeamInfo {
	name: string;
	code: string;
	group: GroupCode;
}

export const TEAMS: TeamInfo[] = [
	// Grupo A
	{ name: 'México', code: 'mx', group: 'A' },
	{ name: 'Sudáfrica', code: 'za', group: 'A' },
	{ name: 'Corea del Sur', code: 'kr', group: 'A' },
	{ name: 'Rep. Checa', code: 'cz', group: 'A' },
	// Grupo B
	{ name: 'Canadá', code: 'ca', group: 'B' },
	{ name: 'Bosnia y Herzegovina', code: 'ba', group: 'B' },
	{ name: 'Catar', code: 'qa', group: 'B' },
	{ name: 'Suiza', code: 'ch', group: 'B' },
	// Grupo C
	{ name: 'Brasil', code: 'br', group: 'C' },
	{ name: 'Marruecos', code: 'ma', group: 'C' },
	{ name: 'Haití', code: 'ht', group: 'C' },
	{ name: 'Escocia', code: 'gb-sct', group: 'C' },
	// Grupo D
	{ name: 'Estados Unidos', code: 'us', group: 'D' },
	{ name: 'Paraguay', code: 'py', group: 'D' },
	{ name: 'Australia', code: 'au', group: 'D' },
	{ name: 'Turquía', code: 'tr', group: 'D' },
	// Grupo E
	{ name: 'Alemania', code: 'de', group: 'E' },
	{ name: 'Curazao', code: 'cw', group: 'E' },
	{ name: 'Costa de Marfil', code: 'ci', group: 'E' },
	{ name: 'Ecuador', code: 'ec', group: 'E' },
	// Grupo F
	{ name: 'Países Bajos', code: 'nl', group: 'F' },
	{ name: 'Japón', code: 'jp', group: 'F' },
	{ name: 'Suecia', code: 'se', group: 'F' },
	{ name: 'Túnez', code: 'tn', group: 'F' },
	// Grupo G
	{ name: 'Bélgica', code: 'be', group: 'G' },
	{ name: 'Egipto', code: 'eg', group: 'G' },
	{ name: 'Irán', code: 'ir', group: 'G' },
	{ name: 'Nueva Zelanda', code: 'nz', group: 'G' },
	// Grupo H
	{ name: 'España', code: 'es', group: 'H' },
	{ name: 'Cabo Verde', code: 'cv', group: 'H' },
	{ name: 'Arabia Saudita', code: 'sa', group: 'H' },
	{ name: 'Uruguay', code: 'uy', group: 'H' },
	// Grupo I
	{ name: 'Francia', code: 'fr', group: 'I' },
	{ name: 'Senegal', code: 'sn', group: 'I' },
	{ name: 'Irak', code: 'iq', group: 'I' },
	{ name: 'Noruega', code: 'no', group: 'I' },
	// Grupo J
	{ name: 'Argentina', code: 'ar', group: 'J' },
	{ name: 'Argelia', code: 'dz', group: 'J' },
	{ name: 'Austria', code: 'at', group: 'J' },
	{ name: 'Jordania', code: 'jo', group: 'J' },
	// Grupo K
	{ name: 'Portugal', code: 'pt', group: 'K' },
	{ name: 'RD Congo', code: 'cd', group: 'K' },
	{ name: 'Uzbekistán', code: 'uz', group: 'K' },
	{ name: 'Colombia', code: 'co', group: 'K' },
	// Grupo L
	{ name: 'Inglaterra', code: 'gb-eng', group: 'L' },
	{ name: 'Croacia', code: 'hr', group: 'L' },
	{ name: 'Ghana', code: 'gh', group: 'L' },
	{ name: 'Panamá', code: 'pa', group: 'L' }
];

const FLAG_CODES: Record<string, string> = {};
for (const t of TEAMS) {
	FLAG_CODES[t.name] = t.code;
}

const VALID_WIDTHS = [20, 40, 80, 160, 320] as const;

export function getFlagUrl(teamName: string, width: number = 80): string {
	const code = FLAG_CODES[teamName];
	if (!code) return '';
	const w = VALID_WIDTHS.reduce((prev, cur) => (Math.abs(cur - width) < Math.abs(prev - width) ? cur : prev));
	return `https://flagcdn.com/w${w}/${code}.png`;
}

export function getGroupTeams(group: string): TeamInfo[] {
	return TEAMS.filter((t) => t.group === group);
}

/** Venue/stadium data */
export interface Venue {
	city: string;
	stadium: string;
	capacity: number;
}

export const VENUES: Record<string, Venue> = {
	'MetLife Stadium': { city: 'Nueva York/Nueva Jersey', stadium: 'MetLife Stadium', capacity: 87157 },
	'SoFi Stadium': { city: 'Los Ángeles', stadium: 'SoFi Stadium', capacity: 70240 },
	'AT&T Stadium': { city: 'Dallas', stadium: 'AT&T Stadium', capacity: 92967 },
	'Hard Rock Stadium': { city: 'Miami', stadium: 'Hard Rock Stadium', capacity: 64767 },
	'NRG Stadium': { city: 'Houston', stadium: 'NRG Stadium', capacity: 72220 },
	'Mercedes-Benz Stadium': { city: 'Atlanta', stadium: 'Mercedes-Benz Stadium', capacity: 75000 },
	'Lumen Field': { city: 'Seattle', stadium: 'Lumen Field', capacity: 68740 },
	'Lincoln Financial Field': { city: 'Filadelfia', stadium: 'Lincoln Financial Field', capacity: 69796 },
	'Arrowhead Stadium': { city: 'Kansas City', stadium: 'Arrowhead Stadium', capacity: 76416 },
	'Gillette Stadium': { city: 'Boston/Foxborough', stadium: 'Gillette Stadium', capacity: 65878 },
	'Bay Area Stadium': { city: 'San Francisco', stadium: 'Bay Area Stadium', capacity: 68500 },
	'BC Place': { city: 'Vancouver', stadium: 'BC Place', capacity: 54500 },
	'BMO Field': { city: 'Toronto', stadium: 'BMO Field', capacity: 45500 },
	'Estadio Azteca': { city: 'Ciudad de México', stadium: 'Estadio Azteca', capacity: 87523 },
	'Estadio BBVA': { city: 'Monterrey', stadium: 'Estadio BBVA', capacity: 53500 },
	'Estadio Akron': { city: 'Guadalajara', stadium: 'Estadio Akron', capacity: 49850 }
};
