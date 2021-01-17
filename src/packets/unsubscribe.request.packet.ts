import { PacketStream } from '../packet-stream';
import { PacketWriteResult } from '../mqtt.packet';

export interface UnsubscribePacketOptions {
    topics: string[] | string;
    identifier: number;
}

export function writeUnsubscribePacket(stream: PacketStream, options: UnsubscribePacketOptions): PacketWriteResult {
    stream.writeWord(options.identifier);
    const topics = typeof options.topics === 'string' ? [options.topics] : options.topics;
    if (topics.length === 0)
        throw new Error('The Payload of an UNSUBSCRIBE packet MUST contain at least one Topic Filter');
    for (const topic of topics) stream.writeString(topic);
    return { flags: 2, identifier: options.identifier };
}
