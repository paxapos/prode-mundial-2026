import type { GroupStandingRow, Match, SideWinner } from '$lib/types';

export const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
export type GroupCode = (typeof GROUP_CODES)[number];

export interface R32SlotDefinition {
	aGroup: GroupCode;
	aPos: number;
	bGroup?: GroupCode;
	bPos?: number;
	bLabel: string;
}

export const R32_DEFS: Record<string, R32SlotDefinition> = {
	'r32-01': { aGroup: 'A', aPos: 1, bGroup: 'B', bPos: 1, bLabel: '2° Grupo B' },
	'r32-02': { aGroup: 'E', aPos: 0, bLabel: '3° Grupo A/B/C/D/F' },
	'r32-03': { aGroup: 'F', aPos: 0, bGroup: 'C', bPos: 1, bLabel: '2° Grupo C' },
	'r32-04': { aGroup: 'C', aPos: 0, bGroup: 'F', bPos: 1, bLabel: '2° Grupo F' },
	'r32-05': { aGroup: 'I', aPos: 0, bLabel: '3° Grupo C/D/F/G/H' },
	'r32-06': { aGroup: 'E', aPos: 1, bGroup: 'I', bPos: 1, bLabel: '2° Grupo I' },
	'r32-07': { aGroup: 'A', aPos: 0, bLabel: '3° Grupo C/E/F/H/I' },
	'r32-08': { aGroup: 'L', aPos: 0, bLabel: '3° Grupo E/H/I/J/K' },
	'r32-09': { aGroup: 'D', aPos: 0, bLabel: '3° Grupo B/E/F/I/J' },
	'r32-10': { aGroup: 'G', aPos: 0, bLabel: '3° Grupo A/E/H/I/J' },
	'r32-11': { aGroup: 'K', aPos: 1, bGroup: 'L', bPos: 1, bLabel: '2° Grupo L' },
	'r32-12': { aGroup: 'H', aPos: 0, bGroup: 'J', bPos: 1, bLabel: '2° Grupo J' },
	'r32-13': { aGroup: 'B', aPos: 0, bLabel: '3° Grupo E/F/G/I/J' },
	'r32-14': { aGroup: 'J', aPos: 0, bGroup: 'H', bPos: 1, bLabel: '2° Grupo H' },
	'r32-15': { aGroup: 'K', aPos: 0, bLabel: '3° Grupo D/E/I/J/L' },
	'r32-16': { aGroup: 'D', aPos: 1, bGroup: 'G', bPos: 1, bLabel: '2° Grupo G' }
};

export const THIRD_PLACE_SLOTS: Record<string, GroupCode[]> = {
	'r32-02': ['A', 'B', 'C', 'D', 'F'],
	'r32-05': ['C', 'D', 'F', 'G', 'H'],
	'r32-07': ['C', 'E', 'F', 'H', 'I'],
	'r32-08': ['E', 'H', 'I', 'J', 'K'],
	'r32-09': ['B', 'E', 'F', 'I', 'J'],
	'r32-10': ['A', 'E', 'H', 'I', 'J'],
	'r32-13': ['E', 'F', 'G', 'I', 'J'],
	'r32-15': ['D', 'E', 'I', 'J', 'L']
};

// FIFA Annex C publishes third-place assignments by these winner columns:
// 1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L.
const ANNEX_C_ASSIGNMENT_SLOT_IDS = [
	'r32-07',
	'r32-13',
	'r32-09',
	'r32-02',
	'r32-10',
	'r32-05',
	'r32-15',
	'r32-08'
] as const;

// Key: sorted groups whose third-placed teams qualified.
// Value: assigned third-place group for each slot in ANNEX_C_ASSIGNMENT_SLOT_IDS order.
const THIRD_PLACE_ANNEX_C_ASSIGNMENTS: Record<string, string> = {
	EFGHIJKL: 'EJIFHGLK',
	DFGHIJKL: 'HGIDJFLK',
	DEGHIJKL: 'EJIDHGLK',
	DEFHIJKL: 'EJIDHFLK',
	DEFGIJKL: 'EGIDJFLK',
	DEFGHJKL: 'EGJDHFLK',
	DEFGHIKL: 'EGIDHFLK',
	DEFGHIJL: 'EGJDHFLI',
	DEFGHIJK: 'EGJDHFIK',
	CFGHIJKL: 'HGICJFLK',
	CEGHIJKL: 'EJICHGLK',
	CEFHIJKL: 'EJICHFLK',
	CEFGIJKL: 'EGICJFLK',
	CEFGHJKL: 'EGJCHFLK',
	CEFGHIKL: 'EGICHFLK',
	CEFGHIJL: 'EGJCHFLI',
	CEFGHIJK: 'EGJCHFIK',
	CDGHIJKL: 'HGICJDLK',
	CDFHIJKL: 'CJIDHFLK',
	CDFGIJKL: 'CGIDJFLK',
	CDFGHJKL: 'CGJDHFLK',
	CDFGHIKL: 'CGIDHFLK',
	CDFGHIJL: 'CGJDHFLI',
	CDFGHIJK: 'CGJDHFIK',
	CDEHIJKL: 'EJICHDLK',
	CDEGIJKL: 'EGICJDLK',
	CDEGHJKL: 'EGJCHDLK',
	CDEGHIKL: 'EGICHDLK',
	CDEGHIJL: 'EGJCHDLI',
	CDEGHIJK: 'EGJCHDIK',
	CDEFIJKL: 'CJEDIFLK',
	CDEFHJKL: 'CJEDHFLK',
	CDEFHIKL: 'CEIDHFLK',
	CDEFHIJL: 'CJEDHFLI',
	CDEFHIJK: 'CJEDHFIK',
	CDEFGJKL: 'CGEDJFLK',
	CDEFGIKL: 'CGEDIFLK',
	CDEFGIJL: 'CGEDJFLI',
	CDEFGIJK: 'CGEDJFIK',
	CDEFGHKL: 'CGEDHFLK',
	CDEFGHJL: 'CGJDHFLE',
	CDEFGHJK: 'CGJDHFEK',
	CDEFGHIL: 'CGEDHFLI',
	CDEFGHIK: 'CGEDHFIK',
	CDEFGHIJ: 'CGJDHFEI',
	BFGHIJKL: 'HJBFIGLK',
	BEGHIJKL: 'EJIBHGLK',
	BEFHIJKL: 'EJBFIHLK',
	BEFGIJKL: 'EJBFIGLK',
	BEFGHJKL: 'EJBFHGLK',
	BEFGHIKL: 'EGBFIHLK',
	BEFGHIJL: 'EJBFHGLI',
	BEFGHIJK: 'EJBFHGIK',
	BDGHIJKL: 'HJBDIGLK',
	BDFHIJKL: 'HJBDIFLK',
	BDFGIJKL: 'IGBDJFLK',
	BDFGHJKL: 'HGBDJFLK',
	BDFGHIKL: 'HGBDIFLK',
	BDFGHIJL: 'HGBDJFLI',
	BDFGHIJK: 'HGBDJFIK',
	BDEHIJKL: 'EJBDIHLK',
	BDEGIJKL: 'EJBDIGLK',
	BDEGHJKL: 'EJBDHGLK',
	BDEGHIKL: 'EGBDIHLK',
	BDEGHIJL: 'EJBDHGLI',
	BDEGHIJK: 'EJBDHGIK',
	BDEFIJKL: 'EJBDIFLK',
	BDEFHJKL: 'EJBDHFLK',
	BDEFHIKL: 'EIBDHFLK',
	BDEFHIJL: 'EJBDHFLI',
	BDEFHIJK: 'EJBDHFIK',
	BDEFGJKL: 'EGBDJFLK',
	BDEFGIKL: 'EGBDIFLK',
	BDEFGIJL: 'EGBDJFLI',
	BDEFGIJK: 'EGBDJFIK',
	BDEFGHKL: 'EGBDHFLK',
	BDEFGHJL: 'HGBDJFLE',
	BDEFGHJK: 'HGBDJFEK',
	BDEFGHIL: 'EGBDHFLI',
	BDEFGHIK: 'EGBDHFIK',
	BDEFGHIJ: 'HGBDJFEI',
	BCGHIJKL: 'HJBCIGLK',
	BCFHIJKL: 'HJBCIFLK',
	BCFGIJKL: 'IGBCJFLK',
	BCFGHJKL: 'HGBCJFLK',
	BCFGHIKL: 'HGBCIFLK',
	BCFGHIJL: 'HGBCJFLI',
	BCFGHIJK: 'HGBCJFIK',
	BCEHIJKL: 'EJBCIHLK',
	BCEGIJKL: 'EJBCIGLK',
	BCEGHJKL: 'EJBCHGLK',
	BCEGHIKL: 'EGBCIHLK',
	BCEGHIJL: 'EJBCHGLI',
	BCEGHIJK: 'EJBCHGIK',
	BCEFIJKL: 'EJBCIFLK',
	BCEFHJKL: 'EJBCHFLK',
	BCEFHIKL: 'EIBCHFLK',
	BCEFHIJL: 'EJBCHFLI',
	BCEFHIJK: 'EJBCHFIK',
	BCEFGJKL: 'EGBCJFLK',
	BCEFGIKL: 'EGBCIFLK',
	BCEFGIJL: 'EGBCJFLI',
	BCEFGIJK: 'EGBCJFIK',
	BCEFGHKL: 'EGBCHFLK',
	BCEFGHJL: 'HGBCJFLE',
	BCEFGHJK: 'HGBCJFEK',
	BCEFGHIL: 'EGBCHFLI',
	BCEFGHIK: 'EGBCHFIK',
	BCEFGHIJ: 'HGBCJFEI',
	BCDHIJKL: 'HJBCIDLK',
	BCDGIJKL: 'IGBCJDLK',
	BCDGHJKL: 'HGBCJDLK',
	BCDGHIKL: 'HGBCIDLK',
	BCDGHIJL: 'HGBCJDLI',
	BCDGHIJK: 'HGBCJDIK',
	BCDFIJKL: 'CJBDIFLK',
	BCDFHJKL: 'CJBDHFLK',
	BCDFHIKL: 'CIBDHFLK',
	BCDFHIJL: 'CJBDHFLI',
	BCDFHIJK: 'CJBDHFIK',
	BCDFGJKL: 'CGBDJFLK',
	BCDFGIKL: 'CGBDIFLK',
	BCDFGIJL: 'CGBDJFLI',
	BCDFGIJK: 'CGBDJFIK',
	BCDFGHKL: 'CGBDHFLK',
	BCDFGHJL: 'CGBDHFLJ',
	BCDFGHJK: 'HGBCJFDK',
	BCDFGHIL: 'CGBDHFLI',
	BCDFGHIK: 'CGBDHFIK',
	BCDFGHIJ: 'HGBCJFDI',
	BCDEIJKL: 'EJBCIDLK',
	BCDEHJKL: 'EJBCHDLK',
	BCDEHIKL: 'EIBCHDLK',
	BCDEHIJL: 'EJBCHDLI',
	BCDEHIJK: 'EJBCHDIK',
	BCDEGJKL: 'EGBCJDLK',
	BCDEGIKL: 'EGBCIDLK',
	BCDEGIJL: 'EGBCJDLI',
	BCDEGIJK: 'EGBCJDIK',
	BCDEGHKL: 'EGBCHDLK',
	BCDEGHJL: 'HGBCJDLE',
	BCDEGHJK: 'HGBCJDEK',
	BCDEGHIL: 'EGBCHDLI',
	BCDEGHIK: 'EGBCHDIK',
	BCDEGHIJ: 'HGBCJDEI',
	BCDEFJKL: 'CJBDEFLK',
	BCDEFIKL: 'CEBDIFLK',
	BCDEFIJL: 'CJBDEFLI',
	BCDEFIJK: 'CJBDEFIK',
	BCDEFHKL: 'CEBDHFLK',
	BCDEFHJL: 'CJBDHFLE',
	BCDEFHJK: 'CJBDHFEK',
	BCDEFHIL: 'CEBDHFLI',
	BCDEFHIK: 'CEBDHFIK',
	BCDEFHIJ: 'CJBDHFEI',
	BCDEFGKL: 'CGBDEFLK',
	BCDEFGJL: 'CGBDJFLE',
	BCDEFGJK: 'CGBDJFEK',
	BCDEFGIL: 'CGBDEFLI',
	BCDEFGIK: 'CGBDEFIK',
	BCDEFGIJ: 'CGBDJFEI',
	BCDEFGHL: 'CGBDHFLE',
	BCDEFGHK: 'CGBDHFEK',
	BCDEFGHJ: 'HGBCJFDE',
	BCDEFGHI: 'CGBDHFEI',
	AFGHIJKL: 'HJIFAGLK',
	AEGHIJKL: 'EJIAHGLK',
	AEFHIJKL: 'EJIFAHLK',
	AEFGIJKL: 'EJIFAGLK',
	AEFGHJKL: 'EGJFAHLK',
	AEFGHIKL: 'EGIFAHLK',
	AEFGHIJL: 'EGJFAHLI',
	AEFGHIJK: 'EGJFAHIK',
	ADGHIJKL: 'HJIDAGLK',
	ADFHIJKL: 'HJIDAFLK',
	ADFGIJKL: 'IGJDAFLK',
	ADFGHJKL: 'HGJDAFLK',
	ADFGHIKL: 'HGIDAFLK',
	ADFGHIJL: 'HGJDAFLI',
	ADFGHIJK: 'HGJDAFIK',
	ADEHIJKL: 'EJIDAHLK',
	ADEGIJKL: 'EJIDAGLK',
	ADEGHJKL: 'EGJDAHLK',
	ADEGHIKL: 'EGIDAHLK',
	ADEGHIJL: 'EGJDAHLI',
	ADEGHIJK: 'EGJDAHIK',
	ADEFIJKL: 'EJIDAFLK',
	ADEFHJKL: 'HJEDAFLK',
	ADEFHIKL: 'HEIDAFLK',
	ADEFHIJL: 'HJEDAFLI',
	ADEFHIJK: 'HJEDAFIK',
	ADEFGJKL: 'EGJDAFLK',
	ADEFGIKL: 'EGIDAFLK',
	ADEFGIJL: 'EGJDAFLI',
	ADEFGIJK: 'EGJDAFIK',
	ADEFGHKL: 'HGEDAFLK',
	ADEFGHJL: 'HGJDAFLE',
	ADEFGHJK: 'HGJDAFEK',
	ADEFGHIL: 'HGEDAFLI',
	ADEFGHIK: 'HGEDAFIK',
	ADEFGHIJ: 'HGJDAFEI',
	ACGHIJKL: 'HJICAGLK',
	ACFHIJKL: 'HJICAFLK',
	ACFGIJKL: 'IGJCAFLK',
	ACFGHJKL: 'HGJCAFLK',
	ACFGHIKL: 'HGICAFLK',
	ACFGHIJL: 'HGJCAFLI',
	ACFGHIJK: 'HGJCAFIK',
	ACEHIJKL: 'EJICAHLK',
	ACEGIJKL: 'EJICAGLK',
	ACEGHJKL: 'EGJCAHLK',
	ACEGHIKL: 'EGICAHLK',
	ACEGHIJL: 'EGJCAHLI',
	ACEGHIJK: 'EGJCAHIK',
	ACEFIJKL: 'EJICAFLK',
	ACEFHJKL: 'HJECAFLK',
	ACEFHIKL: 'HEICAFLK',
	ACEFHIJL: 'HJECAFLI',
	ACEFHIJK: 'HJECAFIK',
	ACEFGJKL: 'EGJCAFLK',
	ACEFGIKL: 'EGICAFLK',
	ACEFGIJL: 'EGJCAFLI',
	ACEFGIJK: 'EGJCAFIK',
	ACEFGHKL: 'HGECAFLK',
	ACEFGHJL: 'HGJCAFLE',
	ACEFGHJK: 'HGJCAFEK',
	ACEFGHIL: 'HGECAFLI',
	ACEFGHIK: 'HGECAFIK',
	ACEFGHIJ: 'HGJCAFEI',
	ACDHIJKL: 'HJICADLK',
	ACDGIJKL: 'IGJCADLK',
	ACDGHJKL: 'HGJCADLK',
	ACDGHIKL: 'HGICADLK',
	ACDGHIJL: 'HGJCADLI',
	ACDGHIJK: 'HGJCADIK',
	ACDFIJKL: 'CJIDAFLK',
	ACDFHJKL: 'HJFCADLK',
	ACDFHIKL: 'HFICADLK',
	ACDFHIJL: 'HJFCADLI',
	ACDFHIJK: 'HJFCADIK',
	ACDFGJKL: 'CGJDAFLK',
	ACDFGIKL: 'CGIDAFLK',
	ACDFGIJL: 'CGJDAFLI',
	ACDFGIJK: 'CGJDAFIK',
	ACDFGHKL: 'HGFCADLK',
	ACDFGHJL: 'CGJDAFLH',
	ACDFGHJK: 'HGJCAFDK',
	ACDFGHIL: 'HGFCADLI',
	ACDFGHIK: 'HGFCADIK',
	ACDFGHIJ: 'HGJCAFDI',
	ACDEIJKL: 'EJICADLK',
	ACDEHJKL: 'HJECADLK',
	ACDEHIKL: 'HEICADLK',
	ACDEHIJL: 'HJECADLI',
	ACDEHIJK: 'HJECADIK',
	ACDEGJKL: 'EGJCADLK',
	ACDEGIKL: 'EGICADLK',
	ACDEGIJL: 'EGJCADLI',
	ACDEGIJK: 'EGJCADIK',
	ACDEGHKL: 'HGECADLK',
	ACDEGHJL: 'HGJCADLE',
	ACDEGHJK: 'HGJCADEK',
	ACDEGHIL: 'HGECADLI',
	ACDEGHIK: 'HGECADIK',
	ACDEGHIJ: 'HGJCADEI',
	ACDEFJKL: 'CJEDAFLK',
	ACDEFIKL: 'CEIDAFLK',
	ACDEFIJL: 'CJEDAFLI',
	ACDEFIJK: 'CJEDAFIK',
	ACDEFHKL: 'HEFCADLK',
	ACDEFHJL: 'HJFCADLE',
	ACDEFHJK: 'HJECAFDK',
	ACDEFHIL: 'HEFCADLI',
	ACDEFHIK: 'HEFCADIK',
	ACDEFHIJ: 'HJECAFDI',
	ACDEFGKL: 'CGEDAFLK',
	ACDEFGJL: 'CGJDAFLE',
	ACDEFGJK: 'CGJDAFEK',
	ACDEFGIL: 'CGEDAFLI',
	ACDEFGIK: 'CGEDAFIK',
	ACDEFGIJ: 'CGJDAFEI',
	ACDEFGHL: 'HGFCADLE',
	ACDEFGHK: 'HGECAFDK',
	ACDEFGHJ: 'HGJCAFDE',
	ACDEFGHI: 'HGECAFDI',
	ABGHIJKL: 'HJBAIGLK',
	ABFHIJKL: 'HJBAIFLK',
	ABFGIJKL: 'IJBFAGLK',
	ABFGHJKL: 'HJBFAGLK',
	ABFGHIKL: 'HGBAIFLK',
	ABFGHIJL: 'HJBFAGLI',
	ABFGHIJK: 'HJBFAGIK',
	ABEHIJKL: 'EJBAIHLK',
	ABEGIJKL: 'EJBAIGLK',
	ABEGHJKL: 'EJBAHGLK',
	ABEGHIKL: 'EGBAIHLK',
	ABEGHIJL: 'EJBAHGLI',
	ABEGHIJK: 'EJBAHGIK',
	ABEFIJKL: 'EJBAIFLK',
	ABEFHJKL: 'EJBFAHLK',
	ABEFHIKL: 'EIBFAHLK',
	ABEFHIJL: 'EJBFAHLI',
	ABEFHIJK: 'EJBFAHIK',
	ABEFGJKL: 'EJBFAGLK',
	ABEFGIKL: 'EGBAIFLK',
	ABEFGIJL: 'EJBFAGLI',
	ABEFGIJK: 'EJBFAGIK',
	ABEFGHKL: 'EGBFAHLK',
	ABEFGHJL: 'HJBFAGLE',
	ABEFGHJK: 'HJBFAGEK',
	ABEFGHIL: 'EGBFAHLI',
	ABEFGHIK: 'EGBFAHIK',
	ABEFGHIJ: 'HJBFAGEI',
	ABDHIJKL: 'IJBDAHLK',
	ABDGIJKL: 'IJBDAGLK',
	ABDGHJKL: 'HJBDAGLK',
	ABDGHIKL: 'IGBDAHLK',
	ABDGHIJL: 'HJBDAGLI',
	ABDGHIJK: 'HJBDAGIK',
	ABDFIJKL: 'IJBDAFLK',
	ABDFHJKL: 'HJBDAFLK',
	ABDFHIKL: 'HIBDAFLK',
	ABDFHIJL: 'HJBDAFLI',
	ABDFHIJK: 'HJBDAFIK',
	ABDFGJKL: 'FJBDAGLK',
	ABDFGIKL: 'IGBDAFLK',
	ABDFGIJL: 'FJBDAGLI',
	ABDFGIJK: 'FJBDAGIK',
	ABDFGHKL: 'HGBDAFLK',
	ABDFGHJL: 'HGBDAFLJ',
	ABDFGHJK: 'HGBDAFJK',
	ABDFGHIL: 'HGBDAFLI',
	ABDFGHIK: 'HGBDAFIK',
	ABDFGHIJ: 'HGBDAFIJ',
	ABDEIJKL: 'EJBAIDLK',
	ABDEHJKL: 'EJBDAHLK',
	ABDEHIKL: 'EIBDAHLK',
	ABDEHIJL: 'EJBDAHLI',
	ABDEHIJK: 'EJBDAHIK',
	ABDEGJKL: 'EJBDAGLK',
	ABDEGIKL: 'EGBAIDLK',
	ABDEGIJL: 'EJBDAGLI',
	ABDEGIJK: 'EJBDAGIK',
	ABDEGHKL: 'EGBDAHLK',
	ABDEGHJL: 'HJBDAGLE',
	ABDEGHJK: 'HJBDAGEK',
	ABDEGHIL: 'EGBDAHLI',
	ABDEGHIK: 'EGBDAHIK',
	ABDEGHIJ: 'HJBDAGEI',
	ABDEFJKL: 'EJBDAFLK',
	ABDEFIKL: 'EIBDAFLK',
	ABDEFIJL: 'EJBDAFLI',
	ABDEFIJK: 'EJBDAFIK',
	ABDEFHKL: 'HEBDAFLK',
	ABDEFHJL: 'HJBDAFLE',
	ABDEFHJK: 'HJBDAFEK',
	ABDEFHIL: 'HEBDAFLI',
	ABDEFHIK: 'HEBDAFIK',
	ABDEFHIJ: 'HJBDAFEI',
	ABDEFGKL: 'EGBDAFLK',
	ABDEFGJL: 'EGBDAFLJ',
	ABDEFGJK: 'EGBDAFJK',
	ABDEFGIL: 'EGBDAFLI',
	ABDEFGIK: 'EGBDAFIK',
	ABDEFGIJ: 'EGBDAFIJ',
	ABDEFGHL: 'HGBDAFLE',
	ABDEFGHK: 'HGBDAFEK',
	ABDEFGHJ: 'HGBDAFEJ',
	ABDEFGHI: 'HGBDAFEI',
	ABCHIJKL: 'IJBCAHLK',
	ABCGIJKL: 'IJBCAGLK',
	ABCGHJKL: 'HJBCAGLK',
	ABCGHIKL: 'IGBCAHLK',
	ABCGHIJL: 'HJBCAGLI',
	ABCGHIJK: 'HJBCAGIK',
	ABCFIJKL: 'IJBCAFLK',
	ABCFHJKL: 'HJBCAFLK',
	ABCFHIKL: 'HIBCAFLK',
	ABCFHIJL: 'HJBCAFLI',
	ABCFHIJK: 'HJBCAFIK',
	ABCFGJKL: 'CJBFAGLK',
	ABCFGIKL: 'IGBCAFLK',
	ABCFGIJL: 'CJBFAGLI',
	ABCFGIJK: 'CJBFAGIK',
	ABCFGHKL: 'HGBCAFLK',
	ABCFGHJL: 'HGBCAFLJ',
	ABCFGHJK: 'HGBCAFJK',
	ABCFGHIL: 'HGBCAFLI',
	ABCFGHIK: 'HGBCAFIK',
	ABCFGHIJ: 'HGBCAFIJ',
	ABCEIJKL: 'EJBAICLK',
	ABCEHJKL: 'EJBCAHLK',
	ABCEHIKL: 'EIBCAHLK',
	ABCEHIJL: 'EJBCAHLI',
	ABCEHIJK: 'EJBCAHIK',
	ABCEGJKL: 'EJBCAGLK',
	ABCEGIKL: 'EGBAICLK',
	ABCEGIJL: 'EJBCAGLI',
	ABCEGIJK: 'EJBCAGIK',
	ABCEGHKL: 'EGBCAHLK',
	ABCEGHJL: 'HJBCAGLE',
	ABCEGHJK: 'HJBCAGEK',
	ABCEGHIL: 'EGBCAHLI',
	ABCEGHIK: 'EGBCAHIK',
	ABCEGHIJ: 'HJBCAGEI',
	ABCEFJKL: 'EJBCAFLK',
	ABCEFIKL: 'EIBCAFLK',
	ABCEFIJL: 'EJBCAFLI',
	ABCEFIJK: 'EJBCAFIK',
	ABCEFHKL: 'HEBCAFLK',
	ABCEFHJL: 'HJBCAFLE',
	ABCEFHJK: 'HJBCAFEK',
	ABCEFHIL: 'HEBCAFLI',
	ABCEFHIK: 'HEBCAFIK',
	ABCEFHIJ: 'HJBCAFEI',
	ABCEFGKL: 'EGBCAFLK',
	ABCEFGJL: 'EGBCAFLJ',
	ABCEFGJK: 'EGBCAFJK',
	ABCEFGIL: 'EGBCAFLI',
	ABCEFGIK: 'EGBCAFIK',
	ABCEFGIJ: 'EGBCAFIJ',
	ABCEFGHL: 'HGBCAFLE',
	ABCEFGHK: 'HGBCAFEK',
	ABCEFGHJ: 'HGBCAFEJ',
	ABCEFGHI: 'HGBCAFEI',
	ABCDIJKL: 'IJBCADLK',
	ABCDHJKL: 'HJBCADLK',
	ABCDHIKL: 'HIBCADLK',
	ABCDHIJL: 'HJBCADLI',
	ABCDHIJK: 'HJBCADIK',
	ABCDGJKL: 'CJBDAGLK',
	ABCDGIKL: 'IGBCADLK',
	ABCDGIJL: 'CJBDAGLI',
	ABCDGIJK: 'CJBDAGIK',
	ABCDGHKL: 'HGBCADLK',
	ABCDGHJL: 'HGBCADLJ',
	ABCDGHJK: 'HGBCADJK',
	ABCDGHIL: 'HGBCADLI',
	ABCDGHIK: 'HGBCADIK',
	ABCDGHIJ: 'HGBCADIJ',
	ABCDFJKL: 'CJBDAFLK',
	ABCDFIKL: 'CIBDAFLK',
	ABCDFIJL: 'CJBDAFLI',
	ABCDFIJK: 'CJBDAFIK',
	ABCDFHKL: 'HFBCADLK',
	ABCDFHJL: 'CJBDAFLH',
	ABCDFHJK: 'HJBCAFDK',
	ABCDFHIL: 'HFBCADLI',
	ABCDFHIK: 'HFBCADIK',
	ABCDFHIJ: 'HJBCAFDI',
	ABCDFGKL: 'CGBDAFLK',
	ABCDFGJL: 'CGBDAFLJ',
	ABCDFGJK: 'CGBDAFJK',
	ABCDFGIL: 'CGBDAFLI',
	ABCDFGIK: 'CGBDAFIK',
	ABCDFGIJ: 'CGBDAFIJ',
	ABCDFGHL: 'CGBDAFLH',
	ABCDFGHK: 'HGBCAFDK',
	ABCDFGHJ: 'HGBCAFDJ',
	ABCDFGHI: 'HGBCAFDI',
	ABCDEJKL: 'EJBCADLK',
	ABCDEIKL: 'EIBCADLK',
	ABCDEIJL: 'EJBCADLI',
	ABCDEIJK: 'EJBCADIK',
	ABCDEHKL: 'HEBCADLK',
	ABCDEHJL: 'HJBCADLE',
	ABCDEHJK: 'HJBCADEK',
	ABCDEHIL: 'HEBCADLI',
	ABCDEHIK: 'HEBCADIK',
	ABCDEHIJ: 'HJBCADEI',
	ABCDEGKL: 'EGBCADLK',
	ABCDEGJL: 'EGBCADLJ',
	ABCDEGJK: 'EGBCADJK',
	ABCDEGIL: 'EGBCADLI',
	ABCDEGIK: 'EGBCADIK',
	ABCDEGIJ: 'EGBCADIJ',
	ABCDEGHL: 'HGBCADLE',
	ABCDEGHK: 'HGBCADEK',
	ABCDEGHJ: 'HGBCADEJ',
	ABCDEGHI: 'HGBCADEI',
	ABCDEFKL: 'CEBDAFLK',
	ABCDEFJL: 'CJBDAFLE',
	ABCDEFJK: 'CJBDAFEK',
	ABCDEFIL: 'CEBDAFLI',
	ABCDEFIK: 'CEBDAFIK',
	ABCDEFIJ: 'CJBDAFEI',
	ABCDEFHL: 'HFBCADLE',
	ABCDEFHK: 'HEBCAFDK',
	ABCDEFHJ: 'HJBCAFDE',
	ABCDEFHI: 'HEBCAFDI',
	ABCDEFGL: 'CGBDAFLE',
	ABCDEFGK: 'CGBDAFEK',
	ABCDEFGJ: 'CGBDAFEJ',
	ABCDEFGI: 'CGBDAFEI',
	ABCDEFGH: 'HGBCAFDE'
};

export type BracketSide = 'A' | 'B';

export type BracketFlow = Record<string, { w: [string, BracketSide]; l?: [string, BracketSide] }>;

export const FLOW: BracketFlow = {
	'r32-01': { w: ['r16-02', 'A'] },
	'r32-02': { w: ['r16-01', 'A'] },
	'r32-03': { w: ['r16-02', 'B'] },
	'r32-04': { w: ['r16-03', 'A'] },
	'r32-05': { w: ['r16-01', 'B'] },
	'r32-06': { w: ['r16-03', 'B'] },
	'r32-07': { w: ['r16-04', 'A'] },
	'r32-08': { w: ['r16-04', 'B'] },
	'r32-09': { w: ['r16-06', 'A'] },
	'r32-10': { w: ['r16-06', 'B'] },
	'r32-11': { w: ['r16-05', 'A'] },
	'r32-12': { w: ['r16-05', 'B'] },
	'r32-13': { w: ['r16-08', 'A'] },
	'r32-14': { w: ['r16-07', 'A'] },
	'r32-15': { w: ['r16-08', 'B'] },
	'r32-16': { w: ['r16-07', 'B'] },
	'r16-01': { w: ['qf-01', 'A'] },
	'r16-02': { w: ['qf-01', 'B'] },
	'r16-03': { w: ['qf-03', 'A'] },
	'r16-04': { w: ['qf-03', 'B'] },
	'r16-05': { w: ['qf-02', 'A'] },
	'r16-06': { w: ['qf-02', 'B'] },
	'r16-07': { w: ['qf-04', 'A'] },
	'r16-08': { w: ['qf-04', 'B'] },
	'qf-01': { w: ['sf-01', 'A'] },
	'qf-02': { w: ['sf-01', 'B'] },
	'qf-03': { w: ['sf-02', 'A'] },
	'qf-04': { w: ['sf-02', 'B'] },
	'sf-01': { w: ['final', 'A'], l: ['3rd', 'A'] },
	'sf-02': { w: ['final', 'B'], l: ['3rd', 'B'] }
};

export function winnerConnections(): [string, string][] {
	return Object.entries(FLOW).map(([fromId, flow]) => [fromId, flow.w[0]]);
}

export function loserConnections(): [string, string][] {
	return Object.entries(FLOW)
		.filter((entry): entry is [string, { w: [string, BracketSide]; l: [string, BracketSide] }] => !!entry[1].l)
		.map(([fromId, flow]) => [fromId, flow.l[0]]);
}

export function compareThirdPlaceMetrics(a: GroupStandingRow, b: GroupStandingRow): number {
	if (b.points !== a.points) return b.points - a.points;
	if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
	if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
	if (b.tiebreakerPoints !== a.tiebreakerPoints) return b.tiebreakerPoints - a.tiebreakerPoints;
	return 0;
}

export function compareThirdPlaceRows(a: GroupStandingRow, b: GroupStandingRow): number {
	const byMetrics = compareThirdPlaceMetrics(a, b);
	if (byMetrics !== 0) return byMetrics;
	return a.team.localeCompare(b.team);
}

export interface GroupStandingMatchResult {
	teamA: string;
	teamB: string;
	scoreA: number | null;
	scoreB: number | null;
}

function headToHeadStats(
	team: string,
	tiedTeams: Set<string>,
	matches: GroupStandingMatchResult[]
): { points: number; goalDiff: number; goalsFor: number } {
	const stats = { points: 0, goalDiff: 0, goalsFor: 0 };

	for (const match of matches) {
		if (match.scoreA === null || match.scoreB === null) continue;
		const includesTeam = match.teamA === team || match.teamB === team;
		const isBetweenTiedTeams = tiedTeams.has(match.teamA) && tiedTeams.has(match.teamB);
		if (!includesTeam || !isBetweenTiedTeams) continue;

		const goalsFor = match.teamA === team ? match.scoreA : match.scoreB;
		const goalsAgainst = match.teamA === team ? match.scoreB : match.scoreA;
		stats.goalsFor += goalsFor;
		stats.goalDiff += goalsFor - goalsAgainst;
		if (goalsFor > goalsAgainst) stats.points += 3;
		else if (goalsFor === goalsAgainst) stats.points += 1;
	}

	return stats;
}

export function compareGroupStandingMetrics(
	a: GroupStandingRow,
	b: GroupStandingRow,
	rows: GroupStandingRow[],
	matches: GroupStandingMatchResult[]
): number {
	if (b.points !== a.points) return b.points - a.points;
	if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
	if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

	const tiedTeams = new Set(
		rows
			.filter((row) => row.points === a.points && row.goalDiff === a.goalDiff && row.goalsFor === a.goalsFor)
			.map((row) => row.team)
	);
	const aHeadToHead = headToHeadStats(a.team, tiedTeams, matches);
	const bHeadToHead = headToHeadStats(b.team, tiedTeams, matches);
	if (bHeadToHead.points !== aHeadToHead.points) return bHeadToHead.points - aHeadToHead.points;
	if (bHeadToHead.goalDiff !== aHeadToHead.goalDiff) return bHeadToHead.goalDiff - aHeadToHead.goalDiff;
	if (bHeadToHead.goalsFor !== aHeadToHead.goalsFor) return bHeadToHead.goalsFor - aHeadToHead.goalsFor;
	if (b.tiebreakerPoints !== a.tiebreakerPoints) return b.tiebreakerPoints - a.tiebreakerPoints;
	return 0;
}

export function sortGroupStandingRows(
	rows: GroupStandingRow[],
	matches: GroupStandingMatchResult[]
): GroupStandingRow[] {
	return [...rows].sort((a, b) => compareGroupStandingMetrics(a, b, rows, matches) || a.team.localeCompare(b.team));
}

export function hasUnresolvedGroupBoundaryTie(
	rows: GroupStandingRow[],
	matches: GroupStandingMatchResult[],
	boundaryIndex: number
): boolean {
	const above = rows[boundaryIndex];
	const below = rows[boundaryIndex + 1];
	if (!above || !below) return true;
	return compareGroupStandingMetrics(above, below, rows, matches) === 0;
}

export function teamAt(
	standings: Record<string, GroupStandingRow[]>,
	group: string,
	pos: number
): string | null {
	return standings[group]?.[pos]?.team ?? null;
}

export function rankThirdPlacedGroups(
	standings: Record<string, GroupStandingRow[]>
): { group: GroupCode; row: GroupStandingRow }[] {
	return GROUP_CODES
		.map((group) => {
			const row = standings[group]?.[2] ?? null;
			return row ? { group, row } : null;
		})
		.filter((item): item is { group: GroupCode; row: GroupStandingRow } => item !== null)
		.sort((a, b) => compareThirdPlaceRows(a.row, b.row) || a.group.localeCompare(b.group));
}

export function resolveBestThirds(
	standings: Record<string, GroupStandingRow[]>
): Map<string, GroupCode> {
	const thirds = rankThirdPlacedGroups(standings);
	if (thirds.length < 8) return new Map();

	const best8 = new Set<GroupCode>(thirds.slice(0, 8).map((third) => third.group));
	const assignmentCode = THIRD_PLACE_ANNEX_C_ASSIGNMENTS[
		GROUP_CODES.filter((group) => best8.has(group)).join('')
	];
	if (!assignmentCode) return new Map();

	const assignment = new Map<string, GroupCode>();
	for (let index = 0; index < ANNEX_C_ASSIGNMENT_SLOT_IDS.length; index += 1) {
		const slotId = ANNEX_C_ASSIGNMENT_SLOT_IDS[index];
		const group = assignmentCode[index] as GroupCode | undefined;
		if (!group || !THIRD_PLACE_SLOTS[slotId].includes(group)) return new Map();
		assignment.set(slotId, group);
	}

	return assignment;
}

export function resolveWinner(
	teamA: string,
	teamB: string,
	scoreA: number | null,
	scoreB: number | null,
	penaltyWinner: SideWinner
): { winner: string | null; loser: string | null } {
	if (scoreA === null || scoreB === null) return { winner: null, loser: null };
	if (scoreA > scoreB) return { winner: teamA, loser: teamB };
	if (scoreB > scoreA) return { winner: teamB, loser: teamA };
	if (penaltyWinner === 'A') return { winner: teamA, loser: teamB };
	if (penaltyWinner === 'B') return { winner: teamB, loser: teamA };
	return { winner: null, loser: null };
}

export function getMatchOutcome(a: number, b: number, stage: Match['stage'], penaltyWinner: SideWinner): 'A' | 'B' | 'draw' {
	if (a > b) return 'A';
	if (b > a) return 'B';
	if (stage !== 'groups' && penaltyWinner) return penaltyWinner;
	return 'draw';
}