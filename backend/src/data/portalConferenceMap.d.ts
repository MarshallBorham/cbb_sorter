export declare const PORTAL_CONFERENCE_MAP: Record<string, Set<string>>;
export declare function resolveCanonicalTeamName(team: string | undefined | null, canonicalSet: Set<string>): string | null;
export declare function expandQueryTeamNames(teams: Set<string>): string[];
