import { PacketWriteResult } from '../mqtt.packet';
import { expectRemainingLength } from '../mqtt.utilities';

export class PingRequestPacket {}

export function writePingRequestPacket(): PacketWriteResult {
    return {};
}

export function readPingRequestPacket(_: unknown, remaining: number): PingRequestPacket {
    expectRemainingLength(remaining, 0);
    return new PingRequestPacket();
}