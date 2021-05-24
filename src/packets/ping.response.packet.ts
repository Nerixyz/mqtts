import { expectRemainingLength } from '../mqtt.utilities';
import { PacketWriteResult } from '../mqtt.packet';

export class PingResponsePacket {}

export function readPingResponsePacket(_: unknown, remaining: number): PingResponsePacket {
    expectRemainingLength(remaining, 0);
    return new PingResponsePacket();
}

export function writePingResponsePacket(): PacketWriteResult {
    return {};
}
