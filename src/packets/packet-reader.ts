import { PacketType } from '../mqtt.constants';
import { PacketStream } from '../packet-stream';
import { ConnectResponsePacket, readConnectResponsePacket } from './connect.response.packet';
import { PublishRequestPacket, readPublishRequestPacket } from './publish.request.packet';
import { PublishAckPacket, readPublishAckPacket } from './publish.ack.packet';
import { PublishReleasePacket, readPublishReleasePacket } from './publish.release.packet';
import { PublishReceivedPacket, readPublishReceivedPacket } from './publish.received.packet';
import { PublishCompletePacket, readPublishCompletePacket } from './publish.complete.packet';
import { readSubscribeResponsePacket, SubscribeResponsePacket } from './subscribe.response.packet';
import { readUnsubscribePacket, UnsubscribeResponsePacket } from './unsubscribe.response.packet';
import { PingResponsePacket, readPingResponsePacket } from './ping.response.packet';
import { PingRequestPacket, readPingRequestPacket } from './ping.request.packet';

export type PacketReadResultMap = { [x in PacketType]: unknown };
export type PacketReadMap<Results extends PacketReadResultMap> = {
    [P in PacketType]?: (stream: PacketStream, remainingLength: number, flags: number) => Results[P];
};

export interface DefaultPacketReadResultMap extends PacketReadResultMap {
    [PacketType.ConnAck]: ConnectResponsePacket;
    [PacketType.Publish]: PublishRequestPacket;
    [PacketType.PubAck]: PublishAckPacket;
    [PacketType.PubRel]: PublishReleasePacket;
    [PacketType.PubRec]: PublishReceivedPacket;
    [PacketType.PubComp]: PublishCompletePacket;
    [PacketType.SubAck]: SubscribeResponsePacket;
    [PacketType.UnsubAck]: UnsubscribeResponsePacket;
    [PacketType.PingResp]: PingResponsePacket;
    [PacketType.PingReq]: PingRequestPacket;
}

export const DefaultPacketReadMap: PacketReadMap<DefaultPacketReadResultMap> = {
    [PacketType.ConnAck]: readConnectResponsePacket,
    [PacketType.Publish]: readPublishRequestPacket,
    [PacketType.PubAck]: readPublishAckPacket,
    [PacketType.PubRel]: readPublishReleasePacket,
    [PacketType.PubRec]: readPublishReceivedPacket,
    [PacketType.PubComp]: readPublishCompletePacket,
    [PacketType.SubAck]: readSubscribeResponsePacket,
    [PacketType.UnsubAck]: readUnsubscribePacket,
    [PacketType.PingReq]: readPingRequestPacket,
    [PacketType.PingResp]: readPingResponsePacket,
};
