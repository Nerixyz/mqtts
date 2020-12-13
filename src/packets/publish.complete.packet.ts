import { IdentifierPacket, PacketWriteResult } from '../mqtt.packet';
import { PacketStream } from '../packet-stream';
import { IdentifierData } from '../mqtt.types';
import { expectRemainingLength } from '../mqtt.utilities';

export class PublishCompletePacket extends IdentifierPacket {}

export function writePublishCompletePacket(
    stream: PacketStream,
    options: PublishCompletePacketOptions,
): PacketWriteResult {
    stream.writeWord(options.identifier);
    return { identifier: options.identifier };
}

export function readPublishCompletePacket(stream: PacketStream, remaining: number): PublishCompletePacket {
    expectRemainingLength(remaining, 2);
    return new PublishCompletePacket(stream.readWord());
}

export type PublishCompletePacketOptions = IdentifierData;
