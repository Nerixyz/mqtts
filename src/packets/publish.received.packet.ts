import { IdentifierPacket, PacketWriteResult } from '../mqtt.packet';
import { PacketStream } from '../packet-stream';
import { IdentifierData } from '../mqtt.types';
import { expectRemainingLength } from '../mqtt.utilities';

export class PublishReceivedPacket extends IdentifierPacket {}

export function writePublishReceivedPacket(
    stream: PacketStream,
    options: PublishReceivedPacketOptions,
): PacketWriteResult {
    stream.writeWord(options.identifier);
    return { identifier: options.identifier };
}

export function readPublishReceivedPacket(stream: PacketStream, remaining: number): PublishReceivedPacket {
    expectRemainingLength(remaining, 2);
    return new PublishReceivedPacket(stream.readWord());
}

export type PublishReceivedPacketOptions = IdentifierData;
