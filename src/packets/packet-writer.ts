import { PacketType } from '../mqtt.constants';
import { RequiredConnectRequestOptions, writeConnectPacket } from './connect.request.packet';
import { PacketStream } from '../packet-stream';
import { PacketWriteResult } from '../mqtt.packet';
import { PublishPacketOptions, writePublishRequestPacket } from './publish.request.packet';
import { PublishAckPacketOptions, writePublishAckPacket } from './publish.ack.packet';
import { PublishReceivedPacketOptions, writePublishReceivedPacket } from './publish.received.packet';
import { PublishReleasedPacketOptions, writePublishReleasePacket } from './publish.release.packet';
import { PublishCompletePacketOptions, writePublishCompletePacket } from './publish.complete.packet';
import { SubscribePacketOptions, writeSubscribePacket } from './subscribe.request.packet';
import { UnsubscribePacketOptions, writeUnsubscribePacket } from './unsubscribe.request.packet';
import { writePingRequestPacket } from './ping.request.packet';

export interface PacketLogger {
    logPacketWrite: (packetType: PacketType, packetInfo: Record<string, string | number | boolean | undefined>) => void;
}

export class PacketWriter<WriteOptions extends PacketWriteOptionsMap = DefaultPacketWriteOptions> {
    constructor(
        protected logger: PacketLogger,
        protected writeMap: PacketWriteMap<WriteOptions> = DefaultPacketWriteMap,
    ) {}

    write<T extends PacketType>(type: T, options?: WriteOptions[T]): Buffer {
        const packetStream = PacketStream.empty();
        const fn = this.writeMap[type];
        if (!fn) {
            throw new Error('No packet function found');
        }
        const result = fn(packetStream, options);
        if(result.flags && (result.flags < 0 || result.flags > 0xf)) {
            throw new Error('Invalid flags');
        }


        this.logger.logPacketWrite(type, { ...options, flags: result.flags ?? 0, identifier: result.identifier });

        const finalStream = PacketStream.empty();
        finalStream.writeByte((type << 4) | (result.flags ?? 0));
        //if (packetStream.length === 0) return finalStream.data;

        return finalStream
            .writeVariableByteInteger(packetStream.length)
            .write(packetStream.data)
            .data;
    }
}

export function defaultWrite<T extends PacketType>(type: T, options?: DefaultPacketWriteOptions[T]): WriteData<DefaultPacketWriteOptions, T> {
    return {
        type,
        options
    };
}

export interface WriteData<WriteMap extends PacketWriteOptionsMap, T extends PacketType> {
    type: T,
    options?: WriteMap[T]
}

export const DefaultPacketWriteMap: PacketWriteMap<DefaultPacketWriteOptions> = {
    [PacketType.Connect]: writeConnectPacket,
    [PacketType.Publish]: writePublishRequestPacket,
    [PacketType.PubAck]: writePublishAckPacket,
    [PacketType.PubRec]: writePublishReceivedPacket,
    [PacketType.PubRel]: writePublishReleasePacket,
    [PacketType.PubComp]: writePublishCompletePacket,
    [PacketType.Subscribe]: writeSubscribePacket,
    [PacketType.Unsubscribe]: writeUnsubscribePacket,
    [PacketType.PingReq]: writePingRequestPacket,
};

export type PacketWriteMap<Options extends PacketWriteOptionsMap> = {
    [P in PacketType]?: (
        stream: PacketStream,
        options: Options[P],
    ) => PacketWriteResult;
};

export type PacketWriteOptionsMap = { [x in PacketType]: any };

export type DefaultPacketWriteOptions = {
    [PacketType.Connect]: RequiredConnectRequestOptions;
    [PacketType.ConnAck]: undefined;
    [PacketType.Publish]: PublishPacketOptions;
    [PacketType.PubAck]: PublishAckPacketOptions;
    [PacketType.PubRec]: PublishReceivedPacketOptions;
    [PacketType.PubRel]: PublishReleasedPacketOptions;
    [PacketType.PubComp]: PublishCompletePacketOptions;
    [PacketType.Subscribe]: SubscribePacketOptions;
    [PacketType.SubAck]: undefined;
    [PacketType.Unsubscribe]: UnsubscribePacketOptions;
    [PacketType.UnsubAck]: undefined;
    [PacketType.PingReq]: undefined;
    [PacketType.PingResp]: undefined;
    [PacketType.Disconnect]: undefined;
};
