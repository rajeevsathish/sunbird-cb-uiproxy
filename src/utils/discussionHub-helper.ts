// DiscussionHub (NodeBB) has been decommissioned.
// This file is kept as a placeholder to avoid breaking imports until all consumers are cleaned up.

// tslint:disable-next-line: no-any
export async function getUserUIDBySession(_req: any): Promise<string | undefined> {
    return undefined
}

// tslint:disable-next-line: no-any
export async function getUserSlug(_req: any, _wid: any): Promise<string | undefined> {
    return undefined
}

export function getWriteApiToken(): string {
    return ''
}

export function getWriteApiAdminUID(): number {
    return 0
}
