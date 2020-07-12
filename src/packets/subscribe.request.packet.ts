import { PacketStream } from '../packet-stream';
import { PacketWriteResult } from '../mqtt.packet';

export interface SubscribePacketOptions {
    subscriptions: Array<{topic: string; qos?: number}>;
    identifier: number;
}

export function writeSubscribePacket(stream: PacketStream, options: SubscribePacketOptions): PacketWriteResult {
    stream.writeWord(options.identifier);
    if(options.subscriptions.length === 0)
        throw new Error('The payload of a SUBSCRIBE packet MUST contain at least one Topic Filter / QoS pair');
    for(const sub of options.subscriptions) {
        if(sub.qos && sub.qos > 2)
            throw new Error('invalid QoS');
        stream.writeString(sub.topic).writeByte(sub.qos ?? 0);
    }
    return {flags: 2, identifier: options.identifier};
}
