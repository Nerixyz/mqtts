export class IdentifierPacket {
    constructor(public readonly identifier: number) {}
}

export interface PacketWriteResult {
    flags?: number;
    identifier?: number;
}

let _lastId = 0;
export function generateIdentifier(): number {
    return (_lastId = (_lastId + 1) & 0xffff);
}
