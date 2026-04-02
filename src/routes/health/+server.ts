import { json, type RequestHandler } from '@sveltejs/kit';
import {
	ensureDatabaseReady,
	getAppliedSchemaVersion,
	getCurrentSchemaVersion,
	getDatabaseInitError
} from '$lib/server/bootstrap';
import { getActiveTournament, getTournamentSettings } from '$lib/server/state';

export const GET: RequestHandler = async () => {
	const timestamp = new Date().toISOString();
	const expectedSchemaVersion = getCurrentSchemaVersion();

	try {
		await ensureDatabaseReady();
		const schemaVersion = await getAppliedSchemaVersion();
		const activeTournament = await getActiveTournament();
		if (!activeTournament) {
			return json({
				ok: true,
				dbReady: true,
				schemaVersion,
				expectedSchemaVersion,
				state: 'draft',
				timestamp
			});
		}
		const settings = await getTournamentSettings(activeTournament.id);
		return json({
			ok: true,
			dbReady: true,
			schemaVersion,
			expectedSchemaVersion,
			state: settings.state,
			tournament: activeTournament.alias,
			timestamp
		});
	} catch (error) {
		const schemaVersion = await getAppliedSchemaVersion();
		const initError = getDatabaseInitError();
		return json(
			{
				ok: false,
				dbReady: false,
				schemaVersion,
				expectedSchemaVersion,
				error: initError?.message || (error instanceof Error ? error.message : 'Healthcheck failed'),
				timestamp
			},
			{ status: 503 }
		);
	}
};
