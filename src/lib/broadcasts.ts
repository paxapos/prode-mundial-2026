export function getBroadcastsForMatch(match: {
	id: string;
	teamA: string;
	teamB: string;
	kickoffAt: string;
	stage: string;
}): string[] {
	const base = ['DSports', 'Paramount+', 'Flow'];

	// 1. Argentina Team Rule: If Argentina plays, all channels broadcast
	if (match.teamA.toLowerCase().includes('argentina') || match.teamB.toLowerCase().includes('argentina')) {
		return [...base, 'TyC Sports', 'Telefe', 'TV Pública', 'Disney+'];
	}

	// 2. Specific Group Stage overrides based on Infobae fixture
	const overrides: Record<string, string[]> = {
		// Saturday 13 June
		'g-007': ['Disney+'],        // Brasil vs. Marruecos
		'g-005': ['Telefe'],         // Haití vs. Escocia
		'g-006': ['TyC Sports'],     // Australia vs. Turquía
		
		// Sunday 14 June
		'g-004': ['TyC Sports'],     // Estados Unidos vs. Paraguay (played June 12 in db, equivalent to USA vs Ghana)
		
		// Monday 15 June
		'g-013': ['Telefe'],         // Arabia Saudita vs. Uruguay
		
		// Tuesday 16 June
		'g-020': ['TyC Sports'],     // Austria vs. Jordania
		
		// Wednesday 17 June
		'g-022': ['Disney+'],        // Inglaterra vs. Croacia
		'g-024': ['Telefe'],         // Uzbekistán vs. Colombia
		
		// Thursday 18 June
		'g-028': ['TyC Sports'],     // México vs. Corea del Sur
		
		// Friday 19 June
		'g-032': ['Telefe'],         // Estados Unidos vs. Australia
		
		// Saturday 20 June
		'g-033': ['Disney+'],        // Alemania vs. Costa de Marfil
		
		// Sunday 21 June
		'g-038': ['TyC Sports'],     // España vs. Arabia Saudita
		'g-039': ['TyC Sports'],     // Bélgica vs. Irán
		
		// Monday 22 June
		'g-042': ['Telefe'],         // Francia vs. Irak
	};

	if (overrides[match.id]) {
		return [...base, ...overrides[match.id]];
	}

	// 3. Fallback Rules for other matches (both Group and Knockout stages)
	// - Last match of the day gets Disney+
	// - Alternating days get TyC Sports or Telefe
	const date = new Date(match.kickoffAt);
	// Subtract 3 hours for Argentina timezone shift
	const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
	const dayNum = shifted.getUTCDate();
	const hour = shifted.getUTCHours();

	// Last match of the day (usually starts late, e.g., 20:00 or later)
	if (hour >= 20) {
		return [...base, 'Disney+'];
	}

	// Alternate TyC Sports and Telefe by day number
	if (dayNum % 2 === 0) {
		// On even days, give TyC Sports to matches starting in the afternoon/evening (e.g. >= 15:00)
		if (hour >= 15 && hour < 20) {
			return [...base, 'TyC Sports'];
		}
	} else {
		// On odd days, give Telefe to matches starting in the afternoon/evening
		if (hour >= 15 && hour < 20) {
			return [...base, 'Telefe'];
		}
	}

	return base;
}
