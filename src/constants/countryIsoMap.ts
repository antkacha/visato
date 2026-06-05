// slug → ISO 3166-1 numeric code (matches world-atlas countries-110m.json feature ids)
export const SLUG_TO_ISO: Record<string, number> = {
  // Schengen (Cyprus joined 2024)
  austria: 40, belgium: 56, bulgaria: 100, croatia: 191, czech_republic: 203,
  cyprus: 196,
  denmark: 208, estonia: 233, finland: 246, france: 250, germany: 276,
  greece: 300, hungary: 348, iceland: 352, italy: 380, latvia: 428,
  liechtenstein: 438, lithuania: 440, luxembourg: 442, malta: 470,
  netherlands: 528, norway: 578, poland: 616, portugal: 620, romania: 642,
  slovakia: 703, slovenia: 705, spain: 724, sweden: 752, switzerland: 756,
  // Tracked zones
  united_kingdom: 826, united_states: 840, turkey: 792,
  united_arab_emirates: 784, thailand: 764, georgia: 268,
  // Europe (non-Schengen)
  albania: 8, andorra: 20, belarus: 112, bosnia_and_herzegovina: 70,
  greenland: 304, ireland: 372,
  kosovo: 383, moldova: 498, monaco: 492, montenegro: 499,
  north_macedonia: 807, russia: 643, san_marino: 674, serbia: 688,
  ukraine: 804, vatican: 336,
  // Asia
  afghanistan: 4, armenia: 51, azerbaijan: 31, bahrain: 48, bangladesh: 50,
  bhutan: 64, brunei: 96, cambodia: 116, china: 156, india: 356,
  indonesia: 360, iran: 364, iraq: 368, israel: 376, japan: 392,
  jordan: 400, kazakhstan: 398, kuwait: 414, kyrgyzstan: 417, laos: 418,
  lebanon: 422, malaysia: 458, maldives: 462, mongolia: 496, myanmar: 104,
  nepal: 524, north_korea: 408, oman: 512, pakistan: 586, palestine: 275,
  philippines: 608, qatar: 634, saudi_arabia: 682, singapore: 702,
  south_korea: 410, sri_lanka: 144, syria: 760, taiwan: 158,
  tajikistan: 762, timor_leste: 626, turkmenistan: 795, uzbekistan: 860,
  vietnam: 704, yemen: 887,
  // Africa
  algeria: 12, angola: 24, benin: 204, botswana: 72, burkina_faso: 854,
  burundi: 108, cameroon: 120, cape_verde: 132, central_african_republic: 140,
  chad: 148, comoros: 174, congo: 178, dr_congo: 180, djibouti: 262,
  egypt: 818, equatorial_guinea: 226, eritrea: 232, eswatini: 748,
  ethiopia: 231, gabon: 266, gambia: 270, ghana: 288, guinea: 324,
  guinea_bissau: 624, ivory_coast: 384, kenya: 404, lesotho: 426,
  liberia: 430, libya: 434, madagascar: 450, malawi: 454, mali: 466,
  mauritania: 478, mauritius: 480, morocco: 504, mozambique: 508,
  namibia: 516, niger: 562, nigeria: 566, rwanda: 646,
  sao_tome_and_principe: 678, senegal: 686, seychelles: 690,
  sierra_leone: 694, somalia: 706, south_africa: 710, south_sudan: 728,
  sudan: 729, tanzania: 834, togo: 768, tunisia: 788, uganda: 800,
  zambia: 894, zimbabwe: 716,
  // Americas
  antigua_and_barbuda: 28, argentina: 32, bahamas: 44, barbados: 52,
  belize: 84, bolivia: 68, brazil: 76, canada: 124, chile: 152,
  colombia: 170, costa_rica: 188, cuba: 192, dominica: 212,
  dominican_republic: 214, ecuador: 218, el_salvador: 222, grenada: 308,
  guatemala: 320, guyana: 328, haiti: 332, honduras: 340, jamaica: 388,
  mexico: 484, nicaragua: 558, panama: 591, paraguay: 600, peru: 604,
  saint_kitts_and_nevis: 659, saint_lucia: 662,
  saint_vincent_and_the_grenadines: 670, suriname: 740,
  trinidad_and_tobago: 780, uruguay: 858, venezuela: 862,
  // Oceania
  australia: 36, fiji: 242, kiribati: 296, marshall_islands: 584,
  micronesia: 583, nauru: 520, new_zealand: 554, palau: 585,
  papua_new_guinea: 598, samoa: 882, solomon_islands: 90, tonga: 776,
  tuvalu: 798, vanuatu: 548,
}

// Reverse map: ISO numeric → slug
export const ISO_TO_SLUG: Record<number, string> = Object.fromEntries(
  Object.entries(SLUG_TO_ISO).map(([slug, iso]) => [iso, slug])
)

// Name overrides for world-atlas features that have id=-99 (no standard ISO code)
// "N. Cyprus" is merged visually with "cyprus" so both polygons get the same colour/tooltip
const NAME_OVERRIDES: Record<string, string> = {
  'Kosovo':    'kosovo',
  'N. Cyprus': 'cyprus',
}

/**
 * Resolve a world-atlas GeoJSON feature to an app country slug.
 * Primary: ISO numeric ID via ISO_TO_SLUG.
 * Fallback: properties.name for features with id=-99 (Kosovo, N. Cyprus, etc.).
 */
export function geoFeatureSlug(
  id: string | number,
  properties?: Record<string, unknown>,
): string | undefined {
  const byIso = ISO_TO_SLUG[Number(id)]
  if (byIso) return byIso
  const name = properties?.name as string | undefined
  return name ? NAME_OVERRIDES[name] : undefined
}
