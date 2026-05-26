export const MATCH_TIME_ZONE = 'America/Argentina/Buenos_Aires';
export const MATCH_TIME_ZONE_LABEL = 'Buenos Aires (GMT-3)';

const matchDateOptions: Intl.DateTimeFormatOptions = {
	day: 'numeric',
	month: 'short',
	timeZone: MATCH_TIME_ZONE
};

const matchTimeOptions: Intl.DateTimeFormatOptions = {
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: MATCH_TIME_ZONE
};

export function formatMatchDate(iso: string) {
	return new Date(iso).toLocaleDateString('es-AR', matchDateOptions);
}

export function formatMatchTime(iso: string) {
	return new Date(iso).toLocaleTimeString('es-AR', matchTimeOptions);
}