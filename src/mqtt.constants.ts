export enum PacketType {
    Connect = 1,
    ConnAck,
    Publish,
    PubAck,
    PubRec,
    PubRel,
    PubComp,
    Subscribe,
    SubAck,
    Unsubscribe,
    UnsubAck,
    PingReq,
    PingResp,
    Disconnect,
}

export interface EventMapping {
    CONNECT: PacketType.Connect;
    CONNACK: PacketType.ConnAck;
    PUBLISH: PacketType.Publish;
    PUBACK: PacketType.PubAck;
    PUBREC: PacketType.PubRec;
    PUBREL: PacketType.PubRel;
    PUBCOMP: PacketType.PubComp;
    SUBSCRIBE: PacketType.Subscribe;
    SUBACK: PacketType.SubAck;
    UNSUBSCRIBE: PacketType.Unsubscribe;
    UNSUBACK: PacketType.UnsubAck;
    PINGREQ: PacketType.PingReq;
    PINGRESP: PacketType.PingResp;
    DISCONNECT: PacketType.Disconnect;
}

const reverseMapping = Object.fromEntries(Object.entries(PacketType).map(([k, v]) => [v, k]));

export type PacketName = keyof EventMapping;

export function packetTypeToString(type: PacketType): PacketName {
    return reverseMapping[type].toUpperCase() as PacketName;
}
