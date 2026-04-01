import { json, type RequestHandler } from '@sveltejs/kit';
import { ensureDatabaseReady } from '$lib/server/bootstrap';
import { getActiveTournament, getTournamentSettings } from '$lib/server/state';

export const GET: RequestHandler = async () => {
	try {
		await ensureDatabaseReady();
		const activeTournament = await getActiveTournament();
		if (!activeTournament) {
			return json({ ok: true, state: 'draft', timestamp: new Date().toISOString() });
		}
		const settings = await getTournamentSettings(activeTournament.id);
		return json({ ok: true, state: settings.state, tournament: activeTournament.alias, timestamp: new Date().toISOString() });
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Healthcheck failed'
			},
			{ status: 500 }
		);
	}
};
